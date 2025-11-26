"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Search, Trash2, AlertCircle } from "lucide-react";
import { parseCatalogCsv } from "@/lib/catalogCsv";

// ---------------------------
// Local Type Definitions
// ---------------------------
interface CatalogCsvRow {
  "Song Title": string;
  "Composer Name": string;
  ISRC: string;
  Artist: string;
  Split: string;
}

interface CatalogTrack {
  id: string;
  artist_id: string;
  song_title: string;
  composer_name: string;
  isrc: string;
  artist_name: string;
  split_percent: number;
  created_at: string;
  updated_at: string;
}

interface CatalogUpload {
  id: string;
  artist_id: string;
  file_name: string;
  row_count: number;
  uploaded_at: string;
}

export default function ArtistCatalogAdminPage() {
  const params = useParams<{ artistId: string }>();
  const artistId = params?.artistId as string;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [artistEmail, setArtistEmail] = useState<string>("");
  const [tracks, setTracks] = useState<CatalogTrack[]>([]);
  const [uploads, setUploads] = useState<CatalogUpload[]>([]);
  const [search, setSearch] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [file, setFile] = useState<File | null>(null);
  const [parsedCount, setParsedCount] = useState<number>(0);
  const [deleteAllOpen, setDeleteAllOpen] = useState<boolean>(false);

  // =============================
  // AUTH & REDIRECT
  // =============================
  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  // =============================
  // FETCH ARTIST, TRACKS, UPLOADS
  // =============================
  useEffect(() => {
    if (!artistId) return;
    fetchArtist();
    fetchTracks();
    fetchUploads();
  }, [artistId]);

  const fetchArtist = async () => {
    const { data } = await supabase
      .from("user_profiles")
      .select("email")
      .eq("id", artistId)
      .single();
    setArtistEmail(data?.email || "");
  };

  const fetchTracks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("catalog_tracks")
        .select("*")
        .eq("artist_id", artistId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTracks((data as CatalogTrack[]) || []);
    } catch (e) {
      toast({ title: "Error", description: "Failed to load tracks", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchUploads = async () => {
    const { data } = await supabase
      .from("catalog_uploads")
      .select("*")
      .eq("artist_id", artistId)
      .order("uploaded_at", { ascending: false });
    setUploads((data as CatalogUpload[]) || []);
  };

  // =============================
  // SEARCH FILTER
  // =============================
  const filtered = useMemo(() => {
    if (!search) return tracks;
    const q = search.toLowerCase();
    return tracks.filter(
      (t) =>
        (t.song_title?.toLowerCase() || "").includes(q) ||
        (t.composer_name?.toLowerCase() || "").includes(q) ||
        (t.isrc?.toLowerCase() || "").includes(q)
    );
  }, [tracks, search]);

  // =============================
  // CSV HANDLING
  // =============================
  const handleFileChange = async (f: File | null) => {
    setFile(f);
    setParsedCount(0);
    if (!f) return;
    const result = await parseCatalogCsv(f);
    if (result.errors.length) {
      toast({ title: "Invalid CSV", description: result.errors.join("; "), variant: "destructive" });
      return;
    }
    setParsedCount(result.rows.length);
    toast({ title: "CSV Parsed", description: `Found ${result.rows.length} rows` });
  };

  const handleImport = async () => {
    if (!file) {
      toast({ title: "No file", description: "Please choose a CSV file", variant: "destructive" });
      return;
    }
    const parsed = await parseCatalogCsv(file);
    if (parsed.errors.length) {
      toast({ title: "Invalid CSV", description: parsed.errors.join("; "), variant: "destructive" });
      return;
    }

    const now = new Date().toISOString();
    const toInsert = parsed.rows.map((r: CatalogCsvRow) => ({
      artist_id: artistId,
      song_title: r["Song Title"],
      composer_name: r["Composer Name"],
      isrc: r["ISRC"],
      artist_name: r["Artist"],
      split_percent: (() => {
        const v = r["Split"].replace(/%/g, "").trim();
        const n = Number.parseFloat(v);
        return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
      })(),
      created_at: now,
      updated_at: now,
    }));

    try {
      const { error } = await supabase.from("catalog_tracks").insert(toInsert);
      if (error) throw error;

      await supabase.from("catalog_uploads").insert({
        artist_id: artistId,
        file_name: file.name,
        row_count: toInsert.length,
        uploaded_at: now,
      });

      toast({ title: "Import complete", description: `${toInsert.length} tracks added` });
      setFile(null);
      setParsedCount(0);
      await Promise.all([fetchTracks(), fetchUploads()]);
    } catch (e: any) {
      toast({ title: "Import failed", description: e.message || "Error inserting rows", variant: "destructive" });
    }
  };

  const handleDeleteAll = async () => {
    try {
      const { error } = await supabase.from("catalog_tracks").delete().eq("artist_id", artistId);
      if (error) throw error;
      toast({ title: "Deleted", description: "All tracks removed for this artist" });
      setDeleteAllOpen(false);
      fetchTracks();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message || "Error deleting tracks", variant: "destructive" });
    }
  };

  if (authLoading || !user) return null;

  return (
    <div className="space-y-6">
      {/* Upload Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Artist Catalog</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            {artistEmail ? `Artist: ${artistEmail}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer">
            <Upload className="h-4 w-4" />
            <span>{file ? file.name : "Upload CSV"}</span>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              className="hidden"
            />
          </label>
          <Button onClick={handleImport} disabled={!file || parsedCount === 0}>Import</Button>
          <Button variant="outline" className="text-red-600 border-red-200 dark:border-red-900" onClick={() => setDeleteAllOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" /> Delete All
          </Button>
        </div>
      </div>

      {parsedCount > 0 && (
        <div className="text-sm text-zinc-600 dark:text-zinc-400">Ready to import {parsedCount} rows</div>
      )}

      {/* Track Table */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
          <Search className="h-4 w-4 text-zinc-500" />
          <Input placeholder="Search by title, composer, or ISRC" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr className="text-left text-zinc-600 dark:text-zinc-400">
                <th className="p-4 font-medium">Song Title</th>
                <th className="p-4 font-medium">Composer Name</th>
                <th className="p-4 font-medium">ISRC</th>
                <th className="p-4 font-medium">Artist</th>
                <th className="p-4 font-medium">Split (%)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="p-6 text-zinc-500" colSpan={5}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td className="p-6 text-zinc-500" colSpan={5}>No tracks found</td></tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="p-4">{t.song_title}</td>
                    <td className="p-4 text-zinc-600 dark:text-zinc-400">{t.composer_name}</td>
                    <td className="p-4 text-zinc-600 dark:text-zinc-400">{t.isrc}</td>
                    <td className="p-4 text-zinc-600 dark:text-zinc-400">{t.artist_name}</td>
                    <td className="p-4 text-zinc-600 dark:text-zinc-400">{t.split_percent}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload History */}
      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Uploads</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr className="text-left text-zinc-600 dark:text-zinc-400">
                <th className="p-4 font-medium">Uploaded At</th>
                <th className="p-4 font-medium">File Name</th>
                <th className="p-4 font-medium">Rows</th>
              </tr>
            </thead>
            <tbody>
              {uploads.length === 0 ? (
                <tr><td className="p-6 text-zinc-500" colSpan={3}>No uploads yet</td></tr>
              ) : (
                uploads.map((u) => (
                  <tr key={u.id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="p-4">{new Date(u.uploaded_at).toLocaleString()}</td>
                    <td className="p-4 text-zinc-600 dark:text-zinc-400">{u.file_name || "—"}</td>
                    <td className="p-4 text-zinc-600 dark:text-zinc-400">{u.row_count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Delete All Dialog */}
      <Dialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" /> Confirm Deletion
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            This will permanently delete all catalog tracks for this artist.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAllOpen(false)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={handleDeleteAll}>Delete All</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
