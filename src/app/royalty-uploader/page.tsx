"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import Papa from "papaparse";
import { Upload, AlertCircle } from "lucide-react";
import type { UserProfile } from "@/types";

interface ParsedRoyaltyData {
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

export default function RoyaltyUploaderPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [artists, setArtists] = useState<UserProfile[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<string>("");
  const [parsedData, setParsedData] = useState<ParsedRoyaltyData[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loadingArtists, setLoadingArtists] = useState(true);

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.push("/");
    } else if (user && user.role === "admin") {
      fetchArtists();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, router]);

  const fetchArtists = async () => {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("role", "artist")
        .order("email");

      if (error) throw error;
      setArtists(data || []);
    } catch (error) {
      console.error("Error fetching artists:", error);
      toast({
        title: "Error",
        description: "Failed to fetch artists list",
        variant: "destructive",
      });
    } finally {
      setLoadingArtists(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
        header: true, 
        skipEmptyLines: true,
      complete: (results) => {
        try {
          const parsed = (results.data as Record<string, string>[]).map((row) => ({
            songTitle: row["Song Title"] || "",
            iswc: row["ISWC"] || "",
            composer: row["Composer"] || "",
            date: row["Date"] || "",
            territory: row["Territory"] || "",
            source: row["Source"] || "",
            usageCount: parseInt(row["Usage Count"]) || 0,
            gross: parseFloat(row["Gross"]) || 0,
            adminPercent: parseFloat(row["Admin %"]) || 0,
            net: parseFloat(row["Net"]) || 0,
          }));

          setParsedData(parsed);
          toast({
            title: "CSV Parsed",
            description: `Successfully parsed ${parsed.length} rows`,
          });
        } catch (error) {
          console.error("Error parsing CSV:", error);
          toast({
            title: "Parse Error",
            description: "Failed to parse CSV file. Check the format.",
            variant: "destructive",
          });
        }
      },
      error: (error) => {
        console.error("Papa parse error:", error);
        toast({
          title: "Parse Error",
          description: "Failed to read CSV file",
          variant: "destructive",
        });
      },
    });
  };

  const handleUpload = async () => {
    if (!selectedArtist) {
      toast({
        title: "No Artist Selected",
        description: "Please select an artist to associate these royalties with",
        variant: "destructive",
      });
      return;
    }

    if (parsedData.length === 0) {
      toast({
        title: "No Data",
        description: "Please upload a CSV file first",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Group by song title to create/find tracks
      const tracksByTitle = new Map<string, string>();

      for (const row of parsedData) {
        // Check if track exists or create new one
        let trackId: string;

        const { data: existingTrack } = await supabase
          .from("tracks")
          .select("id")
          .eq("title", row.songTitle)
          .eq("artist_id", selectedArtist)
          .single();

        if (existingTrack) {
          trackId = existingTrack.id;
        } else {
          // Create new track
          const { data: newTrack, error: trackError } = await supabase
            .from("tracks")
            .insert({
              artist_id: selectedArtist,
              title: row.songTitle,
              iswc: row.iswc,
              composers: row.composer,
              release_date: row.date || null,
              territory: row.territory,
              platform: row.source,
            })
            .select()
            .single();

          if (trackError) throw trackError;
          trackId = newTrack.id;
        }

        tracksByTitle.set(row.songTitle, trackId);
      }

      // Now insert royalties
      const royaltiesToInsert = parsedData.map((row) => ({
        track_id: tracksByTitle.get(row.songTitle),
        artist_id: selectedArtist,
        usage_count: row.usageCount,
        gross_amount: row.gross,
        admin_percent: row.adminPercent,
        net_amount: row.net,
        broadcast_date: row.date || null,
        exploitation_source_name: row.source,
        territory: row.territory,
      }));

      const { error: royaltiesError } = await supabase
        .from("royalties")
        .insert(royaltiesToInsert);

      if (royaltiesError) throw royaltiesError;

      toast({
        title: "Upload Successful",
        description: `Successfully uploaded ${parsedData.length} royalty records`,
      });

      // Reset form
      setParsedData([]);
      setSelectedArtist("");
      const fileInput = document.getElementById("csv-file-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload royalty data. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  if (loading || loadingArtists) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-zinc-500">Loading...</div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">CSV Royalty Uploader</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          Upload royalty data from CSV files and assign to artists
        </p>
      </div>

      {/* CSV Format Info */}
      <section className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Required CSV Format
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
              Your CSV file must include the following columns (in any order):
            </p>
            <div className="text-sm text-blue-700 dark:text-blue-300 font-mono bg-blue-100 dark:bg-blue-900/50 p-3 rounded">
              Song Title, ISWC, Composer, Date, Territory, Source, Usage Count, Gross, Admin %, Net
            </div>
          </div>
        </div>
      </section>

      {/* Upload Form */}
      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 bg-white dark:bg-zinc-950">
        <h2 className="text-lg font-semibold mb-4">Upload Royalty Data</h2>
        
        <div className="space-y-4">
          {/* Artist Selection */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Select Artist
            </label>
            <select
              value={selectedArtist}
              onChange={(e) => setSelectedArtist(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
            >
              <option value="">-- Choose an artist --</option>
              {artists.map((artist) => (
                <option key={artist.id} value={artist.id}>
                  {artist.email}
                </option>
              ))}
            </select>
      </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Upload CSV File
            </label>
            <input
              id="csv-file-input"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-300"
            />
          </div>
        </div>
      </section>

      {/* Preview */}
      {parsedData.length > 0 && (
        <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Preview ({parsedData.length} rows)</h2>
            <Button
              onClick={handleUpload}
              disabled={uploading || !selectedArtist}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {uploading ? (
                <>Uploading...</>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload to Database
                </>
              )}
            </Button>
          </div>
          
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Song Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">ISWC</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Composer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Territory</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Usage</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Gross</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Admin %</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Net</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-zinc-950 divide-y divide-zinc-200 dark:divide-zinc-800">
                {parsedData.slice(0, 10).map((row, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100">{row.songTitle}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">{row.iswc}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">{row.composer}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">{row.date}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">{row.territory}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">{row.source}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">{row.usageCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">${row.gross.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">{row.adminPercent}%</td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400 font-semibold">${row.net.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
      </div>

          {parsedData.length > 10 && (
            <div className="px-6 py-3 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-600 dark:text-zinc-400 text-center">
              Showing first 10 of {parsedData.length} rows
            </div>
          )}
        </section>
      )}
    </div>
  );
}
