/**
 * Royalties CSV Ingestion API Route
 * POST /api/royalties/ingest
 * 
 * Server-side CSV parsing and insertion for large files (up to 10MB)
 * - Downloads CSV from Supabase Storage
 * - Parses using PapaParse (Node environment)
 * - Creates tracks if needed
 * - Inserts royalties in batches
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import Papa from "papaparse";

interface RoyaltyRow {
  songTitle: string;
  iswc: string;
  composer: string;
  date: string;
  territory: string;
  source: string;
  usageCount: number;
  gross: number;
  adminPercent: number;
  net: number;
}

interface IngestRequest {
  artistId: string;
  filePath: string;
}

interface IngestResponse {
  success: boolean;
  inserted?: number;
  error?: string;
  details?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<IngestResponse>> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    
    // Parse request body
    const body: IngestRequest = await request.json();
    const { artistId, filePath } = body;

    if (!artistId || !filePath) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: artistId and filePath" },
        { status: 400 }
      );
    }

    console.log(`📥 Starting CSV ingestion for artist ${artistId}, file: ${filePath}`);

    // Step 1: Download CSV from Supabase Storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from("royalties")
      .download(filePath);

    if (downloadError || !fileData) {
      console.error("Storage download error:", downloadError);
      return NextResponse.json(
        { success: false, error: "Failed to download file from storage", details: downloadError?.message },
        { status: 500 }
      );
    }

    // Convert Blob to text
    const csvText = await fileData.text();
    console.log(`📄 Downloaded CSV file, size: ${csvText.length} bytes`);

    // Step 2: Parse CSV using PapaParse
    const parseResult = await new Promise<Papa.ParseResult<Record<string, string>>>((resolve, reject) => {
      Papa.parse<Record<string, string>>(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results),
        error: (error: Error) => reject(error),
      });
    });

    if (parseResult.errors.length > 0) {
      console.error("CSV parsing errors:", parseResult.errors);
      return NextResponse.json(
        { success: false, error: "Failed to parse CSV file", details: parseResult.errors[0]?.message },
        { status: 400 }
      );
    }

    console.log(`✅ Parsed ${parseResult.data.length} rows from CSV`);

    // Step 3: Normalize data
    const getColumn = (row: Record<string, string>, possibleNames: string[]) => {
      // Try exact match first
      for (const name of possibleNames) {
        if (row[name] !== undefined && row[name] !== null && row[name] !== "") {
          return row[name];
        }
      }
      // Try case-insensitive match
      const rowKeys = Object.keys(row);
      for (const name of possibleNames) {
        const foundKey = rowKeys.find(key => key.toLowerCase() === name.toLowerCase());
        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== "") {
          return row[foundKey];
        }
      }
      return "";
    };

    const parsedData: RoyaltyRow[] = parseResult.data.map((row) => ({
      songTitle: getColumn(row, ["Song Title", "song title", "title", "Title"]) || "",
      iswc: getColumn(row, ["ISWC", "iswc", "Iswc", "ISWC Code"]) || "",
      composer: getColumn(row, ["Composer", "composer", "Composer Name"]) || "",
      date: getColumn(row, ["Date", "date", "Broadcast Date", "broadcast_date"]) || "",
      territory: getColumn(row, ["Territory", "territory"]) || "",
      source: getColumn(row, ["Source", "source", "Platform", "platform", "Exploitation Source"]) || "",
      usageCount: parseInt(getColumn(row, ["Usage Count", "usage count", "Usage Cou", "Usage", "usage"]) || "0") || 0,
      gross: parseFloat(getColumn(row, ["Gross", "gross", "Gross Amount"]) || "0") || 0,
      adminPercent: parseFloat(getColumn(row, ["Admin %", "admin %", "Admin Percent"]) || "0") || 0,
      net: parseFloat(getColumn(row, ["Net", "net", "Net Amount"]) || "0") || 0,
    }));

    console.log(`🔄 Normalized ${parsedData.length} rows`);

    // Step 4: Create or find tracks
    const tracksByTitle = new Map<string, string>();
    const uniqueTitles = [...new Set(parsedData.map(row => row.songTitle))];

    console.log(`🎵 Processing ${uniqueTitles.length} unique tracks...`);

    for (const songTitle of uniqueTitles) {
      // Check if track exists
      const { data: existingTrack } = await supabaseAdmin
        .from("tracks")
        .select("id")
        .eq("song_title", songTitle)
        .eq("artist_id", artistId)
        .maybeSingle();

      if (existingTrack) {
        tracksByTitle.set(songTitle, existingTrack.id);
      } else {
        // Find the first row with this song title to get composer and ISWC
        const firstRow = parsedData.find(r => r.songTitle === songTitle);
        
        // Create new track
        const trackData: any = {
          artist_id: artistId,
          song_title: songTitle || "Unknown",
          artist_name: "", // Will be populated from artist record
          split: "100%",
        };
        
        // Only include composer_name and isrc if they have values
        if (firstRow?.composer && firstRow.composer.trim() !== "") {
          trackData.composer_name = firstRow.composer;
        }
        
        if (firstRow?.iswc && firstRow.iswc.trim() !== "") {
          trackData.isrc = firstRow.iswc;
        }
        
        // If title column exists, populate it too (for backward compatibility)
        if (songTitle) {
          trackData.title = songTitle;
        }

        const { data: newTrack, error: trackError } = await supabaseAdmin
          .from("tracks")
          .insert(trackData)
          .select()
          .single();

        if (trackError) {
          console.error("Track creation error:", trackError);
          return NextResponse.json(
            { success: false, error: "Failed to create track", details: trackError.message },
            { status: 500 }
          );
        }
        
        tracksByTitle.set(songTitle, newTrack.id);
      }
    }

    console.log(`✅ Processed ${tracksByTitle.size} tracks`);

    // Step 5: Prepare royalty records
    const royaltiesToInsert = parsedData.map((row) => ({
      track_id: tracksByTitle.get(row.songTitle),
      artist_id: artistId,
      usage_count: row.usageCount,
      gross_amount: row.gross,
      admin_percent: row.adminPercent,
      net_amount: row.net,
      broadcast_date: row.date || null,
      exploitation_source_name: row.source,
      territory: row.territory,
    }));
    const BATCH_SIZE = 1000;
    let totalInserted = 0;

    console.log(`💾 Inserting ${royaltiesToInsert.length} royalty records in batches of ${BATCH_SIZE}...`);

    for (let i = 0; i < royaltiesToInsert.length; i += BATCH_SIZE) {
      const batch = royaltiesToInsert.slice(i, i + BATCH_SIZE);
      
      const { error: insertError } = await supabaseAdmin
        .from("royalties")
        .insert(batch);

      if (insertError) {
        console.error(`Batch insertion error at index ${i}:`, insertError);
        return NextResponse.json(
          { 
            success: false, 
            error: "Failed to insert royalties batch", 
            details: insertError.message,
            inserted: totalInserted 
          },
          { status: 500 }
        );
      }

      totalInserted += batch.length;
      console.log(`✅ Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} records (total: ${totalInserted})`);
    }

    console.log(`🎉 Successfully inserted ${totalInserted} royalty records`);

    // Optionally delete the uploaded file from storage after successful processing
    // await supabaseAdmin.storage.from("royalties").remove([filePath]);

    return NextResponse.json(
      { success: true, inserted: totalInserted },
      { status: 200 }
    );

  } catch (error: any) {
    console.error("❌ Ingestion error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", details: error?.message },
      { status: 500 }
    );
  }
}
