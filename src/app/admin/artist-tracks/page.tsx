"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Search, Trash2, Edit, ArrowUpDown, AlertCircle, Download, AlertTriangle, CheckCircle, XCircle, Loader2, Info } from "lucide-react";
import { parseCatalogCsv, CatalogCsvRow } from "@/lib/catalogCsv";
import { useTheme } from "next-themes";

// Required columns for Track Catalog CSV validation
const CATALOG_REQUIRED_COLUMNS = [
  { key: "songTitle", label: "Song Title", variations: ["Song Title", "song title", "title", "Title", "SongTitle", "song_title"] },
  { key: "composerName", label: "Composer Name", variations: ["Composer Name", "composer name", "Composer", "composer", "composer_name"] },
  { key: "isrc", label: "ISRC", variations: ["ISRC", "isrc", "Isrc"] },
  { key: "artist", label: "Artist", variations: ["Artist", "artist", "Artist Name", "artist_name"] },
  { key: "split", label: "Split", variations: ["Split", "split", "Split %", "split_percent"] },
];

interface CatalogColumnValidationResult {
  isValid: boolean;
  foundColumns: { key: string; label: string; matchedHeader: string }[];
  missingColumns: { key: string; label: string }[];
  csvHeaders: string[];
}

interface Artist {
  id: string;
  name: string;
}

interface TrackRow {
  id: string;
  song_title: string;
  composer_name: string;
  isrc: string;
  artist_name: string;
  split: string;
  created_at: string;
}

export default function ArtistTrackManagerPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [artists, setArtists] = useState<Artist[]>([]);
  const [selectedArtistId, setSelectedArtistId] = useState<string>("");
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CatalogCsvRow[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [editRow, setEditRow] = useState<TrackRow | null>(null);
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<keyof TrackRow | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const pageSize = 20;
  
  // Column validation state
  const [columnValidation, setColumnValidation] = useState<CatalogColumnValidationResult | null>(null);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validatingFile, setValidatingFile] = useState(false);
  const [showDuplicateWarningModal, setShowDuplicateWarningModal] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === "dark";

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) router.push("/");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.role === "admin") {
      void fetchArtists();
    }
  }, [user]);

  useEffect(() => {
    if (selectedArtistId) {
      void fetchTracks();
      setPage(1);
    } else {
      setTracks([]);
    }
  }, [selectedArtistId]);

  const fetchArtists = async () => {
    try {
      // Fetch from artists table - use name directly
      const { data, error } = await supabase
        .from("artists")
        .select("id, name")
        .order("name", { ascending: true });
      
      if (error) {
        console.error("Error fetching artists:", error);
        toast({ title: "Error", description: "Failed to load artists", variant: "destructive" });
        return;
      }
      
      if (data && data.length > 0) {
        setArtists(data.map(artist => ({
          id: artist.id,
          name: artist.name || "Unknown Artist",
        })));
      } else {
        setArtists([]);
      }
    } catch (err) {
      console.error("Error in fetchArtists:", err);
      toast({ title: "Error", description: "Failed to load artists", variant: "destructive" });
    }
  };

  const fetchTracks = async () => {
    if (!selectedArtistId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("tracks")
      .select("id,song_title,composer_name,isrc,artist_name,split,created_at")
      .eq("artist_id", selectedArtistId)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Error", description: "Failed to load tracks", variant: "destructive" });
    }
    setTracks((data as any) || []);
    setSelected({});
    setLoading(false);
  };

  const filtered = useMemo(() => {
    if (!search) return tracks;
    const q = search.toLowerCase();
    return tracks.filter(
      (t) =>
        t.song_title.toLowerCase().includes(q) ||
        t.composer_name.toLowerCase().includes(q) ||
        t.isrc.toLowerCase().includes(q)
    );
  }, [tracks, search]);

  const sorted = useMemo(() => {
    if (!sortColumn) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = a[sortColumn] || "";
      const bVal = b[sortColumn] || "";
      const comparison = String(aVal).localeCompare(String(bVal));
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filtered, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page]);

  const handleSort = (column: keyof TrackRow) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Validate CSV columns for track catalog
  const validateCatalogCsvColumns = async (file: File): Promise<CatalogColumnValidationResult> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const firstLine = text.split('\n')[0];
          
          let csvHeaders: string[] = [];
          const headerMatch = firstLine.match(/(?:"[^"]*"|[^,]+)/g);
          if (headerMatch) {
            csvHeaders = headerMatch.map(h => h.replace(/^"|"$/g, '').trim());
          } else {
            csvHeaders = firstLine.split(',').map(h => h.trim());
          }
          
          const headerLowerSet = new Set(csvHeaders.map(h => h.toLowerCase()));
          
          const foundColumns: { key: string; label: string; matchedHeader: string }[] = [];
          const missingColumns: { key: string; label: string }[] = [];
          
          for (const col of CATALOG_REQUIRED_COLUMNS) {
            let matched = false;
            let matchedHeader = '';
            
            for (const variation of col.variations) {
              if (csvHeaders.includes(variation)) {
                matched = true;
                matchedHeader = variation;
                break;
              }
              if (headerLowerSet.has(variation.toLowerCase())) {
                matched = true;
                matchedHeader = csvHeaders.find(h => h.toLowerCase() === variation.toLowerCase()) || variation;
                break;
              }
            }
            
            if (matched) {
              foundColumns.push({ key: col.key, label: col.label, matchedHeader });
            } else {
              missingColumns.push({ key: col.key, label: col.label });
            }
          }
          
          resolve({
            isValid: missingColumns.length === 0,
            foundColumns,
            missingColumns,
            csvHeaders,
          });
        } catch (error) {
          reject(new Error('Failed to parse CSV headers'));
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file.slice(0, 4096));
    });
  };

  const handleChooseFile = async (f: File | null) => {
    setFile(f);
    setPreview([]);
    setColumnValidation(null);
    if (!f) return;
    if (!selectedArtistId) {
      toast({ title: "No Artist Selected", description: "Please select an artist first", variant: "destructive" });
      return;
    }
    
    const selectedArtist = artists.find(a => a.id === selectedArtistId);
    if (!selectedArtist) {
      toast({ title: "Error", description: "Selected artist not found", variant: "destructive" });
      return;
    }
    
    // Validate columns first
    setValidatingFile(true);
    try {
      const validation = await validateCatalogCsvColumns(f);
      setColumnValidation(validation);
      
      if (!validation.isValid) {
        setShowValidationModal(true);
        setValidatingFile(false);
        return; // Don't parse yet - wait for user to proceed
      }
      
      // If valid, continue with parsing
      await parseAndPreviewFile(f, selectedArtist.name);
    } catch (error) {
      toast({ title: "Validation Error", description: "Failed to validate CSV columns", variant: "destructive" });
      setFile(null);
      setColumnValidation(null);
    } finally {
      setValidatingFile(false);
    }
  };

  const parseAndPreviewFile = async (f: File, artistName: string) => {
    const parsed = await parseCatalogCsv(f, artistName);
    
    // Separate critical errors from warnings
    const criticalErrors = parsed.errors.filter(e => !e.includes("warning only"));
    const warnings = parsed.errors.filter(e => e.includes("warning only"));
    
    if (criticalErrors.length > 0) {
      toast({ title: "Invalid CSV", description: criticalErrors.join("; "), variant: "destructive" });
      return;
    }
    
    if (warnings.length > 0) {
      toast({ 
        title: "Artist Name Mismatch", 
        description: `${warnings.length} row(s) have different artist names. Review the preview before saving.`,
        variant: "default"
      });
    }
    
    setPreview(parsed.rows);
    if (parsed.rows.length > 0) {
      toast({ title: "CSV Parsed", description: `Found ${parsed.rows.length} rows ready for preview` });
    }
  };

  const handleProceedWithMissingColumns = async () => {
    setShowValidationModal(false);
    if (!file || !selectedArtistId) return;
    
    const selectedArtist = artists.find(a => a.id === selectedArtistId);
    if (!selectedArtist) return;
    
    toast({
      title: "File Selected",
      description: `${file.name} - Proceeding with ${columnValidation?.missingColumns.length || 0} missing column(s)`,
    });
    
    await parseAndPreviewFile(file, selectedArtist.name);
  };

  const handleConfirmUpload = async () => {
  if (!file || preview.length === 0 || !selectedArtistId) {
    toast({ title: "Error", description: "Please upload a CSV file and select an artist", variant: "destructive" });
    return;
  }
  
  // Double-check validation before saving
  const hasEmptyISRC = preview.some(r => !r.ISRC || r.ISRC.trim() === "");
  if (hasEmptyISRC) {
    toast({ title: "Validation Error", description: "Cannot save tracks with empty ISRC values", variant: "destructive" });
    return;
  }
  
  if (!user?.id) {
    toast({ 
      title: "Authentication Error", 
      description: "You must be logged in to upload tracks", 
      variant: "destructive" 
    });
    return;
  }
  
  setLoading(true);
  
  try {
    // Step 1: Check for existing ISRCs in the database
    const isrcsToCheck = preview.map(r => r.ISRC.trim()).filter(Boolean);
    
    const { data: existingTracks, error: checkError } = await supabase
      .from("tracks")
      .select("isrc")
      .eq("artist_id", selectedArtistId)
      .in("isrc", isrcsToCheck);
    
    if (checkError) {
      console.error("Error checking for existing ISRCs:", checkError);
      toast({ 
        title: "Check Failed", 
        description: "Failed to check for duplicate ISRCs", 
        variant: "destructive" 
      });
      setLoading(false);
      return;
    }
    
    // Create a set of existing ISRCs for fast lookup
    const existingISRCs = new Set(existingTracks?.map(t => t.isrc) || []);
    
    // Filter out rows with duplicate ISRCs
    const duplicateCount = preview.filter(r => existingISRCs.has(r.ISRC.trim())).length;
    const uniquePreview = preview.filter(r => !existingISRCs.has(r.ISRC.trim()));
    
    if (duplicateCount > 0) {
      toast({ 
        title: "Duplicates Found", 
        description: `${duplicateCount} track(s) with existing ISRCs will be skipped. ${uniquePreview.length} new track(s) will be added.`,
        variant: "default"
      });
    }
    
    if (uniquePreview.length === 0) {
      setShowDuplicateWarningModal(true);
      setLoading(false);
      return;
    }
    
    // Step 2: Prepare rows for insertion (only unique ones)
    const now = new Date().toISOString();
    const rows = uniquePreview.map((r) => {
      const songTitle = r["Song Title"]?.trim() || "";
      
      // Validate required fields
      if (!songTitle) {
        console.error("Empty song title found in row:", r);
        throw new Error("Song Title is required and cannot be empty");
      }
      
      const row: any = {
        title: songTitle,
        song_title: songTitle,
        composer_name: r["Composer Name"]?.trim() || "",
        isrc: r["ISRC"]?.trim() || "",
        artist_name: r["Artist"]?.trim() || "",
        split: r["Split"]?.trim() || "",
        created_at: now,
      };
      
      if (selectedArtistId) {
        row.artist_id = selectedArtistId;
      }
      
      if (user?.id) {
        row.uploaded_by = user.id;
      } else {
        row.uploaded_by = null;
      }
      
      if (!row.title || row.title.trim() === "") {
        row.title = songTitle || "Untitled";
      }
      
      return row;
    });
    
    // Validate rows before insert
    const rowsWithIssues = rows.filter(r => !r.title || r.title.trim() === "");
    if (rowsWithIssues.length > 0) {
      console.error("Rows with empty title:", rowsWithIssues);
      toast({ 
        title: "Validation Error", 
        description: `${rowsWithIssues.length} row(s) have empty song titles`, 
        variant: "destructive" 
      });
      setLoading(false);
      return;
    }
    
    console.log("Inserting tracks:", { 
      rowCount: rows.length, 
      firstRow: { 
        ...rows[0], 
        hasTitle: !!rows[0].title,
        titleValue: rows[0].title,
        titleLength: rows[0].title?.length
      }, 
      artistId: selectedArtistId, 
      userId: user?.id,
      userRole: user?.role,
      duplicatesSkipped: duplicateCount
    });
    
    const { data, error } = await supabase
      .from("tracks")
      .insert(rows)
      .select();
    
    if (error) {
      console.error("=== UPLOAD ERROR ===");
      console.error("Error object:", error);
      console.error("Error type:", typeof error);
      console.error("Error constructor:", error?.constructor?.name);
      console.error("Error keys:", Object.keys(error || {}));
      console.error("Error message:", error?.message);
      console.error("Error code:", error?.code);
      console.error("Error details:", error?.details);
      console.error("Error hint:", error?.hint);
      
      try {
        console.error("Error JSON:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      } catch (e) {
        console.error("Could not stringify error:", e);
      }
      
      const errorMessage = 
        (error as any)?.message || 
        (error as any)?.details || 
        (error as any)?.hint || 
        String(error) ||
        "Failed to upload tracks. Check console for full error details.";
        
      toast({ 
        title: "Upload failed", 
        description: errorMessage,
        variant: "destructive" 
      });
      setLoading(false);
      return;
    }
    
    console.log("Insert successful, data:", data);
    
    const successMessage = duplicateCount > 0
      ? `${rows.length} new tracks saved. ${duplicateCount} duplicate(s) skipped.`
      : `${rows.length} tracks successfully saved to database`;
    
    toast({ title: "Success", description: successMessage, variant: "default" });
    
    // Send email and notification to the artist
    if (selectedArtistId) {
      try {
        const response = await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "catalog_upload",
            artistIds: [selectedArtistId],
          }),
        });
        const result = await response.json();
        if (result.success) {
          console.log("Catalog upload notifications sent:", result);
        } else {
          console.error("Failed to send catalog notifications:", result.error);
        }
      } catch (notifyErr) {
        console.error("Error sending catalog notifications:", notifyErr);
      }
    }
    
    setFile(null);
    setPreview([]);
    await fetchTracks();
  } catch (err) {
    console.error("Unexpected error during upload:", err);
    toast({ title: "Upload failed", description: err instanceof Error ? err.message : "An unexpected error occurred", variant: "destructive" });
  } finally {
    setLoading(false);
  }
};

  const toggleAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    paged.forEach((t) => (next[t.id] = checked));
    setSelected(next);
  };

  const bulkDelete = async () => {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    if (ids.length === 0) return;
    const { error } = await supabase.from("tracks").delete().in("id", ids);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Deleted", description: `${ids.length} tracks removed` });
    setDeleteOpen(false);
    await fetchTracks();
  };

  const deleteAllForArtist = async () => {
    if (!selectedArtistId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/data/tracks?artist_id=${selectedArtistId}&delete_all=true`, {
        method: "DELETE",
      });
      
      const result = await response.json();
      
      if (result.error) {
        toast({ title: "Delete failed", description: result.error, variant: "destructive" });
        return;
      }
      
      const artistName = artists.find(a => a.id === selectedArtistId)?.name || "artist";
      toast({ 
        title: "Catalog Deleted", 
        description: `${result.deletedCount || 0} tracks removed for ${artistName}. Notification sent to artist.`,
      });
      setDeleteAllOpen(false);
      await fetchTracks();
    } catch (err) {
      console.error("Error deleting all tracks:", err);
      toast({ title: "Delete failed", description: "An unexpected error occurred", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const saveEdit = async () => {
    if (!editRow) return;
    const { id, created_at, ...updates } = editRow;
    const { error } = await supabase.from("tracks").update(updates).eq("id", id);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Saved", description: "Track updated" });
    setEditRow(null);
    await fetchTracks();
  };

  const exportCsv = () => {
    const header = ["Song Title", "Composer Name", "ISRC", "Artist", "Split"];
    const rows = filtered.map((t) => [t.song_title, t.composer_name, t.isrc, t.artist_name, t.split]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const artistName = artists.find((a) => a.id === selectedArtistId)?.name || "catalog";
    a.download = `${artistName}-tracks.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadTemplate = () => {
    const header = ["Song Title", "Composer Name", "ISRC", "Artist", "Split"];
    const exampleRow = ["My Song Title", "John Doe", "USRC12345678", "Artist Name", "100"];
    const csv = [header, exampleRow].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "track-catalog-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading || !user) return null;

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div 
      className="space-y-8"
      style={{
        backgroundColor: isDark ? 'transparent' : '#F9FAFB',
        minHeight: '100vh',
        padding: '24px',
      }}
    >
      <header>
        <h2 
          className="text-2xl font-semibold mb-2" 
          style={{ 
            color: isDark ? 'rgba(255, 255, 255, 0.95)' : '#1F2937',
            fontSize: '22px',
            fontWeight: 'bold',
          }}
        >
          Artist Track Manager
        </h2>
        <p style={{ color: isDark ? 'rgba(156, 163, 175, 0.8)' : '#6B7280' }}>
          Manage artist catalogs and upload track data
        </p>
      </header>

      {/* Section 1: Artist Selector */}
      <div 
        className="transition-all duration-200"
        style={{
          maxWidth: '700px',
          margin: '0 auto',
          backgroundColor: isDark ? 'rgba(18, 18, 18, 0.8)' : '#FFFFFF',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #E5E7EB',
          boxShadow: isDark ? '0 8px 32px 0 rgba(0, 0, 0, 0.37)' : 'rgba(0, 0, 0, 0.05)',
          borderRadius: isDark ? '16px' : '16px',
          padding: '24px',
        }}
      >
        <label 
          className="block text-sm font-medium mb-3" 
          style={{ 
            color: isDark ? 'rgba(255, 255, 255, 0.9)' : '#111827',
            fontWeight: 600,
          }}
        >
          Select Artist
        </label>
        <select
          value={selectedArtistId}
          onChange={(e) => setSelectedArtistId(e.target.value)}
          className="w-full max-w-md px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent transition-colors"
          style={{
            backgroundColor: isDark ? '#F9FAFB' : '#F9FAFB',
            color: isDark ? '#0A0A0A' : '#1F2937',
            border: isDark ? '1px solid rgba(0, 0, 0, 0.1)' : '1px solid #D1D5DB',
            boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)',
          }}
          onMouseEnter={(e) => {
            if (!isDark) {
              e.currentTarget.style.borderColor = '#9CA3AF';
            }
          }}
          onMouseLeave={(e) => {
            if (!isDark) {
              e.currentTarget.style.borderColor = '#D1D5DB';
            }
          }}
        >
          <option value="">Select Artist</option>
          {artists.map((artist) => (
            <option key={artist.id} value={artist.id}>
              {artist.name}
            </option>
          ))}
        </select>
      </div>

      {/* Section 2: Required CSV Format Info */}
      {selectedArtistId && (
        <div 
          className="transition-all duration-200"
          style={{
            backgroundColor: isDark ? 'rgba(30, 58, 138, 0.2)' : '#DBEAFE',
            border: isDark ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid #93C5FD',
            borderRadius: '16px',
            padding: '24px',
          }}
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: '#3B82F6' }} />
            <div className="flex-1">
              <h3 
                className="font-semibold mb-2" 
                style={{ color: isDark ? '#DBEAFE' : '#1E3A8A' }}
              >
                Required CSV Format
              </h3>
              <p 
                className="text-sm mb-3" 
                style={{ color: isDark ? '#BFDBFE' : '#1E40AF' }}
              >
                Your CSV file must include the following columns (in any order):
              </p>
              <div 
                className="text-sm font-mono p-3 rounded mb-4"
                style={{
                  color: isDark ? '#BFDBFE' : '#1E40AF',
                  backgroundColor: isDark ? 'rgba(30, 58, 138, 0.3)' : '#BFDBFE',
                }}
              >
                Song Title, Composer Name, ISRC, Artist, Split
              </div>
              <button
                onClick={downloadTemplate}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-all duration-200 hover:scale-105 active:scale-95"
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
        </div>
      )}

      {/* Section 3: CSV Upload */}
      {selectedArtistId && (
        <div 
          className="transition-all duration-200"
          style={{
            backgroundColor: isDark ? 'rgba(18, 18, 18, 0.8)' : '#FFFFFF',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #E5E7EB',
            boxShadow: isDark ? '0 8px 32px 0 rgba(0, 0, 0, 0.37)' : 'rgba(0, 0, 0, 0.05)',
            borderRadius: '16px',
            padding: '24px',
          }}
        >
          <h3 
            className="text-lg font-semibold mb-4" 
            style={{ 
              color: isDark ? 'rgba(255, 255, 255, 0.95)' : '#1F2937' 
            }}
          >
            Upload Tracks
          </h3>
          <div className="flex items-center gap-3 flex-wrap mb-4">
            <label 
              className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md cursor-pointer transition-all duration-200"
              style={{
                backgroundColor: '#F9FAFB',
                color: '#0A0A0A',
                border: '1px solid rgba(0, 0, 0, 0.1)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#F3F4F6';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#F9FAFB';
              }}
            >
              <Upload className="h-4 w-4" style={{ color: '#3B82F6' }} />
              <span style={{ color: '#0A0A0A' }}>{file ? file.name : "Upload CSV"}</span>
              <input type="file" accept=".csv" onChange={(e) => handleChooseFile(e.target.files?.[0] || null)} className="hidden" />
            </label>
            <button
              onClick={handleConfirmUpload}
              disabled={!file || preview.length === 0 || !selectedArtistId}
              className="px-4 py-2 rounded-md text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(to right, #3B82F6, #06B6D4)',
                boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)',
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.4)';
                }
              }}
            >
              Save to Database
            </button>
            {selectedCount > 0 && (
              <button
                onClick={() => setDeleteOpen(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#FCA5A5',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
              }}
              >
                <Trash2 className="h-4 w-4" /> Delete Selected ({selectedCount})
              </button>
            )}
            <button
              onClick={exportCsv}
              disabled={!selectedArtistId || tracks.length === 0}
              className="px-4 py-2 text-sm rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
              style={{
                border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid #D1D5DB',
                color: isDark ? 'rgba(255, 255, 255, 0.9)' : '#1F2937',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F9FAFB',
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled && !isDark) {
                  e.currentTarget.style.backgroundColor = '#F3F4F6';
                  e.currentTarget.style.borderColor = '#9CA3AF';
                } else if (!e.currentTarget.disabled && isDark) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isDark) {
                  e.currentTarget.style.backgroundColor = '#F9FAFB';
                  e.currentTarget.style.borderColor = '#D1D5DB';
                } else {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                }
              }}
            >
              Export CSV
            </button>
            <button
              onClick={() => setDeleteAllOpen(true)}
              disabled={!selectedArtistId || tracks.length === 0}
              className="px-4 py-2 text-sm rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 flex items-center gap-2"
              style={{
                border: '1px solid rgba(239, 68, 68, 0.5)',
                color: '#EF4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete All Catalog
            </button>
          </div>

          {/* Validating File Indicator */}
          {validatingFile && (
            <div 
              className="flex items-center gap-2 p-3 rounded-lg mb-4"
              style={{
                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#DBEAFE',
              }}
            >
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: '#3B82F6' }} />
              <span className="text-sm" style={{ color: isDark ? '#93C5FD' : '#1E40AF' }}>
                Validating CSV columns...
              </span>
            </div>
          )}

          {/* Column Validation Status */}
          {columnValidation && file && !validatingFile && (
            <div 
              className="p-4 rounded-lg border mb-4"
              style={{
                backgroundColor: columnValidation.isValid 
                  ? (isDark ? 'rgba(16, 185, 129, 0.1)' : '#D1FAE5')
                  : (isDark ? 'rgba(251, 191, 36, 0.1)' : '#FEF3C7'),
                borderColor: columnValidation.isValid
                  ? (isDark ? 'rgba(16, 185, 129, 0.3)' : '#6EE7B7')
                  : (isDark ? 'rgba(251, 191, 36, 0.3)' : '#FCD34D'),
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {columnValidation.isValid ? (
                    <CheckCircle className="h-5 w-5" style={{ color: isDark ? '#6EE7B7' : '#059669' }} />
                  ) : (
                    <AlertTriangle className="h-5 w-5" style={{ color: isDark ? '#FCD34D' : '#D97706' }} />
                  )}
                  <span 
                    className="font-medium text-sm"
                    style={{ 
                      color: columnValidation.isValid 
                        ? (isDark ? '#6EE7B7' : '#059669')
                        : (isDark ? '#FCD34D' : '#D97706')
                    }}
                  >
                    {columnValidation.isValid 
                      ? 'All required columns found' 
                      : `${columnValidation.missingColumns.length} missing column(s)`}
                  </span>
                </div>
                {!columnValidation.isValid && (
                  <button
                    onClick={() => setShowValidationModal(true)}
                    className="text-xs underline"
                    style={{ color: isDark ? '#FCD34D' : '#D97706' }}
                  >
                    View Details
                  </button>
                )}
              </div>
              
              {!columnValidation.isValid && (
                <div className="flex flex-wrap gap-2">
                  {columnValidation.missingColumns.map((col) => (
                    <span 
                      key={col.key}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
                      style={{
                        backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2',
                        color: isDark ? '#FCA5A5' : '#DC2626',
                      }}
                    >
                      <XCircle className="h-3 w-3" />
                      {col.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {preview.length > 0 && (
            <div className="mt-6">
              <h4 
                className="text-sm font-semibold mb-3" 
                style={{ 
                  color: isDark ? 'rgba(255, 255, 255, 0.95)' : '#1F2937' 
                }}
              >
                Preview ({preview.length} tracks)
              </h4>
              <div 
                className="rounded-md overflow-hidden max-h-96 overflow-y-auto"
                style={{
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #E5E7EB',
                  backgroundColor: isDark ? 'rgba(249, 250, 251, 0.95)' : '#FFFFFF',
                }}
              >
                <table className="min-w-full text-sm">
              <thead 
                className="uppercase text-xs border-b sticky top-0"
                style={{
                  backgroundColor: isDark ? 'rgba(243, 244, 246, 0.95)' : '#F7F8FA',
                  color: isDark ? '#6B7280' : '#1A1A1A',
                  borderColor: isDark ? 'rgba(0, 0, 0, 0.1)' : '#E5E7EB',
                }}
              >
                    <tr>
                      <th className="py-2 px-3 text-left font-medium">Song Title</th>
                      <th className="py-2 px-3 text-left font-medium">Composer Name</th>
                      <th className="py-2 px-3 text-left font-medium">ISRC</th>
                      <th className="py-2 px-3 text-left font-medium">Artist</th>
                      <th className="py-2 px-3 text-left font-medium">Split</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, idx) => (
                      <tr 
                        key={idx} 
                        className="border-b transition-colors"
                        style={{
                          borderColor: 'rgba(0, 0, 0, 0.05)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(243, 244, 246, 0.5)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <td className="py-2 px-3 font-medium" style={{ color: '#0A0A0A' }}>{row["Song Title"]}</td>
                        <td className="py-2 px-3" style={{ color: '#4B5563' }}>{row["Composer Name"]}</td>
                        <td className="py-2 px-3 font-mono text-xs" style={{ color: '#4B5563' }}>{row.ISRC}</td>
                        <td className="py-2 px-3" style={{ color: '#4B5563' }}>{row.Artist}</td>
                        <td className="py-2 px-3" style={{ color: '#4B5563' }}>{row.Split}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p 
                  className="text-xs" 
                  style={{ 
                    color: isDark ? 'rgba(156, 163, 175, 0.8)' : '#6B7280' 
                  }}
                >
                  Review the preview above. Click "Save to Database" to import these tracks.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tracks Table */}
      {selectedArtistId && (
        <div 
          className="transition-all duration-200"
          style={{
            backgroundColor: isDark ? 'rgba(18, 18, 18, 0.8)' : '#FFFFFF',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #E5E7EB',
            boxShadow: isDark ? '0 8px 32px 0 rgba(0, 0, 0, 0.37)' : 'rgba(0, 0, 0, 0.05)',
            borderRadius: '16px',
            padding: '24px',
          }}
        >
          <div className="mb-4 flex items-center gap-3">
            <Search 
              className="h-4 w-4" 
              style={{ 
                color: isDark ? 'rgba(156, 163, 175, 0.8)' : '#9CA3AF' 
              }} 
            />
            <input
              type="text"
              placeholder="Search tracks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 max-w-md px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
              style={{
                backgroundColor: isDark ? '#F9FAFB' : '#F9FAFB',
                color: isDark ? '#0A0A0A' : '#1F2937',
                border: isDark ? '1px solid rgba(0, 0, 0, 0.1)' : '1px solid #D1D5DB',
                boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)',
              }}
            />
          </div>
          <div 
            className="rounded-md overflow-hidden"
            style={{
              border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #E5E7EB',
              backgroundColor: isDark ? 'rgba(249, 250, 251, 0.95)' : '#FFFFFF',
            }}
          >
            <table className="min-w-full text-sm">
              <thead 
                className="uppercase text-xs border-b"
                style={{
                  backgroundColor: isDark ? 'rgba(243, 244, 246, 0.95)' : '#F7F8FA',
                  color: isDark ? '#6B7280' : '#1A1A1A',
                  borderColor: isDark ? 'rgba(0, 0, 0, 0.1)' : '#E5E7EB',
                }}
              >
                <tr>
                  <th className="py-2 px-3 text-left">
                    <input type="checkbox" onChange={(e) => toggleAll(e.target.checked)} className="cursor-pointer" />
                  </th>
                  <th 
                    className="py-2 px-3 text-left font-medium cursor-pointer transition-colors"
                    style={{ color: '#6B7280' }}
                    onClick={() => handleSort("song_title")}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(243, 244, 246, 0.8)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(243, 244, 246, 0.95)';
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Song Title <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th 
                    className="py-2 px-3 text-left font-medium cursor-pointer transition-colors"
                    style={{ color: '#6B7280' }}
                    onClick={() => handleSort("composer_name")}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(243, 244, 246, 0.8)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(243, 244, 246, 0.95)';
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Composer Name <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th 
                    className="py-2 px-3 text-left font-medium cursor-pointer transition-colors"
                    style={{ color: '#6B7280' }}
                    onClick={() => handleSort("isrc")}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(243, 244, 246, 0.8)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(243, 244, 246, 0.95)';
                    }}
                  >
                    <div className="flex items-center gap-1">
                      ISRC <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="py-2 px-3 text-left font-medium">Artist</th>
                  <th className="py-2 px-3 text-left font-medium">Split (%)</th>
                  <th className="py-2 px-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td 
                      className="py-6 text-center" 
                      colSpan={7} 
                      style={{ 
                        color: isDark ? 'rgba(156, 163, 175, 0.8)' : '#8A8A8A',
                        backgroundColor: isDark ? 'transparent' : '#FFFFFF',
                      }}
                    >
                      Loading...
                    </td>
                  </tr>
                ) : paged.length === 0 ? (
                  <tr>
                    <td 
                      className="py-6 text-center" 
                      colSpan={7} 
                      style={{ 
                        color: isDark ? 'rgba(156, 163, 175, 0.8)' : '#8A8A8A',
                        backgroundColor: isDark ? 'transparent' : '#FFFFFF',
                      }}
                    >
                      No tracks found
                    </td>
                  </tr>
                ) : (
                  paged.map((t) => (
                    <tr 
                      key={t.id} 
                      className="border-b transition-colors"
                      style={{
                        borderColor: 'rgba(0, 0, 0, 0.05)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(243, 244, 246, 0.5)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={!!selected[t.id]}
                          onChange={(e) => setSelected((s) => ({ ...s, [t.id]: e.target.checked }))}
                          className="cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3 font-medium" style={{ color: '#0A0A0A' }}>{t.song_title}</td>
                      <td className="py-3 px-3" style={{ color: '#4B5563' }}>{t.composer_name}</td>
                      <td className="py-3 px-3" style={{ color: '#4B5563' }}>{t.isrc}</td>
                      <td className="py-3 px-3" style={{ color: '#4B5563' }}>{t.artist_name}</td>
                      <td className="py-3 px-3" style={{ color: '#4B5563' }}>{t.split}</td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => setEditRow(t)}
                          className="cursor-pointer text-sm transition-colors hover:underline"
                          style={{ color: '#3B82F6' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#2563EB';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#3B82F6';
                          }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > pageSize && (
            <div 
              className="flex items-center justify-between mt-4 px-2 text-sm" 
              style={{ 
                color: isDark ? 'rgba(156, 163, 175, 0.8)' : '#6B7280' 
              }}
            >
              <div>
                Page {page} of {totalPages} ({filtered.length} total)
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm hover:scale-105 active:scale-95"
                  style={{
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid #D1D5DB',
                    color: isDark ? 'rgba(255, 255, 255, 0.9)' : '#1F2937',
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F9FAFB',
                  }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled && !isDark) {
                      e.currentTarget.style.backgroundColor = '#F3F4F6';
                      e.currentTarget.style.borderColor = '#9CA3AF';
                    } else if (!e.currentTarget.disabled && isDark) {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isDark) {
                      e.currentTarget.style.backgroundColor = '#F9FAFB';
                      e.currentTarget.style.borderColor = '#D1D5DB';
                    } else {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                    }
                  }}
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm hover:scale-105 active:scale-95"
                  style={{
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid #D1D5DB',
                    color: isDark ? 'rgba(255, 255, 255, 0.9)' : '#1F2937',
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F9FAFB',
                  }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled && !isDark) {
                      e.currentTarget.style.backgroundColor = '#F3F4F6';
                      e.currentTarget.style.borderColor = '#9CA3AF';
                    } else if (!e.currentTarget.disabled && isDark) {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isDark) {
                      e.currentTarget.style.backgroundColor = '#F9FAFB';
                      e.currentTarget.style.borderColor = '#D1D5DB';
                    } else {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                    }
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-black">Confirm bulk delete</DialogTitle>
            </DialogHeader>
            <p className="text-sm py-4 text-black">
              This will permanently delete {selectedCount} selected tracks.
            </p>
            <DialogFooter className="gap-2">
              <button
                onClick={() => setDeleteOpen(false)}
                className="px-4 py-2 text-sm rounded-md transition-all duration-200 hover:scale-105 active:scale-95 border border-gray-300 text-gray-800 bg-gray-50 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={bulkDelete}
                className="px-4 py-2 text-sm rounded-md text-white transition-all duration-200 hover:scale-105 active:scale-95 bg-red-600 hover:bg-red-700 shadow-lg hover:shadow-xl shadow-red-200 hover:shadow-red-300"
              >
                Delete
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      {/* Delete All Catalog Confirmation Dialog */}
      <Dialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
        <DialogContent>
           <DialogHeader>
            <DialogTitle style={{ color: '#000000' }}>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                Delete All Catalog
              </div>
            </DialogTitle>
          </DialogHeader>
         <div className="py-4">
              <p className="text-sm text-black">
                Are you sure you want to delete all catalog entries for <strong>{artists.find(a => a.id === selectedArtistId)?.name || 'this artist'}</strong>?
              </p>
              <p className="text-sm mt-2 font-semibold text-black text-center">
                This action cannot be undone.
              </p>
              <p className="text-sm mt-2 text-black">
                {tracks.length} track(s) will be permanently deleted. The artist will be notified via email.
              </p>
            </div>
         <DialogFooter className="gap-2">
            <button
              onClick={() => setDeleteAllOpen(false)}
              className="px-4 py-2 text-sm rounded-md transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                border: '1px solid rgba(0, 0, 0, 0.2)',
                color: 'rgba(0, 0, 0, 0.9)',
                backgroundColor: 'rgba(0, 0, 0, 0.05)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
              }}
            >
              Cancel
            </button>
            <button
              onClick={deleteAllForArtist}
              disabled={loading}
              className="px-4 py-2 text-sm rounded-md text-white transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50"
              style={{
                backgroundColor: '#DC2626',
                boxShadow: '0 4px 15px rgba(220, 38, 38, 0.4)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#B91C1C';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(220, 38, 38, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#DC2626';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(220, 38, 38, 0.4)';
              }}
            >
              {loading ? 'Deleting...' : 'Delete All Catalog'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ color: 'rgba(24, 24, 24, 1)' }}>Edit track</DialogTitle>
          </DialogHeader>
          {editRow && (
            <div className="grid gap-3 py-4">
              <input
                type="text"
                value={editRow.song_title || ""}
                onChange={(e) => setEditRow({ ...editRow, song_title: e.target.value })}
                placeholder="Song Title"
                className="px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                style={{
                  backgroundColor: '#F9FAFB',
                  color: '#0A0A0A',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#3B82F6';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.2), inset 0 1px 2px rgba(0, 0, 0, 0.05)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                  e.target.style.boxShadow = 'inset 0 1px 2px rgba(0, 0, 0, 0.05)';
                }}
              />
              <input
                type="text"
                value={editRow.composer_name || ""}
                onChange={(e) => setEditRow({ ...editRow, composer_name: e.target.value })}
                placeholder="Composer Name"
                className="px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                style={{
                  backgroundColor: '#F9FAFB',
                  color: '#0A0A0A',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#3B82F6';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.2), inset 0 1px 2px rgba(0, 0, 0, 0.05)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                  e.target.style.boxShadow = 'inset 0 1px 2px rgba(0, 0, 0, 0.05)';
                }}
              />
              <input
                type="text"
                value={editRow.isrc || ""}
                onChange={(e) => setEditRow({ ...editRow, isrc: e.target.value })}
                placeholder="ISRC"
                className="px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                style={{
                  backgroundColor: '#F9FAFB',
                  color: '#0A0A0A',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#3B82F6';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.2), inset 0 1px 2px rgba(0, 0, 0, 0.05)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                  e.target.style.boxShadow = 'inset 0 1px 2px rgba(0, 0, 0, 0.05)';
                }}
              />
              <input
                type="text"
                value={editRow.artist_name || ""}
                onChange={(e) => setEditRow({ ...editRow, artist_name: e.target.value })}
                placeholder="Artist"
                className="px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                style={{
                  backgroundColor: '#F9FAFB',
                  color: '#0A0A0A',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#3B82F6';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.2), inset 0 1px 2px rgba(0, 0, 0, 0.05)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                  e.target.style.boxShadow = 'inset 0 1px 2px rgba(0, 0, 0, 0.05)';
                }}
              />
              <input
                type="text"
                value={editRow.split || ""}
                onChange={(e) => setEditRow({ ...editRow, split: e.target.value })}
                placeholder="Split (%)"
                className="px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                style={{
                  backgroundColor: '#f9fafb',
                  color: '#0A0A0A',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#3B82F6';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.2), inset 0 1px 2px rgba(0, 0, 0, 0.05)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                  e.target.style.boxShadow = 'inset 0 1px 2px rgba(0, 0, 0, 0.05)';
                }}
              />
            </div>
          )}
          <DialogFooter className="gap-2">
            <button
              onClick={() => setEditRow(null)}
              className="px-4 py-2 text-sm rounded-md transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                border: '1px solid rgba(0, 0, 0, 0.2)',
                color: '#1F2937',
                backgroundColor: '#F3F4F6',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#E5E7EB';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#F3F4F6';
              }}
            >
              Cancel
            </button>
            <button
              onClick={saveEdit}
              className="px-4 py-2 text-sm rounded-md text-white transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(to right, #3B82F6, #06B6D4)',
                boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.4)';
              }}
            >
              Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Column Validation Modal */}
      {showValidationModal && columnValidation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => {
              setShowValidationModal(false);
              setFile(null);
              setColumnValidation(null);
            }}
          />
          
          {/* Modal */}
          <div 
            className="relative z-10 w-full max-w-2xl mx-4 rounded-lg border shadow-xl"
            style={{
              backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
          >
            {/* Header */}
            <div 
              className="flex items-center gap-3 p-6 border-b"
              style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
            >
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              <div>
                <h2 className="text-lg font-semibold" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>
                  Missing CSV Columns Detected
                </h2>
                <p className="text-sm" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
                  {file?.name}
                </p>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6 max-h-96 overflow-y-auto">
              {/* Missing Columns */}
              {columnValidation.missingColumns.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: isDark ? '#FCA5A5' : '#DC2626' }}>
                    <XCircle className="h-4 w-4" />
                    Missing Columns ({columnValidation.missingColumns.length})
                  </h3>
                  <div className="space-y-2">
                    {columnValidation.missingColumns.map((col) => (
                      <div 
                        key={col.key}
                        className="flex items-center gap-2 p-2 rounded"
                        style={{
                          backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEE2E2',
                        }}
                      >
                        <XCircle className="h-4 w-4 flex-shrink-0" style={{ color: isDark ? '#FCA5A5' : '#DC2626' }} />
                        <span className="font-medium" style={{ color: isDark ? '#FCA5A5' : '#DC2626' }}>
                          {col.label}
                        </span>
                        <span className="text-xs" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
                          — not found in CSV
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Found Columns */}
              {columnValidation.foundColumns.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: isDark ? '#6EE7B7' : '#059669' }}>
                    <CheckCircle className="h-4 w-4" />
                    Found Columns ({columnValidation.foundColumns.length})
                  </h3>
                  <div className="space-y-2">
                    {columnValidation.foundColumns.map((col) => (
                      <div 
                        key={col.key}
                        className="flex items-center gap-2 p-2 rounded"
                        style={{
                          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#D1FAE5',
                        }}
                      >
                        <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: isDark ? '#6EE7B7' : '#059669' }} />
                        <span className="font-medium" style={{ color: isDark ? '#6EE7B7' : '#059669' }}>
                          {col.label}
                        </span>
                        <span className="text-xs" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
                          → matched: "{col.matchedHeader}"
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* CSV Headers Found */}
              <div>
                <h3 className="text-sm font-semibold mb-3" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
                  Headers in your CSV file:
                </h3>
                <div 
                  className="text-xs font-mono p-3 rounded break-all"
                  style={{
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F3F4F6',
                    color: isDark ? '#D1D5DB' : '#4B5563',
                  }}
                >
                  {columnValidation.csvHeaders.join(', ')}
                </div>
              </div>
            </div>
            
            {/* Warning Message */}
            <div 
              className="px-6 py-4 border-t"
              style={{
                backgroundColor: isDark ? 'rgba(251, 191, 36, 0.1)' : '#FEF3C7',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <p className="text-sm" style={{ color: isDark ? '#FCD34D' : '#92400E' }}>
                <strong>Warning:</strong> Uploading with missing columns may result in incomplete data. 
                Rows without required data (like Song Title) will be skipped during processing.
              </p>
            </div>
            
            {/* Footer */}
            <div 
              className="flex items-center justify-end gap-3 p-6 border-t"
              style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
            >
              <Button
                variant="outline"
                onClick={() => {
                  setShowValidationModal(false);
                  setFile(null);
                  setColumnValidation(null);
                }}
              >
                Cancel
              </Button>
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleProceedWithMissingColumns}
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Proceed Anyway
              </Button>
            </div>
          </div>
        </div>
      )}
{/* Duplicate Warning Modal */}
      {showDuplicateWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 backdrop-blur-sm"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onClick={() => setShowDuplicateWarningModal(false)}
          />
          
          {/* Modal Container */}
          <div 
            className="relative z-10 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden transform transition-all"
            style={{
              backgroundColor: '#FFFFFF',
              border: '2px solid #FCA5A5',
            }}
          >
            {/* Header - Red Warning Color */}
            <div 
              className="relative px-6 py-5 border-b"
              style={{
                background: 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)',
                borderColor: '#FCA5A5',
              }}
            >
              <div className="flex items-start gap-3">
                {/* Animated Warning Icon */}
                <div 
                  className="flex-shrink-0 p-2 rounded-full"
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  }}
                >
                  <AlertTriangle 
                    className="h-6 w-6" 
                    style={{ 
                      color: '#DC2626',
                      filter: 'drop-shadow(0 2px 4px rgba(239, 68, 68, 0.3))',
                    }} 
                  />
                </div>
                
                <div className="flex-1">
                  <h2 
                    className="text-lg font-bold mb-1"
                    style={{ color: '#991B1B' }}
                  >
                    Duplicate Tracks Detected
                  </h2>
                  <p 
                    className="text-sm"
                    style={{ color: '#B91C1C' }}
                  >
                    {file?.name}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6">
              {/* Main Warning Message */}
              <div 
                className="p-4 rounded-xl mb-4"
                style={{
                  backgroundColor: '#FEE2E2',
                  border: '2px solid #FCA5A5',
                }}
              >
                <div className="flex items-start gap-3">
                  <XCircle 
                    className="h-5 w-5 flex-shrink-0 mt-0.5" 
                    style={{ color: '#DC2626' }}
                  />
                  <div>
                    <p 
                      className="font-semibold mb-1"
                      style={{ color: '#991B1B' }}
                    >
                      All {preview.length} tracks already exist
                    </p>
                    <p 
                      className="text-sm"
                      style={{ color: '#991B1B' }}
                    >
                      All tracks in this CSV already exist in the database. Each track was matched by ISRC code, so no duplicates were found to add.
                    </p>
                  </div>
                </div>
              </div>

              {/* Info Box - White Background */}
              <div 
                className="p-4 rounded-xl mb-5"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                }}
              >
                <div className="flex items-start gap-3">
                  <Info 
                    className="h-5 w-5 flex-shrink-0 mt-0.5" 
                    style={{ color: '#DC2626' }}
                  />
                  <div>
                    <p 
                      className="text-sm font-semibold mb-2"
                      style={{ color: '#991B1B' }}
                    >
                      What does this mean?
                    </p>
                    <ul className="space-y-1.5 text-sm" style={{ color: '#6B7280' }}>
                      <li className="flex items-start gap-2">
                        <span style={{ color: '#DC2626' }}>✓</span>
                        <span>All CSV tracks matched existing ISRCs in your catalog</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span style={{ color: '#DC2626' }}>✓</span>
                        <span>No new tracks were added</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span style={{ color: '#DC2626' }}>✓</span>
                        <span>Your catalog remains unchanged</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div 
              className="px-6 py-4 border-t flex items-center justify-end gap-3"
              style={{ 
                backgroundColor: '#FFFFFF',
                borderColor: '#FCA5A5',
              }}
            >
              <button
                onClick={() => setShowDuplicateWarningModal(false)}
                className="px-5 py-2.5 rounded-lg font-semibold text-sm transition-all hover:scale-105 active:scale-95"
                style={{
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#B91C1C';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#DC2626';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(220, 38, 38, 0.3)';
                }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}