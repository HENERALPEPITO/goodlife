"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Search, Trash2, Edit, ArrowUpDown } from "lucide-react";
import { parseCatalogCsv, CatalogCsvRow } from "@/lib/catalogCsv";
import { useTheme } from "next-themes";

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
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [editRow, setEditRow] = useState<TrackRow | null>(null);
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<keyof TrackRow | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const pageSize = 20;

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
      // First, try to fetch from artists table
      let { data, error } = await supabase
        .from("artists")
        .select("id,name,user_id")
        .order("name", { ascending: true });
      
      if (error) {
        console.error("Error fetching from artists table:", error);
        // Fallback: fetch from user_profiles if artists table is empty or has issues
      }
      
      // If we have data, fetch emails from user_profiles and use email for display
      if (data && data.length > 0) {
        const artistRecords: Artist[] = [];
        
        for (const artist of data) {
          // Fetch email from user_profiles
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("email")
            .eq("id", artist.user_id)
            .maybeSingle();
          
          // Use email if available, otherwise use existing name
          const displayName = profile?.email || artist.name;
          
          // Update artist name in database if it's not already an email
          if (profile?.email && !artist.name.includes("@")) {
            await supabase
              .from("artists")
              .update({ name: profile.email })
              .eq("id", artist.id);
          }
          
          artistRecords.push({
            id: artist.id,
            name: displayName,
          });
        }
        
        setArtists(artistRecords);
        return;
      }
      
      // If artists table is empty, use user_profiles with role='artist'
      if (!data || data.length === 0) {
        const { data: profiles, error: profileError } = await supabase
          .from("user_profiles")
          .select("id, email")
          .eq("role", "artist")
          .order("email", { ascending: true });
        
        if (profileError) {
          toast({ title: "Error", description: "Failed to load artists", variant: "destructive" });
          return;
        }
        
        // Convert user_profiles to artists format
        // For each artist user, create or get artist record
        const artistRecords: Artist[] = [];
        
        for (const profile of profiles || []) {
          // Check if artist record exists
          const { data: existingArtist } = await supabase
            .from("artists")
            .select("id,name")
            .eq("user_id", profile.id)
            .maybeSingle();
          
          if (existingArtist) {
            // Use email for display if name doesn't contain @
            const displayName = existingArtist.name.includes("@") 
              ? existingArtist.name 
              : profile.email;
            
            // Update artist name in database if it's not already an email
            if (!existingArtist.name.includes("@")) {
              await supabase
                .from("artists")
                .update({ name: profile.email })
                .eq("id", existingArtist.id);
            }
            
            artistRecords.push({
              id: existingArtist.id,
              name: displayName,
            });
            continue;
          }
          
          // Create artist record if it doesn't exist
          const artistName = profile.email; // Use full email as name for display
          const { data: newArtist, error: createError } = await supabase
            .from("artists")
            .insert({
              user_id: profile.id,
              name: artistName,
            })
            .select("id,name")
            .single();
          
          if (createError) {
            console.error("Error creating artist record for", profile.email, ":", createError);
            // Skip this artist if creation fails - can't proceed without artist record
            continue;
          }
          
          if (newArtist) {
            artistRecords.push({
              id: newArtist.id,
              name: profile.email, // Use email for display
            });
          }
        }
        
        if (artistRecords.length === 0 && (profiles || []).length > 0) {
          toast({ 
            title: "Warning", 
            description: "No artist records found. You may need to create artists first or check RLS policies.",
            variant: "default"
          });
        }
        
        setArtists(artistRecords);
      } else {
        setArtists((data as any) || []);
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

  const handleChooseFile = async (f: File | null) => {
    setFile(f);
    setPreview([]);
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
    
    const parsed = await parseCatalogCsv(f, selectedArtist.name);
    
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
    
    const now = new Date().toISOString();
    const rows = preview.map((r) => {
      const songTitle = r["Song Title"]?.trim() || "";
      
      // Validate required fields
      if (!songTitle) {
        console.error("Empty song title found in row:", r);
        throw new Error("Song Title is required and cannot be empty");
      }
      
      const row: any = {
        title: songTitle, // Required NOT NULL column - MUST have a value
        song_title: songTitle, // Catalog schema column
        composer_name: r["Composer Name"]?.trim() || "",
        isrc: r["ISRC"]?.trim() || "",
        artist_name: r["Artist"]?.trim() || "",
        split: r["Split"]?.trim() || "",
        created_at: now,
      };
      
      // Include artist_id - it's now nullable and doesn't have foreign key constraint
      // We'll set it to the selected artist ID from the artists table
      if (selectedArtistId) {
        row.artist_id = selectedArtistId;
      }
      
      // Only include uploaded_by if user.id exists (references user_profiles.id)
      // Note: user.id should match user_profiles.id since user_profiles.id references auth.users(id)
      if (user?.id) {
        row.uploaded_by = user.id; // This should match user_profiles.id
      } else {
        // If no user, set uploaded_by to null (column is nullable)
        row.uploaded_by = null;
      }
      
      // Ensure title is never empty or null
      if (!row.title || row.title.trim() === "") {
        row.title = songTitle || "Untitled";
      }
      
      return row;
    });
    
    setLoading(true);
    try {
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
        userRole: user?.role
      });
      
      // Try inserting just one row first to test
      const { data, error } = await supabase
        .from("tracks")
        .insert(rows)
        .select();
      
      if (error) {
        // Log error in multiple ways to ensure we capture it
        console.error("=== UPLOAD ERROR ===");
        console.error("Error object:", error);
        console.error("Error type:", typeof error);
        console.error("Error constructor:", error?.constructor?.name);
        console.error("Error keys:", Object.keys(error || {}));
        console.error("Error message:", error?.message);
        console.error("Error code:", error?.code);
        console.error("Error details:", error?.details);
        console.error("Error hint:", error?.hint);
        
        // Try to stringify
        try {
          console.error("Error JSON:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        } catch (e) {
          console.error("Could not stringify error:", e);
        }
        
        // Try accessing properties directly
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
      
      toast({ title: "Success", description: `${rows.length} tracks successfully saved to database`, variant: "default" });
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

      {/* Section 2: CSV Upload */}
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
          </div>

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
            <DialogTitle style={{ color: 'rgba(255, 255, 255, 0.95)' }}>Confirm bulk delete</DialogTitle>
          </DialogHeader>
          <p className="text-sm py-4" style={{ color: 'rgba(156, 163, 175, 0.8)' }}>This will permanently delete {selectedCount} selected tracks.</p>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setDeleteOpen(false)}
              className="px-4 py-2 text-sm rounded-md transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: 'rgba(255, 255, 255, 0.9)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
              }}
            >
              Cancel
            </button>
            <button
              onClick={bulkDelete}
              className="px-4 py-2 text-sm rounded-md text-white transition-all duration-200 hover:scale-105 active:scale-95"
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
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ color: 'rgba(255, 255, 255, 0.95)' }}>Edit track</DialogTitle>
          </DialogHeader>
          {editRow && (
            <div className="grid gap-3 py-4">
              <input
                type="text"
                value={editRow.song_title}
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
                value={editRow.composer_name}
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
                value={editRow.isrc}
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
                value={editRow.artist_name}
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
                value={editRow.split}
                onChange={(e) => setEditRow({ ...editRow, split: e.target.value })}
                placeholder="Split (%)"
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
            </div>
          )}
          <DialogFooter className="gap-2">
            <button
              onClick={() => setEditRow(null)}
              className="px-4 py-2 text-sm rounded-md transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: 'rgba(255, 255, 255, 0.9)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
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
    </div>
  );
}

