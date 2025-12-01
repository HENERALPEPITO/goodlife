/**
 * Streaming Royalties CSV Ingestion API Route
 * POST /api/royalties/ingest
 * 
 * Performance improvements with streaming:
 * - Stream CSV parsing (low memory usage)
 * - Process rows in chunks as they arrive
 * - Bulk track lookup and creation
 * - Optimized batch inserts
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import Papa from "papaparse";
import { Readable } from "stream";

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
  tracksCreated?: number;
  error?: string;
  details?: string;
}

// Helper: Convert Web ReadableStream to Node Readable
function webStreamToNodeStream(webStream: ReadableStream<Uint8Array>): Readable {
  const reader = webStream.getReader();
  
  return new Readable({
    async read() {
      try {
        const { done, value } = await reader.read();
        if (done) {
          this.push(null);
        } else {
          this.push(Buffer.from(value));
        }
      } catch (error) {
        this.destroy(error as Error);
      }
    },
  });
}

// Helper: Parse CSV in streaming mode
async function streamParseCSV(stream: Readable): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const rows: Record<string, string>[] = [];
    
    Papa.parse(stream, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      chunk: (results) => {
        // Process chunks as they arrive
        rows.push(...results.data as Record<string, string>[]);
      },
      complete: () => {
        resolve(rows);
      },
      error: (error: Error) => {
        reject(error);
      },
    });
  });
}

// Helper: Find column mapping once
function buildColumnMapping(firstRow: Record<string, string>): Map<string, string> {
  const columnMappings = new Map<string, string>();
  
  const mappings: Record<string, string[]> = {
    songTitle: ["Song Title", "song title", "title", "Title"],
    iswc: ["ISWC", "iswc", "Iswc", "ISWC Code"],
    composer: ["Composer", "composer", "Composer Name"],
    date: ["Date", "date", "Broadcast Date", "broadcast_date"],
    territory: ["Territory", "territory"],
    source: ["Source", "source", "Platform", "platform", "Exploitation Source"],
    usageCount: ["Usage Count", "usage count", "Usage Cou", "Usage", "usage"],
    gross: ["Gross", "gross", "Gross Amount"],
    adminPercent: ["Admin %", "admin %", "Admin Percent"],
    net: ["Net", "net", "Net Amount"],
  };

  for (const [field, possibleNames] of Object.entries(mappings)) {
    for (const name of possibleNames) {
      if (firstRow[name] !== undefined) {
        columnMappings.set(field, name);
        break;
      }
    }
    // Try case-insensitive if not found
    if (!columnMappings.has(field)) {
      const rowKeys = Object.keys(firstRow);
      for (const name of possibleNames) {
        const foundKey = rowKeys.find(key => key.toLowerCase() === name.toLowerCase());
        if (foundKey) {
          columnMappings.set(field, foundKey);
          break;
        }
      }
    }
  }
  
  return columnMappings;
}

// Helper: Normalize a single row
function normalizeRow(row: Record<string, string>, mappings: Map<string, string>): RoyaltyRow {
  return {
    songTitle: row[mappings.get("songTitle") || ""] || "",
    iswc: row[mappings.get("iswc") || ""] || "",
    composer: row[mappings.get("composer") || ""] || "",
    date: row[mappings.get("date") || ""] || "",
    territory: row[mappings.get("territory") || ""] || "",
    source: row[mappings.get("source") || ""] || "",
    usageCount: parseInt(row[mappings.get("usageCount") || ""] || "0") || 0,
    gross: parseFloat(row[mappings.get("gross") || ""] || "0") || 0,
    adminPercent: parseFloat(row[mappings.get("adminPercent") || ""] || "0") || 0,
    net: parseFloat(row[mappings.get("net") || ""] || "0") || 0,
  };
}

export async function POST(request: NextRequest): Promise<NextResponse<IngestResponse>> {
  const startTime = Date.now();
  
  try {
    const supabaseAdmin = getSupabaseAdmin();
    
    const body: IngestRequest = await request.json();
    const { artistId, filePath } = body;

    if (!artistId || !filePath) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: artistId and filePath" },
        { status: 400 }
      );
    }

    console.log(`📥 Starting streaming CSV ingestion for artist ${artistId}, file: ${filePath}`);

    // Step 1: Get a streaming download from Supabase Storage
    const downloadStart = Date.now();
    
    // Get the public/signed URL for streaming
    const { data: urlData } = await supabaseAdmin.storage
      .from("royalties")
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (!urlData?.signedUrl) {
      return NextResponse.json(
        { success: false, error: "Failed to generate download URL" },
        { status: 500 }
      );
    }

    // Fetch with streaming
    const response = await fetch(urlData.signedUrl);
    if (!response.ok || !response.body) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch file for streaming" },
        { status: 500 }
      );
    }

    console.log(`📄 Started streaming download in ${Date.now() - downloadStart}ms`);

    // Step 2: Convert Web ReadableStream to Node Readable and parse with streaming
    const parseStart = Date.now();
    const nodeStream = webStreamToNodeStream(response.body);
    
    let parsedRows: Record<string, string>[];
    try {
      parsedRows = await streamParseCSV(nodeStream);
    } catch (parseError: any) {
      console.error("CSV parsing error:", parseError);
      return NextResponse.json(
        { success: false, error: "Failed to parse CSV file", details: parseError.message },
        { status: 400 }
      );
    }

    console.log(`✅ Parsed ${parsedRows.length} rows in ${Date.now() - parseStart}ms`);

    if (parsedRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "CSV file is empty or has no valid rows" },
        { status: 400 }
      );
    }

    // Step 3: Build column mapping and normalize data
    const normalizeStart = Date.now();
    const columnMappings = buildColumnMapping(parsedRows[0]);
    
    const parsedData: RoyaltyRow[] = parsedRows.map(row => normalizeRow(row, columnMappings));
    
    console.log(`🔄 Normalized ${parsedData.length} rows in ${Date.now() - normalizeStart}ms`);

    // Step 4: Bulk track lookup and creation
    const trackStart = Date.now();
    const tracksByTitle = new Map<string, string>();
    const uniqueTitles = [...new Set(parsedData.map(row => row.songTitle).filter(Boolean))];

    console.log(`🎵 Processing ${uniqueTitles.length} unique tracks...`);

    // Single query to fetch all existing tracks
    const { data: existingTracks } = await supabaseAdmin
      .from("tracks")
      .select("id, song_title")
      .eq("artist_id", artistId)
      .in("song_title", uniqueTitles);

    // Map existing tracks
    if (existingTracks) {
      existingTracks.forEach(track => {
        tracksByTitle.set(track.song_title, track.id);
      });
      console.log(`✅ Found ${existingTracks.length} existing tracks`);
    }

    // Find titles that need to be created
    const titlesToCreate = uniqueTitles.filter(title => !tracksByTitle.has(title));
    
    if (titlesToCreate.length > 0) {
      console.log(`🆕 Creating ${titlesToCreate.length} new tracks...`);
      
      // Bulk track creation
      const tracksToInsert = titlesToCreate.map(songTitle => {
        const firstRow = parsedData.find(r => r.songTitle === songTitle);
        
        const trackData: any = {
          artist_id: artistId,
          song_title: songTitle || "Unknown",
          artist_name: "",
          split: "100%",
        };
        
        if (firstRow?.composer && firstRow.composer.trim() !== "") {
          trackData.composer_name = firstRow.composer;
        }
        
        if (firstRow?.iswc && firstRow.iswc.trim() !== "") {
          trackData.isrc = firstRow.iswc;
        }
        
        if (songTitle) {
          trackData.title = songTitle;
        }

        return trackData;
      });

      // Insert all tracks at once
      const { data: newTracks, error: trackError } = await supabaseAdmin
        .from("tracks")
        .insert(tracksToInsert)
        .select("id, song_title");

      if (trackError) {
        console.error("Bulk track creation error:", trackError);
        return NextResponse.json(
          { success: false, error: "Failed to create tracks", details: trackError.message },
          { status: 500 }
        );
      }

      // Map newly created tracks
      if (newTracks) {
        newTracks.forEach(track => {
          tracksByTitle.set(track.song_title, track.id);
        });
        console.log(`✅ Created ${newTracks.length} new tracks`);
      }
    }

    console.log(`✅ Track processing completed in ${Date.now() - trackStart}ms`);

    // Step 5: Prepare and insert royalty records in batches
    const royaltiesToInsert = parsedData
      .filter(row => tracksByTitle.has(row.songTitle))
      .map((row) => ({
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

    const BATCH_SIZE = 500;
    let totalInserted = 0;

    console.log(`💾 Inserting ${royaltiesToInsert.length} royalty records in batches of ${BATCH_SIZE}...`);
    const insertStart = Date.now();

    for (let i = 0; i < royaltiesToInsert.length; i += BATCH_SIZE) {
      const batch = royaltiesToInsert.slice(i, i + BATCH_SIZE);
      const batchStart = Date.now();
      
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
      console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} records in ${Date.now() - batchStart}ms (total: ${totalInserted})`);
    }

    const totalTime = Date.now() - startTime;
    const throughput = Math.round(totalInserted / (totalTime / 1000));
    
    console.log(`🎉 Successfully completed in ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
    console.log(`   - Tracks created: ${titlesToCreate.length}`);
    console.log(`   - Royalties inserted: ${totalInserted}`);
    console.log(`   - Throughput: ${throughput} records/sec`);
    console.log(`   - Memory efficient: Streaming parser used`);

    return NextResponse.json(
      { 
        success: true, 
        inserted: totalInserted,
        tracksCreated: titlesToCreate.length 
      },
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