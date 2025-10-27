"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Edit, Trash2, Plus, Search, Trash } from "lucide-react";
import type { Track } from "@/types";

export default function CatalogPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [tracks, setTracks] = useState<Track[]>([]);
  const [filteredTracks, setFilteredTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Track | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [form, setForm] = useState({
    title: "",
    iswc: "",
    composers: "",
    release_date: "",
    platform: "",
    territory: "",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    } else if (user) {
      fetchTracks();
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    filterTracks();
  }, [searchTerm, tracks]);

  const fetchTracks = async () => {
    if (!user) return;

    try {
      setLoading(true);
      let query = supabase.from("tracks").select("*").order("created_at", { ascending: false });

      // Artists only see their own tracks
      if (user.role === "artist") {
        query = query.eq("artist_id", user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTracks(data || []);
    } catch (error) {
      console.error("Error fetching tracks:", error);
      toast({
        title: "Error",
        description: "Failed to load tracks",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterTracks = () => {
    if (!searchTerm) {
      setFilteredTracks(tracks);
      return;
    }

    const searchLower = searchTerm.toLowerCase();
    const filtered = tracks.filter(
      (track) =>
        track.title.toLowerCase().includes(searchLower) ||
        track.iswc?.toLowerCase().includes(searchLower) ||
        track.composers?.toLowerCase().includes(searchLower) ||
        track.platform?.toLowerCase().includes(searchLower) ||
        track.territory?.toLowerCase().includes(searchLower)
    );
    setFilteredTracks(filtered);
  };

  const handleAddTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.role !== "admin") return;

    try {
      const { error } = await supabase.from("tracks").insert({
        artist_id: user.id, // Admin can specify artist_id in a more complete implementation
        title: form.title,
        iswc: form.iswc || null,
        composers: form.composers || null,
        release_date: form.release_date || null,
        platform: form.platform || null,
        territory: form.territory || null,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Track added successfully",
      });

      setForm({
        title: "",
        iswc: "",
        composers: "",
        release_date: "",
        platform: "",
        territory: "",
      });
      setIsAddDialogOpen(false);
      fetchTracks();
    } catch (error) {
      console.error("Error adding track:", error);
      toast({
        title: "Error",
        description: "Failed to add track",
        variant: "destructive",
      });
    }
  };

  const handleEditTrack = async () => {
    if (!user || user.role !== "admin" || !editingTrack) return;

    try {
      const { error } = await supabase
        .from("tracks")
        .update({
          title: form.title,
          iswc: form.iswc || null,
          composers: form.composers || null,
          release_date: form.release_date || null,
          platform: form.platform || null,
          territory: form.territory || null,
        })
        .eq("id", editingTrack.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Track updated successfully",
      });

      setEditingTrack(null);
      setForm({
        title: "",
        iswc: "",
        composers: "",
        release_date: "",
        platform: "",
        territory: "",
      });
      fetchTracks();
    } catch (error) {
      console.error("Error updating track:", error);
      toast({
        title: "Error",
        description: "Failed to update track",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTrack = async () => {
    if (!user || user.role !== "admin" || !deleteConfirm) return;

    try {
      const { error } = await supabase.from("tracks").delete().eq("id", deleteConfirm.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Track deleted successfully",
      });

      setDeleteConfirm(null);
      fetchTracks();
    } catch (error) {
      console.error("Error deleting track:", error);
      toast({
        title: "Error",
        description: "Failed to delete track",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAllTracks = async () => {
    if (!user || user.role !== "admin") return;

    try {
      const { error } = await supabase.from("tracks").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      if (error) throw error;

      toast({
        title: "Success",
        description: "All tracks deleted successfully",
      });

      setDeleteAllConfirm(false);
      fetchTracks();
    } catch (error) {
      console.error("Error deleting all tracks:", error);
      toast({
        title: "Error",
        description: "Failed to delete all tracks",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (track: Track) => {
    setEditingTrack(track);
    setForm({
      title: track.title,
      iswc: track.iswc || "",
      composers: track.composers || "",
      release_date: track.release_date || "",
      platform: track.platform || "",
      territory: track.territory || "",
    });
  };

  const closeEditDialog = () => {
    setEditingTrack(null);
    setForm({
      title: "",
      iswc: "",
      composers: "",
      release_date: "",
      platform: "",
      territory: "",
    });
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-zinc-500">Loading catalog...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isAdmin = user.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Track Catalog</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            {isAdmin ? "Manage all tracks" : "View your tracks"}
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button
              onClick={() => setDeleteAllConfirm(true)}
              variant="outline"
              className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
            >
              <Trash className="h-4 w-4 mr-2" />
              Delete All
            </Button>
            <Button onClick={() => setIsAddDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Track
            </Button>
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by title, ISWC, composer, platform, or territory..."
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr className="text-left text-zinc-600 dark:text-zinc-400">
              <th className="p-4 font-medium">Title</th>
              <th className="p-4 font-medium">ISWC</th>
              <th className="p-4 font-medium">Composers</th>
              <th className="p-4 font-medium">Release Date</th>
              <th className="p-4 font-medium">Platform</th>
              <th className="p-4 font-medium">Territory</th>
              {isAdmin && <th className="p-4 font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredTracks.length === 0 ? (
              <tr>
                <td className="p-4 text-center text-zinc-500" colSpan={isAdmin ? 7 : 6}>
                  {searchTerm ? "No tracks match your search" : "No tracks found"}
                </td>
              </tr>
            ) : (
              filteredTracks.map((track) => (
                <tr key={track.id} className="border-t border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                  <td className="p-4 font-medium">{track.title}</td>
                  <td className="p-4 text-zinc-600 dark:text-zinc-400">{track.iswc || "-"}</td>
                  <td className="p-4 text-zinc-600 dark:text-zinc-400">{track.composers || "-"}</td>
                  <td className="p-4 text-zinc-600 dark:text-zinc-400">
                    {track.release_date ? new Date(track.release_date).toLocaleDateString() : "-"}
                  </td>
                  <td className="p-4 text-zinc-600 dark:text-zinc-400">{track.platform || "-"}</td>
                  <td className="p-4 text-zinc-600 dark:text-zinc-400">{track.territory || "-"}</td>
                  {isAdmin && (
                    <td className="p-4">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(track)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeleteConfirm(track)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Track</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddTrack} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title *</label>
              <Input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Enter track title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">ISWC</label>
              <Input
                value={form.iswc}
                onChange={(e) => setForm({ ...form, iswc: e.target.value })}
                placeholder="e.g. T-123.456.789-0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Composers</label>
              <Input
                value={form.composers}
                onChange={(e) => setForm({ ...form, composers: e.target.value })}
                placeholder="e.g. John Doe, Jane Smith"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Release Date</label>
              <Input
                type="date"
                value={form.release_date}
                onChange={(e) => setForm({ ...form, release_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Platform</label>
              <Input
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
                placeholder="e.g. Spotify, Apple Music"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Territory</label>
              <Input
                value={form.territory}
                onChange={(e) => setForm({ ...form, territory: e.target.value })}
                placeholder="e.g. Global, US, UK"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Add Track</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingTrack} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Track</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title *</label>
              <Input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">ISWC</label>
              <Input
                value={form.iswc}
                onChange={(e) => setForm({ ...form, iswc: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Composers</label>
              <Input
                value={form.composers}
                onChange={(e) => setForm({ ...form, composers: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Release Date</label>
              <Input
                type="date"
                value={form.release_date}
                onChange={(e) => setForm({ ...form, release_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Platform</label>
              <Input
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Territory</label>
              <Input
                value={form.territory}
                onChange={(e) => setForm({ ...form, territory: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>
              Cancel
            </Button>
            <Button onClick={handleEditTrack}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Track</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Are you sure you want to delete "{deleteConfirm?.title}"? This action cannot be undone and will also delete associated royalty records.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteTrack}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete All Confirmation */}
      <Dialog open={deleteAllConfirm} onOpenChange={setDeleteAllConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete All Tracks</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Are you sure you want to delete <span className="font-bold text-red-600">ALL {tracks.length} tracks</span>?
            </p>
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
              <p className="text-sm text-red-800 dark:text-red-200 font-semibold">⚠️ Warning</p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                This action cannot be undone. All tracks and their associated royalty records will be permanently deleted.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAllConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAllTracks}>
              Delete All Tracks
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
