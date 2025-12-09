"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useToast } from "@/components/ui/use-toast";
import { createClientTimer } from "@/lib/performanceLogger";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Edit, Trash2, Plus, Search, Trash, Music, RefreshCw } from "lucide-react";
import type { Track, SpotifyAlbumCoverResponse } from "@/types";

export default function CatalogPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [filteredTracks, setFilteredTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Track | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Track detail modal state (for viewing Spotify artwork)
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [detailSpotifyData, setDetailSpotifyData] = useState<SpotifyAlbumCoverResponse | null>(null);
  const [fetchingDetailImage, setFetchingDetailImage] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === "dark";
  
  const [form, setForm] = useState({
    title: "",
    iswc: "",
    isrc: "",
    composers: "",
    release_date: "",
    platform: "",
    territory: "",
    split: "",
  });

  // Performance timer
  const perfTimer = useRef(createClientTimer("CatalogPage"));

  const fetchTracks = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      perfTimer.current.startPageLoad();
      
      perfTimer.current.startApiRequest("/api/data/tracks");
      const res = await fetch(
        `/api/data/tracks?user_id=${user.id}&role=${user.role}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      perfTimer.current.endApiRequest("/api/data/tracks");

      if (json.error) throw new Error(json.error);
      console.log('[Catalog] Fetched tracks:', json.data?.length || 0, 'tracks');
      setTracks(json.data || []);
      setFilteredTracks(json.data || []); // Initialize filteredTracks immediately
    } catch (error) {
      console.error("Error fetching tracks:", error);
      toast({
        title: "Error",
        description: "Failed to load tracks",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      perfTimer.current.endPageLoad();
      perfTimer.current.logSummary();
    }
  }, [user, toast]);

  const filterTracks = () => {
    if (!searchTerm) {
      setFilteredTracks(tracks);
      return;
    }

    const searchLower = searchTerm.toLowerCase();
    const filtered = tracks.filter(
      (track) =>
        track.title.toLowerCase().includes(searchLower) ||
        track.isrc?.toLowerCase().includes(searchLower) ||
        track.iswc?.toLowerCase().includes(searchLower) ||
        track.composers?.toLowerCase().includes(searchLower) ||
        track.platform?.toLowerCase().includes(searchLower) ||
        track.territory?.toLowerCase().includes(searchLower) ||
        track.split?.toLowerCase().includes(searchLower)
    );
    setFilteredTracks(filtered);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    } else if (user) {
      fetchTracks();
    }
  }, [user, authLoading, router, fetchTracks]);

  useEffect(() => {
    filterTracks();
  }, [searchTerm, tracks]);

  const handleAddTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.role !== "admin") return;

    try {
      const res = await fetch("/api/data/tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artist_id: user.id,
          title: form.title,
          iswc: form.iswc || null,
          isrc: form.isrc || null,
          composers: form.composers || null,
          release_date: form.release_date || null,
          platform: form.platform || null,
          territory: form.territory || null,
          split: form.split || null,
        }),
      });
      const json = await res.json();

      if (json.error) throw new Error(json.error);

      toast({
        title: "Success",
        description: "Track added successfully",
      });

      setForm({
        title: "",
        iswc: "",
        isrc: "",
        composers: "",
        release_date: "",
        platform: "",
        territory: "",
        split: "",
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
      const res = await fetch("/api/data/tracks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingTrack.id,
          title: form.title,
          iswc: form.iswc || null,
          isrc: form.isrc || null,
          composers: form.composers || null,
          release_date: form.release_date || null,
          platform: form.platform || null,
          territory: form.territory || null,
          split: form.split || null,
        }),
      });
      const json = await res.json();

      if (json.error) throw new Error(json.error);

      toast({
        title: "Success",
        description: "Track updated successfully",
      });

      setEditingTrack(null);
      setForm({
        title: "",
        iswc: "",
        isrc: "",
        composers: "",
        release_date: "",
        platform: "",
        territory: "",
        split: "",
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
      const res = await fetch(`/api/data/tracks?id=${deleteConfirm.id}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (json.error) throw new Error(json.error);

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
      const res = await fetch("/api/data/tracks?delete_all=true", {
        method: "DELETE",
      });
      const json = await res.json();

      if (json.error) throw new Error(json.error);

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
      isrc: track.isrc || "",
      composers: track.composers || "",
      release_date: track.release_date || "",
      platform: track.platform || "",
      territory: track.territory || "",
      split: track.split || "",
    });
  };

  const closeEditDialog = () => {
    setEditingTrack(null);
    setForm({
      title: "",
      iswc: "",
      isrc: "",
      composers: "",
      release_date: "",
      platform: "",
      territory: "",
      split: "",
    });
  };

  // Fetch Spotify data ONLY when viewing track details (not in table)
  const fetchSpotifyForDetail = useCallback(async (track: Track) => {
    if (!track.isrc) {
      setDetailSpotifyData(null);
      return;
    }
    
    // If track already has cached Spotify data in DB, use it
    if (track.spotify_image_url) {
      setDetailSpotifyData({
        image: track.spotify_image_url,
        trackName: track.spotify_track_name,
        artistName: track.spotify_artist_name,
        albumName: null,
        spotifyTrackId: track.spotify_track_id,
        cached: true,
      });
      return;
    }
    
    setFetchingDetailImage(true);
    try {
      const res = await fetch("/api/spotify/album-cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isrc: track.isrc }),
      });
      const data: SpotifyAlbumCoverResponse = await res.json();
      setDetailSpotifyData(data);
      
      // Save to DB for future use
      if (data.image && !data.error) {
        await fetch("/api/data/tracks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: track.id,
            spotify_image_url: data.image,
            spotify_track_id: data.spotifyTrackId,
            spotify_artist_name: data.artistName,
            spotify_track_name: data.trackName,
            spotify_fetched_at: new Date().toISOString(),
          }),
        });
      }
    } catch (error) {
      console.error("Error fetching Spotify data:", error);
      setDetailSpotifyData(null);
    } finally {
      setFetchingDetailImage(false);
    }
  }, []);

  // Open track detail modal and fetch Spotify data
  const openTrackDetail = (track: Track) => {
    setSelectedTrack(track);
    setDetailSpotifyData(null);
    fetchSpotifyForDetail(track);
  };

  // Close track detail modal
  const closeTrackDetail = () => {
    setSelectedTrack(null);
    setDetailSpotifyData(null);
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Loading catalog...</div>
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
          <h1 className="text-2xl font-semibold transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>Track Catalog</h1>
          <p className="text-sm mt-1 transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors" style={{ color: isDark ? '#9CA3AF' : '#9CA3AF' }} />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by title, composer, or ISRC..."
          className="pl-9"
        />
      </div>

      {/* Track count */}
      <div className="text-sm" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
        {filteredTracks.length} {filteredTracks.length === 1 ? 'track' : 'tracks'}
        {searchTerm && ` matching "${searchTerm}"`}
      </div>

      {/* Text-Only Table - NO IMAGES */}
      <div 
        className="rounded-lg border overflow-x-auto transition-colors"
        style={{
          backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}
      >
        <table className="w-full text-sm">
          <thead 
            className="text-left transition-colors"
            style={{
              backgroundColor: isDark ? 'rgba(31, 41, 55, 0.5)' : '#F9FAFB',
            }}
          >
            <tr style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
              <th className="p-4 font-medium">Song Title</th>
              <th className="p-4 font-medium">Composer Name</th>
              <th className="p-4 font-medium">ISRC</th>
              <th className="p-4 font-medium">Artist Name</th>
              <th className="p-4 font-medium">Split (%)</th>
              <th className="p-4 font-medium">Upload Date</th>
              {isAdmin && <th className="p-4 font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredTracks.length === 0 ? (
              <tr>
                <td className="p-4 text-center transition-colors" colSpan={isAdmin ? 7 : 6} style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
                  {searchTerm ? "No tracks match your search" : "No tracks found"}
                </td>
              </tr>
            ) : (
              filteredTracks.map((track) => (
                <tr 
                  key={track.id} 
                  className="border-t transition-colors cursor-pointer"
                  style={{
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                  onClick={() => openTrackDetail(track)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(31, 41, 55, 0.5)' : '#F9FAFB';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <td className="p-4 font-medium transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>{track.title}</td>
                  <td className="p-4 transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>{track.composers || "-"}</td>
                  <td className="p-4 transition-colors font-mono text-xs" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>{track.isrc || "-"}</td>
                  <td className="p-4 transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>{track.spotify_artist_name || "-"}</td>
                  <td className="p-4 transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>{track.split || "-"}</td>
                  <td className="p-4 transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
                    {track.created_at ? new Date(track.created_at).toLocaleDateString() : "-"}
                  </td>
                  {isAdmin && (
                    <td className="p-4">
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
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

      {/* Track Detail Modal - Spotify artwork ONLY appears here */}
      <Dialog open={!!selectedTrack} onOpenChange={(open) => !open && closeTrackDetail()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Track Details</DialogTitle>
          </DialogHeader>
          {selectedTrack && (
            <div className="space-y-6">
              {/* Spotify Album Art - ONLY shown in this modal */}
              <div className="flex justify-center">
                <div className="w-48 h-48 rounded-xl overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                  {fetchingDetailImage ? (
                    <RefreshCw className="h-12 w-12 text-white/70 animate-spin" />
                  ) : detailSpotifyData?.image ? (
                    <img 
                      src={detailSpotifyData.image} 
                      alt={selectedTrack.title} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Music className="h-16 w-16 text-white/50" />
                  )}
                </div>
              </div>

              {/* Track Info */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Song Title</label>
                  <p className="text-lg font-semibold" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>{selectedTrack.title}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Composer</label>
                    <p style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>{selectedTrack.composers || "-"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Artist</label>
                    <p style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>{detailSpotifyData?.artistName || selectedTrack.spotify_artist_name || "-"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>ISRC</label>
                    <p className="font-mono text-sm" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>{selectedTrack.isrc || "-"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Split</label>
                    <p style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>{selectedTrack.split || "-"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Upload Date</label>
                    <p style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>
                      {selectedTrack.created_at ? new Date(selectedTrack.created_at).toLocaleDateString() : "-"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>ISWC</label>
                    <p className="font-mono text-sm" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>{selectedTrack.iswc || "-"}</p>
                  </div>
                </div>
                
                {/* Spotify Track Name (if different) */}
                {detailSpotifyData?.trackName && detailSpotifyData.trackName !== selectedTrack.title && (
                  <div>
                    <label className="text-xs font-medium" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Spotify Track Name</label>
                    <p style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>{detailSpotifyData.trackName}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              {isAdmin && (
                <div className="flex gap-2 pt-4 border-t" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
                  <Button 
                    variant="outline" 
                    onClick={() => { closeTrackDetail(); openEditDialog(selectedTrack); }}
                    className="flex-1"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => { closeTrackDetail(); setDeleteConfirm(selectedTrack); }}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

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
              <label className="block text-sm font-medium mb-1">ISRC (for Spotify artwork)</label>
              <Input
                value={form.isrc}
                onChange={(e) => setForm({ ...form, isrc: e.target.value })}
                placeholder="e.g. USRC12345678"
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
            <div>
              <label className="block text-sm font-medium mb-1">Split Percentage</label>
              <Input
                value={form.split}
                onChange={(e) => setForm({ ...form, split: e.target.value })}
                placeholder="e.g. 100%, 50%"
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
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div>
              <label className="block text-sm font-medium mb-1">Title *</label>
              <Input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">ISRC (for Spotify artwork)</label>
              <Input
                value={form.isrc}
                onChange={(e) => setForm({ ...form, isrc: e.target.value })}
                placeholder="e.g. USRC12345678"
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
            <div>
              <label className="block text-sm font-medium mb-1">Split Percentage</label>
              <Input
                value={form.split}
                onChange={(e) => setForm({ ...form, split: e.target.value })}
                placeholder="e.g. 100%, 50%"
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
