"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Upload, AlertCircle, FileText, Download, Loader2, Calendar, History } from "lucide-react";
import { uploadCsvToStorage } from "@/lib/royalty-storage";
import type { CsvUploadRecord } from "@/types/royalty-summary";


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
  
  // Year and Quarter selection (required before upload)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState<number>(Math.ceil((new Date().getMonth() + 1) / 3));
  
  // Upload history
  const [uploadHistory, setUploadHistory] = useState<CsvUploadRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Generate year options (current year and 5 years back)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => currentYear - i);
  }, []);
  
  const quarterOptions = [1, 2, 3, 4];

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === "dark";

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.push("/");
    } else if (user && user.role === "admin") {
      fetchArtists();
      fetchUploadHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, router]);

  // Fetch upload history when artist changes
  useEffect(() => {
    if (selectedArtist) {
      fetchUploadHistory();
    }
  }, [selectedArtist]);

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

  const fetchUploadHistory = async () => {
    if (!selectedArtist) return;
    
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("csv_uploads")
        .select("*")
        .eq("artist_id", selectedArtist)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        // Table might not exist yet if migration hasn't been run
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          console.warn("csv_uploads table not found - run the migration first");
        } else {
          console.warn("Error fetching upload history:", error.message || error);
        }
        setUploadHistory([]);
        return;
      }
      setUploadHistory(data || []);
    } catch (error: any) {
      // Silently fail - history is not critical, table may not exist
      console.warn("Upload history unavailable:", error?.message || "Table may not exist yet");
      setUploadHistory([]);
    } finally {
      setLoadingHistory(false);
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

  const handleUpload = async () => {
    if (!selectedArtist || !selectedFile) {
      toast({
        title: "Missing Information",
        description: "Please select an artist, year, quarter, and CSV file",
        variant: "destructive",
      });
      return;
    }

    if (!selectedYear || !selectedQuarter) {
      toast({
        title: "Missing Period",
        description: "Please select both year and quarter for this royalty data",
        variant: "destructive",
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Authentication Error",
        description: "Please sign in again",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadProgress("Uploading CSV to storage...");

    try {
      // Step 1: Upload to Supabase Storage (uses userId folder per RLS policy)
      const uploadResult = await uploadCsvToStorage(selectedFile, user.id);

      if (!uploadResult.success || !uploadResult.path) {
        throw new Error(`Upload failed: ${uploadResult.error}`);
      }

      console.log(`✅ Uploaded to storage: ${uploadResult.path}`);
      setUploadProgress("Computing royalty summaries...");

      // Step 2: Trigger summary processing via new API (with year/quarter)
      const response = await fetch("/api/process-royalties-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          artistId: selectedArtist,
          storagePath: uploadResult.path,
          filename: selectedFile.name,
          fileSize: selectedFile.size,
          year: selectedYear,
          quarter: selectedQuarter,
          batchConfig: {
            batchSize: 500,
            maxConcurrency: 3,
            retryAttempts: 3,
          },
        }),
      });

      const result = await response.json();
      console.log("API Response:", result);

      if (!response.ok || !result.success) {
        // Get detailed error message
        const errorMsg = result.error 
          || result.computation?.errors?.join(", ")
          || result.message
          || `Processing failed (status: ${response.status})`;
        throw new Error(errorMsg);
      }

      // Step 3: Success!
      const computation = result.computation;
      toast({
        title: "Upload Successful",
        description: `Processed ${computation?.totalRows || 0} rows into ${computation?.summariesCreated || 0} summary records for Q${selectedQuarter} ${selectedYear}`,
      });

      // Step 4: Optionally download failed rows CSV
      if (result.failedRowsCsv) {
        const blob = new Blob([result.failedRowsCsv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `failed-rows-Q${selectedQuarter}-${selectedYear}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        toast({
          title: "Failed Rows Downloaded",
          description: "Some rows failed validation - check downloaded CSV",
          variant: "destructive",
        });
      }

      // Reset form (keep artist and period for convenience)
      setSelectedFile(null);
      setUploadProgress("");
      const fileInput = document.getElementById("csv-file-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      
      // Refresh upload history
      fetchUploadHistory();

    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: error?.message || "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress("");
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

          {/* Year and Quarter Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>
                <Calendar className="inline-block h-4 w-4 mr-1" />
                Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border transition-colors"
                style={{
                  backgroundColor: isDark ? '#374151' : '#FFFFFF',
                  color: isDark ? '#FFFFFF' : '#1F2937',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>
                Quarter
              </label>
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border transition-colors"
                style={{
                  backgroundColor: isDark ? '#374151' : '#FFFFFF',
                  color: isDark ? '#FFFFFF' : '#1F2937',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                {quarterOptions.map((q) => (
                  <option key={q} value={q}>
                    Q{q} ({q === 1 ? 'Jan-Mar' : q === 2 ? 'Apr-Jun' : q === 3 ? 'Jul-Sep' : 'Oct-Dec'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Period Summary */}
          <div 
            className="p-3 rounded-lg text-sm"
            style={{
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#D1FAE5',
              color: isDark ? '#6EE7B7' : '#065F46',
            }}
          >
            Uploading royalty data for: <strong>Q{selectedQuarter} {selectedYear}</strong>
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
              disabled={uploading || !selectedArtist || !selectedYear || !selectedQuarter}
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

      {/* Upload History */}
      {selectedArtist && (
        <section 
          className="rounded-lg border p-6 transition-colors"
          style={{
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <History className="h-5 w-5" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }} />
            <h2 className="text-lg font-semibold transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>
              Recent Uploads for this Artist
            </h2>
          </div>

          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }} />
            </div>
          ) : uploadHistory.length === 0 ? (
            <p className="text-sm py-4" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
              No previous uploads found for this artist.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
                    <th className="text-left py-2 px-2 font-medium" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Filename</th>
                    <th className="text-left py-2 px-2 font-medium" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Period</th>
                    <th className="text-left py-2 px-2 font-medium" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Status</th>
                    <th className="text-left py-2 px-2 font-medium" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadHistory.map((upload) => (
                    <tr 
                      key={upload.id} 
                      style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}
                    >
                      <td className="py-2 px-2" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>
                        {upload.filename}
                      </td>
                      <td className="py-2 px-2" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>
                        Q{upload.quarter} {upload.year}
                      </td>
                      <td className="py-2 px-2">
                        <span 
                          className="px-2 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: upload.processing_status === 'completed' 
                              ? (isDark ? 'rgba(16, 185, 129, 0.2)' : '#D1FAE5')
                              : upload.processing_status === 'failed'
                              ? (isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2')
                              : (isDark ? 'rgba(251, 191, 36, 0.2)' : '#FEF3C7'),
                            color: upload.processing_status === 'completed'
                              ? (isDark ? '#6EE7B7' : '#065F46')
                              : upload.processing_status === 'failed'
                              ? (isDark ? '#FCA5A5' : '#991B1B')
                              : (isDark ? '#FCD34D' : '#92400E'),
                          }}
                        >
                          {upload.processing_status}
                        </span>
                      </td>
                      <td className="py-2 px-2" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
                        {new Date(upload.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
