"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useToast } from "@/components/ui/use-toast";
import { createClientTimer } from "@/lib/performanceLogger";
import { Button } from "@/components/ui/button";
import { Users, Music, DollarSign } from "lucide-react";
import type { UserProfile } from "@/types";

interface ArtistWithStats extends UserProfile {
  totalTracks: number;
  totalRevenue: number;
  totalStreams: number;
}

export default function ArtistsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [artists, setArtists] = useState<ArtistWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === "dark";

  // Performance timer
  const perfTimer = useRef(createClientTimer("ArtistsPage"));

  const fetchArtists = useCallback(async () => {
    try {
      setLoading(true);
      perfTimer.current.startPageLoad();
      
      // Fetch all artists with stats via API route
      perfTimer.current.startApiRequest("/api/data/artists-stats");
      const res = await fetch("/api/data/artists-stats", { cache: "no-store" });
      const json = await res.json();
      perfTimer.current.endApiRequest("/api/data/artists-stats");

      if (json.error) {
        throw new Error(json.error);
      }

      setArtists(json.data || []);
    } catch (error) {
      console.error("Error fetching artists:", error);
      toast({
        title: "Error",
        description: "Failed to load artists",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      perfTimer.current.endPageLoad();
      perfTimer.current.logSummary();
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      router.push("/");
    } else if (user && user.role === "admin") {
      fetchArtists();
    }
  }, [user, authLoading, router, fetchArtists]);

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
        <div className="transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Loading artists...</div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return null;
  }

  const totalArtists = artists.length;
  const totalRevenue = artists.reduce((sum, a) => sum + a.totalRevenue, 0);
  const totalTracks = artists.reduce((sum, a) => sum + a.totalTracks, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>Artist Management</h1>
        <p className="text-sm mt-1 transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
          View and manage all registered artists
        </p>
      </div>

      {/* Summary Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div 
          className="rounded-lg border p-6 transition-colors"
          style={{
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="text-sm transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Total Artists</div>
            <Users className="h-5 w-5 transition-colors" style={{ color: '#3B82F6' }} />
          </div>
          <div className="mt-2 text-3xl font-semibold transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>{totalArtists}</div>
          <div className="text-xs mt-1 transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Registered users</div>
        </div>

        <div 
          className="rounded-lg border p-6 transition-colors"
          style={{
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="text-sm transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Total Revenue</div>
            <DollarSign className="h-5 w-5 transition-colors" style={{ color: '#10B981' }} />
          </div>
          <div className="mt-2 text-3xl font-semibold transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>
            ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs mt-1 transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>All artists combined</div>
        </div>

        <div 
          className="rounded-lg border p-6 transition-colors"
          style={{
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="text-sm transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Total Tracks</div>
            <Music className="h-5 w-5 transition-colors" style={{ color: '#A855F7' }} />
          </div>
          <div className="mt-2 text-3xl font-semibold transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>{totalTracks}</div>
          <div className="text-xs mt-1 transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>In catalog</div>
        </div>
      </section>

      {/* Artists Table */}
      <section 
        className="rounded-lg border overflow-hidden transition-colors"
        style={{
          backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}
      >
        <div 
          className="px-6 py-4 border-b transition-colors"
          style={{
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <h2 className="text-lg font-semibold transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>All Artists</h2>
        </div>

        {artists.length === 0 ? (
          <div className="p-8 text-center transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
            No artists registered yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead 
                className="text-left transition-colors"
                style={{
                  backgroundColor: isDark ? 'rgba(31, 41, 55, 0.5)' : '#F9FAFB',
                }}
              >
                <tr style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
                  <th className="p-4 font-medium">Artist Email</th>
                  <th className="p-4 font-medium">Tracks</th>
                  <th className="p-4 font-medium">Total Revenue</th>
                  <th className="p-4 font-medium">Total Streams</th>
                  <th className="p-4 font-medium">Joined</th>
                  <th className="p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {artists.map((artist) => (
                  <tr
                    key={artist.id}
                    className="border-t transition-colors"
                    style={{
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isDark ? 'rgba(31, 41, 55, 0.5)' : '#F9FAFB';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <td className="p-4">
                      <div className="font-medium transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>{artist.email}</div>
                      <div className="text-xs transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>ID: {artist.id.substring(0, 8)}...</div>
                    </td>
                    <td className="p-4 transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
                      {artist.totalTracks}
                    </td>
                    <td className="p-4 font-semibold transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
                      ${artist.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
                      {artist.totalStreams.toLocaleString()}
                    </td>
                    <td className="p-4 transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
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
        <div 
          className="rounded-lg border p-6 transition-colors"
          style={{
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <h3 className="font-semibold mb-2 transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>Quick Actions</h3>
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
              onClick={() => router.push("/catalog")}
            >
              View All Tracks
            </Button>
          </div>
        </div>

        <div 
          className="rounded-lg border p-6 transition-colors"
          style={{
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <h3 className="font-semibold mb-3 transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>System Information</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Total Users:</span>
              <span className="font-medium transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>{totalArtists + 1}</span>
            </div>
            <div className="flex justify-between">
              <span className="transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Active Artists:</span>
              <span className="font-medium transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>{artists.filter(a => a.totalTracks > 0).length}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}






