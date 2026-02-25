"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Music, Loader2, Image as ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useTheme } from "next-themes";

interface TrackRow {
  id: string;
  song_title: string;
  composer_name: string;
  isrc: string;
  artist_name: string;
  split: string;
  created_at: string;
  spotify_image_url: string | null;
}

export default function MyCatalogPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [artistId, setArtistId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [search, setSearch] = useState("");
  const [fetching, setFetching] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [fetchingImages, setFetchingImages] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 100;

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === "dark";

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const init = async () => {
      console.log('🔍 Finding artist for user:', user.id);
      const { data: artist, error: artistError } = await supabase
        .from("artists")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (artistError) {
        console.error('❌ Error fetching artist:', artistError);
        setArtistId(null);
        setTracks([]);
        setFetching(false);
        return;
      }

      if (!artist) {
        console.warn('⚠️ No artist found for user:', user.id);
        setArtistId(null);
        setTracks([]);
        setFetching(false);
        return;
      }

      console.log('✅ Found artist:', artist.id);
      setArtistId(artist.id);
      await fetchTracks(artist.id);
    };
    void init();
  }, [user]);

  const fetchTracks = async (aid: string) => {
    console.log('🎵 Fetching tracks for artist:', aid);
    setFetching(true);
    const { data, error } = await supabase
      .from("tracks")
      .select("id,song_title,composer_name,isrc,artist_name,split,created_at,spotify_image_url")
      .eq("artist_id", aid)
      .not('isrc', 'is', null)
      .neq('isrc', '')
      .neq('isrc', 'ADVANCE')
      .order("created_at", { ascending: false });

    if (error) {
      console.error('❌ Error fetching tracks:', error);
      setTracks([]);
      setFetching(false);
      return;
    }

    console.log('✅ Fetched tracks:', data?.length || 0, 'tracks');
    setTracks((data as any) || []);
    setLastUpdated(data && data.length > 0 ? data[0].created_at : null);
    setFetching(false);
  };

  const fetchMissingImages = async (trackIds: string[]) => {
    if (trackIds.length === 0) return;

    setFetchingImages(true);
    // Process only the tracks on current page - usually <= 100, so we can do it in one or two batches
    const BATCH_SIZE = 50;

    // Use a flag to track if we should continue processing
    let shouldContinue = true;

    try {
      for (let i = 0; i < trackIds.length; i += BATCH_SIZE) {
        if (!shouldContinue) break;

        const batch = trackIds.slice(i, i + BATCH_SIZE);

        try {
          const response = await fetch('/api/spotify/fetch-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trackIds: batch }),
          });

          if (response.ok) {
            const result = await response.json();

            // Update tracks state incrementally
            setTracks(prevTracks =>
              prevTracks.map(track =>
                result.updatedImages?.[track.id]
                  ? { ...track, spotify_image_url: result.updatedImages[track.id] }
                  : track
              )
            );
          } else {
            console.error('❌ Error fetching batch images');
            // If one batch fails hard, maybe stop to prevent spamming if it's a 429/500 issue
            // but for now we just log it.
          }
        } catch (batchError) {
          console.error('❌ Error in batch request:', batchError);
        }
      }
    } catch (error) {
      console.error('❌ Error in fetchMissingImages process:', error);
    } finally {
      setFetchingImages(false);
    }
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

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const paginatedTracks = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  // Fetch images only for visible tracks
  useEffect(() => {
    if (paginatedTracks.length === 0) return;

    const visibleTracksWithoutImages = paginatedTracks.filter(t => !t.spotify_image_url && t.isrc);

    if (visibleTracksWithoutImages.length > 0) {
      // Small debounce/timeout to ensure render finishes or just wait a tick
      const timer = setTimeout(() => {
        fetchMissingImages(visibleTracksWithoutImages.map(t => t.id));
      }, 500); // 500ms delay to let user settle on page

      return () => clearTimeout(timer);
    }
  }, [paginatedTracks]);

  if (loading || !user) return null;

  return (
    <div
      className="space-y-6"
      style={{
        backgroundColor: isDark ? '#0f0f0f' : '#FFFFFF',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif",
        minHeight: '100vh',
        padding: '24px',
      }}
    >
      {/* Header Section */}
      <div
        style={{
          backgroundColor: isDark ? '#1a1a1a' : '#FFFFFF',
          padding: '24px',
          borderRadius: '12px',
          boxShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.05)',
        }}
      >
        <h1
          className="text-2xl font-semibold"
          style={{
            color: isDark ? '#f5f5f5' : '#111827',
            marginBottom: '4px',
            fontSize: '20px',
            fontWeight: 'bold',
          }}
        >
          My Catalog
        </h1>
        <p className="text-sm mt-1" style={{ color: isDark ? '#a1a1aa' : '#6B7280' }}>
          {lastUpdated ? `Last Updated: ${new Date(lastUpdated).toLocaleString()}` : "No uploads yet"}
        </p>
      </div>

      {/* Search Bar Section */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          backgroundColor: isDark ? '#1a1a1a' : '#FFFFFF',
          boxShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.05)',
          border: isDark ? 'none' : '1px solid #E5E7EB',
        }}
      >
        <div
          className="px-4 py-3 border-b"
          style={{
            borderColor: isDark ? '#2a2a2a' : '#E5E7EB',
            backgroundColor: isDark ? 'transparent' : '#F1F3F5',
            borderRadius: '10px 10px 0 0',
          }}
        >
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors"
              style={{ color: isDark ? '#6b7280' : '#9CA3AF' }}
            />
            <Input
              placeholder="Search by title, composer, or ISRC"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 transition-all"
              style={{
                backgroundColor: isDark ? '#121212' : '#F1F3F5',
                border: isDark ? '1px solid #2a2a2a' : 'none',
                color: isDark ? '#e4e4e7' : '#1A1A1A',
                borderRadius: '10px',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.outline = 'none';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.2)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = isDark ? '#2a2a2a' : 'transparent';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>
        </div>

        {/* Table Section */}
        <div
          className="overflow-x-auto"
          style={{
            border: isDark ? 'none' : '1px solid #E5E7EB',
            borderTop: 'none',
            borderBottomLeftRadius: '12px',
            borderBottomRightRadius: '12px',
          }}
        >
          <table className="w-full text-sm">
            <thead style={{
              backgroundColor: isDark ? '#181818' : '#F7F8FA',
              borderBottom: isDark ? '1px solid #2a2a2a' : '1px solid #E5E7EB'
            }}>
              <tr className="text-left">
                <th className="font-medium" style={{
                  color: isDark ? '#d1d5db' : '#1A1A1A',
                  padding: '14px 16px',
                  fontWeight: 500,
                  width: '280px'
                }}>
                  Song Title
                </th>
                <th className="font-medium" style={{
                  color: isDark ? '#d1d5db' : '#1A1A1A',
                  padding: '14px 16px',
                  fontWeight: 500
                }}>
                  Composer Name
                </th>
                <th className="font-medium" style={{
                  color: isDark ? '#d1d5db' : '#1A1A1A',
                  padding: '14px 16px',
                  fontWeight: 500
                }}>
                  ISRC
                </th>
                <th className="font-medium" style={{
                  color: isDark ? '#d1d5db' : '#1A1A1A',
                  padding: '14px 16px',
                  fontWeight: 500
                }}>
                  Artist Name
                </th>
                <th className="font-medium" style={{
                  color: isDark ? '#d1d5db' : '#1A1A1A',
                  padding: '14px 16px',
                  fontWeight: 500
                }}>
                  Split (%)
                </th>
                <th className="font-medium" style={{
                  color: isDark ? '#d1d5db' : '#1A1A1A',
                  padding: '14px 16px',
                  fontWeight: 500
                }}>
                  Upload Date
                </th>
              </tr>
            </thead>
            <tbody>
              {fetching ? (
                <tr>
                  <td
                    className="text-center"
                    colSpan={6}
                    style={{
                      padding: '48px 16px',
                      color: isDark ? '#9ca3af' : '#8A8A8A',
                      backgroundColor: isDark ? '#1a1a1a' : '#FFFFFF',
                    }}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-6 w-6 animate-spin" style={{ color: isDark ? '#9ca3af' : '#9CA3AF' }} />
                      <span>Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    className="text-center"
                    colSpan={6}
                    style={{
                      padding: '48px 16px',
                      color: isDark ? '#a1a1aa' : '#8A8A8A',
                      backgroundColor: isDark ? '#1a1a1a' : '#FFFFFF',
                    }}
                  >
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Music className="h-8 w-8" style={{ color: isDark ? '#6b7280' : '#9CA3AF', opacity: 0.5 }} />
                      <div>
                        <p style={{
                          color: isDark ? '#a1a1aa' : '#8A8A8A',
                          fontSize: '14px'
                        }}>
                          No tracks found
                        </p>
                        {search && (
                          <p style={{
                            color: isDark ? '#a1a1aa' : '#8A8A8A',
                            fontSize: '12px',
                            marginTop: '4px'
                          }}>
                            Try adjusting your search terms
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedTracks.map((t, index) => (
                  <tr
                    key={t.id}
                    className="transition-colors duration-150"
                    style={{
                      backgroundColor: isDark
                        ? (index % 2 === 0 ? '#1a1a1a' : '#202020')
                        : (index % 2 === 0 ? '#FFFFFF' : '#FAFAFA'),
                      borderBottom: isDark
                        ? '1px solid rgba(42, 42, 42, 0.5)'
                        : '1px solid #E5E7EB',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isDark ? '#242424' : '#F9FAFB';
                      e.currentTarget.style.boxShadow = isDark
                        ? '0 1px 4px rgba(255, 255, 255, 0.03)'
                        : '0 1px 2px rgba(0, 0, 0, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isDark
                        ? (index % 2 === 0 ? '#1a1a1a' : '#202020')
                        : (index % 2 === 0 ? '#FFFFFF' : '#FAFAFA');
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '6px',
                            overflow: 'hidden',
                            backgroundColor: isDark ? '#2a2a2a' : '#f3f4f6',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {t.spotify_image_url ? (
                            <img
                              src={t.spotify_image_url}
                              alt={t.song_title}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                              }}
                            />
                          ) : (
                            <ImageIcon
                              className="h-5 w-5"
                              style={{ color: isDark ? '#4b5563' : '#9ca3af' }}
                            />
                          )}
                        </div>
                        <span style={{
                          color: isDark ? '#e4e4e7' : '#1A1A1A',
                          fontWeight: index === 0 ? 500 : 400,
                        }}>
                          {t.song_title}
                        </span>
                      </div>
                    </td>
                    <td className="p-4" style={{ color: isDark ? '#d1d5db' : '#1A1A1A' }}>
                      {t.composer_name}
                    </td>
                    <td className="p-4" style={{ color: isDark ? '#d1d5db' : '#1A1A1A' }}>
                      <span style={{ fontFamily: "'SF Mono', 'Monaco', monospace", fontSize: '13px' }}>
                        {t.isrc}
                      </span>
                    </td>
                    <td className="p-4" style={{ color: isDark ? '#d1d5db' : '#1A1A1A' }}>
                      {t.artist_name}
                    </td>
                    <td className="p-4" style={{ color: isDark ? '#d1d5db' : '#1A1A1A' }}>
                      {t.split}%
                    </td>
                    <td className="p-4" style={{ color: isDark ? '#a1a1aa' : '#6B7280' }}>
                      {new Date(t.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {!fetching && filtered.length > 0 && (
        <div className="flex items-center justify-between px-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-2 transition-all"
            style={{
              backgroundColor: isDark ? '#1a1a1a' : '#FFFFFF',
              borderColor: isDark ? '#2a2a2a' : '#E5E7EB',
              color: isDark ? (currentPage === 1 ? '#52525b' : '#e4e4e7') : (currentPage === 1 ? '#9CA3AF' : '#111827'),
              opacity: currentPage === 1 ? 0.5 : 1,
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>

          <span className="text-sm font-medium" style={{ color: isDark ? '#a1a1aa' : '#6B7280' }}>
            Page {currentPage} of {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="flex items-center gap-2 transition-all"
            style={{
              backgroundColor: isDark ? '#1a1a1a' : '#FFFFFF',
              borderColor: isDark ? '#2a2a2a' : '#E5E7EB',
              color: isDark ? (currentPage === totalPages ? '#52525b' : '#e4e4e7') : (currentPage === totalPages ? '#9CA3AF' : '#111827'),
              opacity: currentPage === totalPages ? 0.5 : 1,
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
            }}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )
      }

      {/* Summary Card */}
      {
        !fetching && filtered.length > 0 && (
          <div
            className="rounded-xl p-4 transition-all"
            style={{
              backgroundColor: isDark ? '#1a1a1a' : '#FFFFFF',
              boxShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.05)',
              border: isDark ? 'none' : '1px solid #E5E7EB',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="rounded-lg p-2 transition-colors"
                  style={{
                    backgroundColor: isDark
                      ? 'rgba(59, 130, 246, 0.15)'
                      : 'rgba(59, 130, 246, 0.1)',
                  }}
                >
                  <Music className="h-5 w-5" style={{ color: '#3b82f6' }} />
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: isDark ? '#a1a1aa' : '#6B7280' }}>
                    Total Tracks
                  </p>
                  <p className="text-2xl font-semibold" style={{ color: isDark ? '#f5f5f5' : '#111827' }}>
                    {filtered.length}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-4">
                  {fetchingImages && (
                    <div className="flex items-center gap-2 text-sm" style={{ color: isDark ? '#a1a1aa' : '#6B7280' }}>
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  )}
                  {search && (
                    <div className="text-sm" style={{ color: isDark ? '#a1a1aa' : '#6B7280' }}>
                      Showing {filtered.length} of {tracks.length} tracks
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}