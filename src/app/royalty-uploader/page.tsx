"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
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
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  const [artists, setArtists] = useState<Array<{ id: string; email: string; name: string }>>([]);
  const [selectedArtist, setSelectedArtist] = useState<string>("");
  const [parsedData, setParsedData] = useState<ParsedRoyaltyData[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loadingArtists, setLoadingArtists] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === "dark";

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
      // Fetch from artists table (not user_profiles) to get the correct artist_id
      const { data, error } = await supabase
        .from("artists")
        .select("id, name, email, user_id")
        .order("email");

      if (error) throw error;
      
      // Map to the format expected by the component
      const artistList = (data || []).map(artist => ({
        id: artist.id, // Use artist.id (from artists table), not user_id
        email: artist.email || artist.name || "Unknown",
        name: artist.name || artist.email || "Unknown",
      }));
      
      setArtists(artistList as any);
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
          // Debug: Log available column names from first row
          if (results.data && results.data.length > 0) {
            const firstRow = results.data[0] as Record<string, string>;
            console.log("📋 Available CSV columns:", Object.keys(firstRow));
          }

          // Helper function to get column value with multiple possible names (case-insensitive)
          const getColumn = (row: Record<string, string>, possibleNames: string[]) => {
            // First try exact match
            for (const name of possibleNames) {
              if (row[name] !== undefined && row[name] !== null && row[name] !== "") {
                return row[name];
              }
            }
            // Then try case-insensitive match
            const rowKeys = Object.keys(row);
            for (const name of possibleNames) {
              const foundKey = rowKeys.find(key => key.toLowerCase() === name.toLowerCase());
              if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== "") {
                return row[foundKey];
              }
            }
            return "";
          };

          const parsed = (results.data as Record<string, string>[]).map((row) => ({
            songTitle: getColumn(row, ["Song Title", "song title", "Song Title", "title", "Title"]) || "",
            iswc: getColumn(row, ["ISWC", "iswc", "Iswc", "ISWC Code", "ISWC Code"]) || "",
            composer: getColumn(row, ["Composer", "composer", "Composer Name", "Composer"]) || "",
            date: getColumn(row, ["Date", "date", "Broadcast Date", "broadcast_date"]) || "",
            territory: getColumn(row, ["Territory", "territory"]) || "",
            source: getColumn(row, ["Source", "source", "Platform", "platform", "Exploitation Source"]) || "",
            usageCount: parseInt(getColumn(row, ["Usage Count", "usage count", "Usage Cou", "Usage", "usage"]) || "0") || 0,
            gross: parseFloat(getColumn(row, ["Gross", "gross", "Gross Amount", "Gross"]) || "0") || 0,
            adminPercent: parseFloat(getColumn(row, ["Admin %", "admin %", "Admin %", "Admin Percent", "Admin %"]) || "0") || 0,
            net: parseFloat(getColumn(row, ["Net", "net", "Net Amount", "Net"]) || "0") || 0,
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
          .eq("song_title", row.songTitle)
          .eq("artist_id", selectedArtist)
          .maybeSingle();

        if (existingTrack) {
          trackId = existingTrack.id;
        } else {
          // Create new track
          const trackData: any = {
            artist_id: selectedArtist,
            song_title: row.songTitle || "Unknown",
            artist_name: "", // Will be populated from artist record
            split: "100%",
            uploaded_by: user.id,
          };
          
          // Only include composer_name and isrc if they have values
          if (row.composer && row.composer.trim() !== "") {
            trackData.composer_name = row.composer;
          }
          
          if (row.iswc && row.iswc.trim() !== "") {
            trackData.isrc = row.iswc;
          }
          
          // If title column exists, populate it too (for backward compatibility)
          if (row.songTitle) {
            trackData.title = row.songTitle;
          }

          const { data: newTrack, error: trackError } = await supabase
            .from("tracks")
            .insert(trackData)
            .select()
            .single();

          if (trackError) {
            console.error("Track creation error:", trackError);
            throw trackError;
          }
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
    } catch (error: any) {
      console.error("Upload error:", error);
      console.error("Error details:", {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
      });
      
      const errorMessage = error?.message || "Unknown error occurred";
      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  if (loading || loadingArtists) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Loading...</div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>CSV Royalty Uploader</h1>
        <p className="text-sm mt-1 transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
          Upload royalty data from CSV files and assign to artists
        </p>
      </div>

      {/* CSV Format Info */}
      <section 
        className="rounded-lg border p-6 transition-colors"
        style={{
          backgroundColor: isDark ? 'rgba(30, 58, 138, 0.2)' : '#DBEAFE',
          borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : '#93C5FD',
        }}
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5 transition-colors" style={{ color: '#3B82F6' }} />
            <div>
            <h3 className="font-semibold mb-2 transition-colors" style={{ color: isDark ? '#DBEAFE' : '#1E3A8A' }}>
              Required CSV Format
            </h3>
            <p className="text-sm mb-2 transition-colors" style={{ color: isDark ? '#BFDBFE' : '#1E40AF' }}>
              Your CSV file must include the following columns (in any order):
            </p>
            <div 
              className="text-sm font-mono p-3 rounded transition-colors"
              style={{
                color: isDark ? '#BFDBFE' : '#1E40AF',
                backgroundColor: isDark ? 'rgba(30, 58, 138, 0.3)' : '#BFDBFE',
              }}
            >
              Song Title, ISWC, Composer, Date, Territory, Source, Usage Count, Gross, Admin %, Net
            </div>
          </div>
        </div>
      </section>

      {/* Upload Form */}
      <section 
        className="rounded-lg border p-6 transition-colors"
        style={{
          backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}
      >
        <h2 className="text-lg font-semibold mb-4 transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>Upload Royalty Data</h2>
        
        <div className="space-y-4">
          {/* Artist Selection */}
          <div>
            <label className="block text-sm font-medium mb-2 transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>
              Select Artist
            </label>
            <select
              value={selectedArtist}
              onChange={(e) => setSelectedArtist(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border transition-colors"
              style={{
                backgroundColor: isDark ? '#374151' : '#FFFFFF',
                color: isDark ? '#FFFFFF' : '#1F2937',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
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
            <label className="block text-sm font-medium mb-2 transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>
              Upload CSV File
            </label>
            <input
              id="csv-file-input"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="w-full px-3 py-2 rounded-lg border transition-colors"
              style={{
                backgroundColor: isDark ? '#374151' : '#FFFFFF',
                color: isDark ? '#FFFFFF' : '#1F2937',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            />
          </div>
        </div>
      </section>

      {/* Preview */}
      {parsedData.length > 0 && (
        <section 
          className="rounded-lg border overflow-hidden transition-colors"
          style={{
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <div 
            className="px-6 py-4 border-b flex items-center justify-between transition-colors"
            style={{
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
          >
            <h2 className="text-lg font-semibold transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>Preview ({parsedData.length} rows)</h2>
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
            <table className="min-w-full divide-y transition-colors">
              <thead 
                className="transition-colors"
                style={{
                  backgroundColor: isDark ? 'rgba(31, 41, 55, 0.5)' : '#F9FAFB',
                }}
              >
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Song Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>ISWC</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Composer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Territory</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Source</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Usage</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Gross</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Admin %</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Net</th>
                </tr>
              </thead>
              <tbody className="divide-y transition-colors" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
                {parsedData.slice(0, 10).map((row, idx) => (
                  <tr key={idx} className="transition-colors">
                    <td className="px-4 py-3 text-sm transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>{row.songTitle}</td>
                    <td className="px-4 py-3 text-sm transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>{row.iswc}</td>
                    <td className="px-4 py-3 text-sm transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>{row.composer}</td>
                    <td className="px-4 py-3 text-sm transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>{row.date}</td>
                    <td className="px-4 py-3 text-sm transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>{row.territory}</td>
                    <td className="px-4 py-3 text-sm transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>{row.source}</td>
                    <td className="px-4 py-3 text-sm transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>{row.usageCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>€{row.gross.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>{row.adminPercent}%</td>
                    <td className="px-4 py-3 text-sm font-semibold transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>€{row.net.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
      </div>

          {parsedData.length > 10 && (
            <div 
              className="px-6 py-3 text-sm text-center transition-colors"
              style={{
                backgroundColor: isDark ? 'rgba(31, 41, 55, 0.5)' : '#F9FAFB',
                color: isDark ? '#9CA3AF' : '#6B7280',
              }}
            >
              Showing first 10 of {parsedData.length} rows
            </div>
          )}
        </section>
      )}
    </div>
  );
}
