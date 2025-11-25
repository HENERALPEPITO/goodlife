"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Search, Trash2, Edit } from "lucide-react";
import { parseCatalogCsv, CatalogCsvRow } from "@/lib/catalogCsv";

interface TrackRow {
  id: string;
  song_title: string;
  composer_name: string;
  isrc: string;
  artist_name: string;
  split: string;
}

export default function ArtistCatalogAdminPage() {
  const params = useParams<{ artistId: string }>();
  const artistId = params?.artistId as string;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [artist, setArtist] = useState<{ id: string; name: string } | null>(null);
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CatalogCsvRow[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [editRow, setEditRow] = useState<TrackRow | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) router.push("/");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!artistId) return;
    void fetchArtist();
    void fetchTracks();
  }, [artistId]);

  const fetchArtist = async () => {
    const { data } = await supabase.from("artists").select("id,name").eq("id", artistId).single();
    setArtist(data as any);
  };

  const fetchTracks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tracks")
      .select("id,song_title,composer_name,isrc,artist_name,split")
      .eq("artist_id", artistId)
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
        (t.song_title?.toLowerCase() || '').includes(q) ||
        (t.composer_name?.toLowerCase() || '').includes(q) ||
        (t.isrc?.toLowerCase() || '').includes(q)
    );
  }, [tracks, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  const handleChooseFile = async (f: File | null) => {
    setFile(f);
    setPreview([]);
    if (!f) return;
    const parsed = await parseCatalogCsv(f);
    if (parsed.errors.length) {
      toast({ title: "Invalid CSV", description: parsed.errors.join("; "), variant: "destructive" });
      return;
    }
    setPreview(parsed.rows);
    toast({ title: "CSV Parsed", description: `Found ${parsed.rows.length} rows` });
  };

  const handleConfirmUpload = async () => {
    if (!file || preview.length === 0) return;
    const now = new Date().toISOString();
    const rows = preview.map((r) => ({
      artist_id: artistId,
      song_title: r["Song Title"],
      composer_name: r["Composer Name"],
      isrc: r["ISRC"],
      artist_name: r["Artist"],
      split: r["Split"],
      uploaded_by: user?.id || null,
      created_at: now,
    }));
    const { error } = await supabase.from("tracks").insert(rows);
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Import complete", description: `${rows.length} tracks added` });
    setFile(null);
    setPreview([]);
    await fetchTracks();
  };

  const toggleAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    paged.forEach((t) => (next[t.id] = checked));
    setSelected(next);
  };
  const exportCsv = () => {
    const header = ["Song Title","Composer Name","ISRC","Artist","Split"];
    const rows = filtered.map((t) => [t.song_title, t.composer_name, t.isrc, t.artist_name, t.split]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artist?.name || 'catalog'}-tracks.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
    const { id, ...updates } = editRow;
    const { error } = await supabase.from("tracks").update(updates).eq("id", id);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Saved", description: "Track updated" });
    setEditRow(null);
    await fetchTracks();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{artist?.name || "Artist"} Catalog</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">Manage this artist's tracks</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer">
            <Upload className="h-4 w-4" />
            <span>{file ? file.name : "Upload CSV"}</span>
            <input type="file" accept=".csv" onChange={(e) => handleChooseFile(e.target.files?.[0] || null)} className="hidden" />
          </label>
          <Button onClick={handleConfirmUpload} disabled={!file || preview.length === 0}>Confirm Upload</Button>
          <Button variant="outline" onClick={() => setDeleteOpen(true)} className="text-red-600 border-red-200 dark:border-red-900">
            <Trash2 className="h-4 w-4 mr-2" /> Bulk Delete
          </Button>
          <Button variant="outline" onClick={exportCsv}>Export CSV</Button>
        </div>
      </div>

      {preview.length > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900 p-4 bg-amber-50 dark:bg-amber-950/30 text-sm">
          Preview: {preview.length} rows ready to import
        </div>
      )}

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
          <Search className="h-4 w-4 text-zinc-500" />
          <Input placeholder="Search by title, composer, or ISRC" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr className="text-left text-zinc-600 dark:text-zinc-400">
                <th className="p-4"><input type="checkbox" onChange={(e) => toggleAll(e.target.checked)} /></th>
                <th className="p-4 font-medium">Song Title</th>
                <th className="p-4 font-medium">Composer Name</th>
                <th className="p-4 font-medium">ISRC</th>
                <th className="p-4 font-medium">Artist</th>
                <th className="p-4 font-medium">Split (%)</th>
                <th className="p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="p-6 text-zinc-500" colSpan={7}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td className="p-6 text-zinc-500" colSpan={7}>No tracks found</td></tr>
              ) : (
                paged.map((t) => (
                  <tr key={t.id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="p-4"><input type="checkbox" checked={!!selected[t.id]} onChange={(e) => setSelected((s) => ({ ...s, [t.id]: e.target.checked }))} /></td>
                    <td className="p-4">{t.song_title}</td>
                    <td className="p-4 text-zinc-600 dark:text-zinc-400">{t.composer_name}</td>
                    <td className="p-4 text-zinc-600 dark:text-zinc-400">{t.isrc}</td>
                    <td className="p-4 text-zinc-600 dark:text-zinc-400">{t.artist_name}</td>
                    <td className="p-4 text-zinc-600 dark:text-zinc-400">{t.split}</td>
                    <td className="p-4">
                      <Button size="sm" variant="outline" onClick={() => setEditRow(t)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > pageSize && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 text-sm">
            <div>Page {page} of {totalPages}</div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
              <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm bulk delete</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">This will permanently delete all selected tracks.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={bulkDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit track</DialogTitle>
          </DialogHeader>
          {editRow && (
            <div className="grid gap-3">
              <Input value={editRow.song_title} onChange={(e) => setEditRow({ ...editRow, song_title: e.target.value })} placeholder="Song Title" />
              <Input value={editRow.composer_name} onChange={(e) => setEditRow({ ...editRow, composer_name: e.target.value })} placeholder="Composer Name" />
              <Input value={editRow.isrc} onChange={(e) => setEditRow({ ...editRow, isrc: e.target.value })} placeholder="ISRC" />
              <Input value={editRow.artist_name} onChange={(e) => setEditRow({ ...editRow, artist_name: e.target.value })} placeholder="Artist" />
              <Input value={editRow.split} onChange={(e) => setEditRow({ ...editRow, split: e.target.value })} placeholder="Split (%)" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
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

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      router.push("/");
    }
  }, [user, authLoading, router]);

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
      setTracks((data as any) || []);
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
    setUploads((data as any) || []);
  };

  const filtered = useMemo(() => {
    if (!search) return tracks;
    const q = search.toLowerCase();
    return tracks.filter(
      (t) =>
        (t.song_title?.toLowerCase() || '').includes(q) ||
        (t.composer_name?.toLowerCase() || '').includes(q) ||
        (t.isrc?.toLowerCase() || '').includes(q)
    );
  }, [tracks, search]);

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

    // Map rows to DB records
    const now = new Date().toISOString();
    const toInsert = parsed.rows.map((r) => ({
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
      // Insert rows
      const { error } = await supabase.from("catalog_tracks").insert(toInsert);
      if (error) throw error;

      // Log upload
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Artist Catalog</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{artistEmail ? `Artist: ${artistEmail}` : ""}</p>
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


