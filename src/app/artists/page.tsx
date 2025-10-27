"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Users, Music, DollarSign, TrendingUp } from "lucide-react";
import type { UserProfile } from "@/types";

interface ArtistWithStats extends UserProfile {
  totalTracks: number;
  totalRevenue: number;
  totalStreams: number;
  pendingPayments: number;
}

export default function ArtistsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [artists, setArtists] = useState<ArtistWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      router.push("/");
    } else if (user && user.role === "admin") {
      fetchArtists();
    }
  }, [user, authLoading, router]);

  const fetchArtists = async () => {
    try {
      setLoading(true);
      
      // Fetch all artists
      const { data: artistProfiles, error: artistError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("role", "artist")
        .order("created_at", { ascending: false });

      if (artistError) throw artistError;

      // Fetch stats for each artist
      const artistsWithStats = await Promise.all(
        (artistProfiles || []).map(async (artist) => {
          // Get track count
          const { count: trackCount } = await supabase
            .from("tracks")
            .select("*", { count: "exact", head: true })
            .eq("artist_id", artist.id);

          // Get royalties
          const { data: royalties } = await supabase
            .from("royalties")
            .select("net_amount, usage_count")
            .eq("artist_id", artist.id);

          const totalRevenue = royalties?.reduce(
            (sum, r) => sum + Number(r.net_amount || 0),
            0
          ) || 0;

          const totalStreams = royalties?.reduce(
            (sum, r) => sum + Number(r.usage_count || 0),
            0
          ) || 0;

          // Get pending payment requests
          const { data: pendingRequests } = await supabase
            .from("payment_requests")
            .select("amount")
            .eq("artist_id", artist.id)
            .eq("status", "pending");

          const pendingPayments = pendingRequests?.reduce(
            (sum, r) => sum + Number(r.amount || 0),
            0
          ) || 0;

          return {
            ...artist,
            totalTracks: trackCount || 0,
            totalRevenue,
            totalStreams,
            pendingPayments,
          };
        })
      );

      setArtists(artistsWithStats);
    } catch (error) {
      console.error("Error fetching artists:", error);
      toast({
        title: "Error",
        description: "Failed to load artists",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const viewArtistDashboard = (artistId: string) => {
    setSelectedArtist(artistId);
    // In a complete implementation, this would show a modal or navigate to an artist-specific view
    toast({
      title: "Artist View",
      description: "Artist-specific dashboard view would be shown here",
    });
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-zinc-500">Loading artists...</div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return null;
  }

  const totalArtists = artists.length;
  const totalRevenue = artists.reduce((sum, a) => sum + a.totalRevenue, 0);
  const totalTracks = artists.reduce((sum, a) => sum + a.totalTracks, 0);
  const totalPendingPayments = artists.reduce((sum, a) => sum + a.pendingPayments, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Artist Management</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          View and manage all registered artists
        </p>
      </div>

      {/* Summary Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 bg-white dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <div className="text-sm text-zinc-500">Total Artists</div>
            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="mt-2 text-3xl font-semibold">{totalArtists}</div>
          <div className="text-xs text-zinc-500 mt-1">Registered users</div>
        </div>

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 bg-white dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <div className="text-sm text-zinc-500">Total Revenue</div>
            <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="mt-2 text-3xl font-semibold">
            ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-zinc-500 mt-1">All artists combined</div>
        </div>

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 bg-white dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <div className="text-sm text-zinc-500">Total Tracks</div>
            <Music className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="mt-2 text-3xl font-semibold">{totalTracks}</div>
          <div className="text-xs text-zinc-500 mt-1">In catalog</div>
        </div>

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 bg-white dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <div className="text-sm text-zinc-500">Pending Payments</div>
            <TrendingUp className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="mt-2 text-3xl font-semibold">
            ${totalPendingPayments.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-zinc-500 mt-1">Awaiting approval</div>
        </div>
      </section>

      {/* Artists Table */}
      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">All Artists</h2>
        </div>

        {artists.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            No artists registered yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr className="text-left text-zinc-600 dark:text-zinc-400">
                  <th className="p-4 font-medium">Artist Email</th>
                  <th className="p-4 font-medium">Tracks</th>
                  <th className="p-4 font-medium">Total Revenue</th>
                  <th className="p-4 font-medium">Total Streams</th>
                  <th className="p-4 font-medium">Pending Payments</th>
                  <th className="p-4 font-medium">Joined</th>
                  <th className="p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {artists.map((artist) => (
                  <tr
                    key={artist.id}
                    className="border-t border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                  >
                    <td className="p-4">
                      <div className="font-medium">{artist.email}</div>
                      <div className="text-xs text-zinc-500">ID: {artist.id.substring(0, 8)}...</div>
                    </td>
                    <td className="p-4 text-zinc-600 dark:text-zinc-400">
                      {artist.totalTracks}
                    </td>
                    <td className="p-4 text-zinc-600 dark:text-zinc-400 font-semibold">
                      ${artist.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-zinc-600 dark:text-zinc-400">
                      {artist.totalStreams.toLocaleString()}
                    </td>
                    <td className="p-4">
                      {artist.pendingPayments > 0 ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                          ${artist.pendingPayments.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="p-4 text-zinc-600 dark:text-zinc-400">
                      {new Date(artist.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => viewArtistDashboard(artist.id)}
                      >
                        View Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Quick Actions */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 bg-white dark:bg-zinc-950">
          <h3 className="font-semibold mb-2">Quick Actions</h3>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => router.push("/royalty-uploader")}
            >
              Upload Royalty Data
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => router.push("/royalties")}
            >
              Manage Payment Requests
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => router.push("/catalog")}
            >
              View All Tracks
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 bg-white dark:bg-zinc-950">
          <h3 className="font-semibold mb-3">System Information</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">Total Users:</span>
              <span className="font-medium">{totalArtists + 1}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">Active Artists:</span>
              <span className="font-medium">{artists.filter(a => a.totalTracks > 0).length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">Pending Requests:</span>
              <span className="font-medium">{artists.filter(a => a.pendingPayments > 0).length}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

