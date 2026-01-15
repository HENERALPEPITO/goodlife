"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { DollarSign, Music, TrendingUp, FileText, ArrowUp, ArrowDown, Play, Upload, Clock } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";

interface ArtistStats {
  totalRevenue: number;
  totalTracks: number;
  totalStreams: number;
}

interface TopTrack {
  id: string;
  title: string;
  platform: string;
  streams: number;
  revenue: number;
  trend: number; // percentage change
}

interface RecentActivity {
  id: string;
  type: 'stream' | 'royalty' | 'payout' | 'upload';
  description: string;
  date: string;
}

export default function ArtistDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<ArtistStats>({
    totalRevenue: 0,
    totalTracks: 0,
    totalStreams: 0,
  });
  const [loading, setLoading] = useState(true);
  const [topTracks, setTopTracks] = useState<TopTrack[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [sortBy, setSortBy] = useState<'streams' | 'revenue' | 'date'>('streams');
  const [artistId, setArtistId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchArtistStats();
    }
  }, [user]);

  const fetchArtistStats = async () => {
    if (!user) return;

    try {
      // First, find the artist record for this user
      const { data: artist, error: artistError } = await supabase
        .from("artists")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (artistError) {
        console.error("Error fetching artist:", artistError);
        setLoading(false);
        return;
      }

      if (!artist) {
        console.warn("No artist found for user");
        setStats({
          totalRevenue: 0,
          totalTracks: 0,
          totalStreams: 0,
        });
        setArtistId(null);
        setLoading(false);
        return;
      }

      // Store the artist ID for notifications
      setArtistId(artist.id);

      // Try new summary-based RPC first (from royalties_summary table)
      const summaryResult = await supabase.rpc('get_artist_dashboard_overview', { 
        _artist_id: artist.id 
      });

      let usingSummary = false;

      if (summaryResult.data && summaryResult.data[0]) {
        const s = summaryResult.data[0];
        let totalStreams = parseInt(String(s.total_streams || 0), 10);
        
        // If RPC returns 0 streams, try direct table query as fallback
        if (totalStreams === 0) {
          console.log('[Artist Dashboard] RPC returned 0 streams, trying direct query...');
          const { data: directSummary, error: directError } = await supabase
            .from('royalties_summary')
            .select('total_streams, total_net, track_id')
            .eq('artist_id', artist.id);
          
          if (!directError && directSummary && directSummary.length > 0) {
            totalStreams = directSummary.reduce((sum, row) => sum + Number(row.total_streams || 0), 0);
            console.log('[Artist Dashboard] Direct query found', directSummary.length, 'records, total_streams:', totalStreams);
          }
        }
        
        setStats({
          totalRevenue: parseFloat(String(s.total_earnings || s.total_net || 0)),
          totalTracks: parseInt(String(s.total_tracks || 0), 10),
          totalStreams: totalStreams,
        });
        usingSummary = true;
        console.log('[Artist Dashboard] Using royalties_summary table, streams:', totalStreams);

        // Fetch top tracks from summary table
        const topTracksResult = await supabase.rpc('get_artist_top_tracks', {
          _artist_id: artist.id,
          _year: null,
          _quarter: null,
          _limit: 5
        });

        if (topTracksResult.data && topTracksResult.data.length > 0) {
          const topTracksData: TopTrack[] = topTracksResult.data.map((t: any, index: number) => ({
            id: `track-${index}`,
            title: t.track_title || 'Unknown Track',
            platform: t.top_platform || 'Various',
            streams: parseInt(String(t.total_streams || 0), 10),
            revenue: parseFloat(String(t.total_net || 0)),
            trend: 0, // Trend calculation would need historical data
          }));
          setTopTracks(topTracksData);
        }
      }

      // Fall back to old method if summary not available
      if (!usingSummary) {
        console.warn('[Artist Dashboard] Summary not available, falling back to royalties table');
        
        const [statsResult, royaltiesResult] = await Promise.all([
          supabase.rpc('get_artist_dashboard_stats', { p_user_id: user.id }),
          supabase
            .from("royalties")
            .select("*, tracks(title)")
            .eq("artist_id", artist.id)
        ]);

        if (statsResult.data && statsResult.data[0]) {
          const s = statsResult.data[0];
          setStats({
            totalRevenue: parseFloat(String(s.total_revenue || 0)),
            totalTracks: parseInt(String(s.total_tracks || 0), 10),
            totalStreams: parseInt(String(s.total_streams || 0), 10),
          });
        } else {
          const royalties = royaltiesResult.data || [];
          setStats({
            totalRevenue: royalties.reduce((sum, r) => sum + Number(r.net_amount || 0), 0),
            totalTracks: 0,
            totalStreams: royalties.reduce((sum, r) => sum + Number(r.usage_count || 0), 0),
          });
        }

        const royalties = royaltiesResult.data;

        if (royalties && royalties.length > 0) {
          const trackMap = new Map<string, { streams: number; revenue: number }>();
          
          royalties.forEach((r) => {
            const title = r.tracks?.title || r.track_title || "Unknown Track";
            const existing = trackMap.get(title) || { streams: 0, revenue: 0 };
            trackMap.set(title, {
              streams: existing.streams + Number(r.usage_count || 0),
              revenue: existing.revenue + Number(r.net_amount || 0),
            });
          });

          const topTracksData: TopTrack[] = Array.from(trackMap.entries())
            .map(([title, data], index) => ({
              id: `track-${index}`,
              title,
              platform: royalties.find(r => (r.tracks?.title || r.track_title) === title)?.exploitation_source_name || "Various",
              streams: data.streams,
              revenue: data.revenue,
              trend: 0,
            }))
            .sort((a, b) => b.streams - a.streams)
            .slice(0, 5);

          setTopTracks(topTracksData);
        }
      }

      // Still fetch recent activity from royalties table (raw data)
      const { data: royalties } = await supabase
        .from("royalties")
        .select("*, tracks(title)")
        .eq("artist_id", artist.id)
        .order("broadcast_date", { ascending: false })
        .limit(10);

      if (royalties && royalties.length > 0) {
        const activities: RecentActivity[] = royalties
          .map((r, index) => ({
            id: `activity-${index}`,
            type: 'stream' as const,
            description: `${r.tracks?.title || r.track_title || 'Track'} received ${Number(r.usage_count || 0).toLocaleString()} streams from ${r.exploitation_source_name || 'platform'}`,
            date: r.broadcast_date || r.created_at || new Date().toISOString(),
          }))
          .slice(0, 5);

        setRecentActivity(activities);
      }
    } catch (error) {
      console.error("Error fetching artist stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const kpis = [
    {
      label: "Total Revenue",
      value: `$${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: "Total Earnings",
      icon: DollarSign,
      color: "#4ADE80",
    },
    {
      label: "Total Streams",
      value: stats.totalStreams.toLocaleString(),
      sub: "All platforms",
      icon: TrendingUp,
      color: "#A78BFA",
    },
    {
      label: "Active Tracks",
      value: stats.totalTracks.toString(),
      sub: "In catalog",
      icon: Music,
      color: "#FB923C",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="transition-colors" style={{ color: 'var(--text-secondary)' }}>Loading your dashboard...</div>
      </div>
    );
  }

  // Sorted tracks based on selected sort option
  const sortedTracks = [...topTracks].sort((a, b) => {
    if (sortBy === 'streams') return b.streams - a.streams;
    if (sortBy === 'revenue') return b.revenue - a.revenue;
    return 0;
  });

  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'stream': return <Play className="h-4 w-4" style={{ color: '#10B981' }} />;
      case 'royalty': return <DollarSign className="h-4 w-4" style={{ color: '#3B82F6' }} />;
      case 'payout': return <TrendingUp className="h-4 w-4" style={{ color: '#8B5CF6' }} />;
      case 'upload': return <Upload className="h-4 w-4" style={{ color: '#F59E0B' }} />;
      default: return <Clock className="h-4 w-4" style={{ color: '#6B7280' }} />;
    }
  };

  return (
    <div className="space-y-8 p-1">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold transition-colors" style={{ color: 'var(--text-primary)' }}>
            Artist Dashboard
          </h1>
          <p className="text-sm mt-2 transition-colors" style={{ color: 'var(--text-secondary)' }}>
            Welcome back, {user?.email}! Here's your performance overview.
          </p>
        </div>
        <NotificationsDropdown artistId={artistId} />
      </div>

      {/* Improved Metric Cards - 3 Column Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-default border border-gray-100"
            >
              <div className="flex items-start justify-between mb-4">
                <div 
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: `${kpi.color}20` }}
                >
                  <Icon className="h-6 w-6" style={{ color: kpi.color }} />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">{kpi.label}</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {kpi.value}
                </p>
                <p className="text-xs text-gray-500">{kpi.sub}</p>
              </div>
            </div>
          );
        })}
      </section>

      {/* Top Tracks Section */}
      <section className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              Top Tracks
            </h2>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'streams' | 'revenue' | 'date')}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="streams">By Streams</option>
              <option value="revenue">By Revenue</option>
            </select>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Track
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Platform
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Streams
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {sortedTracks.length > 0 ? (
                sortedTracks.map((track, index) => (
                  <tr 
                    key={track.id}
                    className="hover:bg-gray-50 transition-colors"
                    style={{ backgroundColor: index % 2 === 0 ? 'white' : '#FAFAFA' }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mr-3">
                          <Music className="h-5 w-5 text-white" />
                        </div>
                        <div className="text-sm font-medium text-gray-900">{track.title}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{track.platform}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {track.streams.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        ${track.revenue.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {track.trend > 0 ? (
                          <>
                            <ArrowUp className="h-4 w-4 text-green-500 mr-1" />
                            <span className="text-sm font-medium text-green-600">
                              {track.trend.toFixed(1)}%
                            </span>
                          </>
                        ) : (
                          <>
                            <ArrowDown className="h-4 w-4 text-red-500 mr-1" />
                            <span className="text-sm font-medium text-red-600">
                              {Math.abs(track.trend).toFixed(1)}%
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No track data available yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Two Column Layout: Quick Actions + Recent Activity */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Quick Actions
          </h3>
          <Link
            href="/analytics"
            className="block bg-white rounded-xl p-6 shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border border-gray-100"
          >
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-blue-50 mr-4">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Analytics</h4>
                <p className="text-sm text-gray-600">View detailed performance metrics</p>
              </div>
            </div>
          </Link>

          <Link
            href="/royalties"
            className="block bg-white rounded-xl p-6 shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border border-gray-100"
          >
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-green-50 mr-4">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Royalties</h4>
                <p className="text-sm text-gray-600">View your royalty statements</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Recent Activity
            </h3>
          </div>
          <div className="p-6">
            {recentActivity.length > 0 ? (
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start pb-4 border-b border-gray-100 last:border-b-0 last:pb-0"
                  >
                    <div className="p-2 rounded-lg bg-gray-50 mr-3">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{activity.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {format(new Date(activity.date), 'MMM dd, yyyy • h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No recent activity
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}