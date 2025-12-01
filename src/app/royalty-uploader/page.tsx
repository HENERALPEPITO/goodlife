"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Upload, AlertCircle, FileText, Download, Loader2 } from "lucide-react";
import Papa from "papaparse";


export default function RoyaltyUploaderPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  const [artists, setArtists] = useState<Array<{ id: string; email: string; name: string }>>([]);
  const [selectedArtist, setSelectedArtist] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loadingArtists, setLoadingArtists] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<string>("");

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
        .order("name");

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
    if (!file) {
      setSelectedFile(null);
      return;
    }

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Invalid File",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
      setSelectedFile(null);
      return;
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File Too Large",
        description: "File size must be less than 50MB",
        variant: "destructive",
      });
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    toast({
      title: "File Selected",
      description: `${file.name} (${(file.size / 1024).toFixed(2)} KB)`,
    });
  };

  const parseCSV = (file: File): Promise<Record<string, string>[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false, // Keep all values as strings for precision
        complete: (results) => {
          resolve(results.data as Record<string, string>[]);
        },
        error: (error: Error) => {
          reject(error);
        },
      });
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

    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a CSV file first",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadProgress("Parsing CSV file...");

    try {
      // Step 1: Parse CSV client-side with PapaParse
      const parsedRows = await parseCSV(selectedFile);
      
      if (parsedRows.length === 0) {
        throw new Error('CSV file has no data rows');
      }
      
      console.log(`Parsed ${parsedRows.length} rows from CSV`);
      setUploadProgress(`Processing ${parsedRows.length} rows...`);

      // Step 2: Send parsed data directly to API (uses Big.js for precision)
      const response = await fetch("/api/royalties/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          artistId: selectedArtist,
          rows: parsedRows,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || result.details || "Failed to process CSV");
      }

      // Step 3: Success!
      toast({
        title: "Upload Successful",
        description: `Successfully processed ${result.inserted} royalty records`,
      });

      // Reset form
      setSelectedFile(null);
      setSelectedArtist("");
      setUploadProgress("");
      const fileInput = document.getElementById("csv-file-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (error: any) {
      console.error("Upload error:", error);
      
      toast({
        title: "Upload Failed",
        description: error?.message || "Unknown error occurred",
        variant: "destructive",
      });
      setUploadProgress("");
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const header = ["Song Title", "ISWC", "Composer", "Date", "Territory", "Source", "Usage Count", "Gross", "Admin %", "Net"];
    const exampleRow = ["My Song Title", "T-123.456.789-0", "John Doe", "2024-01-15", "US", "Spotify", "1000", "100.00", "15", "85.00"];
    const csv = [header, exampleRow].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "royalty-upload-template.csv";
    a.click();
    URL.revokeObjectURL(url);
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
              className="text-sm font-mono p-3 rounded transition-colors mb-4"
              style={{
                color: isDark ? '#BFDBFE' : '#1E40AF',
                backgroundColor: isDark ? 'rgba(30, 58, 138, 0.3)' : '#BFDBFE',
              }}
            >
              Song Title, ISWC, Composer, Date, Territory, Source, Usage Count, Gross, Admin %, Net
            </div>
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-all duration-200 hover:opacity-90"
              style={{
                backgroundColor: '#3B82F6',
                color: '#FFFFFF',
              }}
            >
              <Download className="h-4 w-4" />
              Download CSV Template
            </button>
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
                  {artist.name}
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

      {/* File Selected and Upload Button */}
      {selectedFile && (
        <section 
          className="rounded-lg border p-6 transition-colors"
          style={{
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 transition-colors" style={{ color: '#3B82F6' }} />
              <div>
                <h3 className="font-semibold transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>
                  {selectedFile.name}
                </h3>
                <p className="text-sm transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
            </div>
            
            <Button
              onClick={handleUpload}
              disabled={uploading || !selectedArtist}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload & Process
                </>
              )}
            </Button>
          </div>

          {uploadProgress && (
            <div 
              className="mt-4 p-3 rounded transition-colors"
              style={{
                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#DBEAFE',
                color: isDark ? '#DBEAFE' : '#1E40AF',
              }}
            >
              {uploadProgress}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
