"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Music, DollarSign, Globe, X } from "lucide-react";

interface TrackPerformance {
  title: string;
  revenue: number;
  streams: number;
}

interface TerritoryData {
  territory: string;
  revenue: number;
}

interface SourceData {
  source: string;
  revenue: number;
}

interface QuarterlyData {
  quarter: string;
  revenue: number;
}

interface Royalty {
  net_amount: number;
  usage_count: number;
  territory: string;
  exploitation_source_name: string;
  broadcast_date: string;
  tracks: { title: string }[] | { title: string } | null;
}

// Summary-based analytics data structure
interface SummaryAnalytics {
  stats: {
    totalRevenue: number;
    totalStreams: number;
    averagePerStream: number;
    topTerritory: string;
  };
  topTracks: TrackPerformance[];
  territoryBreakdown: TerritoryData[];
  sourceBreakdown: SourceData[];
  quarterlyRevenue: QuarterlyData[];
}

const GREEN_PALETTE = {
  primary: "#1ABC9C",
  secondary: "#48C9B0",
  dark: "#16A085",
  light: "#7EDCC7",
  lighter: "#A8E6D7",
  background: "#F8F9FA",
  grid: "#E5E7EB",
};

const GREEN_GRADIENT = [
  GREEN_PALETTE.primary,
  GREEN_PALETTE.secondary,
  GREEN_PALETTE.light,
  GREEN_PALETTE.lighter,
  "#C5F3E8"
];

export default function AnalyticsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [analytics, setAnalytics] = useState<SummaryAnalytics>({
    stats: { totalRevenue: 0, totalStreams: 0, averagePerStream: 0, topTerritory: "N/A" },
    topTracks: [],
    territoryBreakdown: [],
    sourceBreakdown: [],
    quarterlyRevenue: []
  });
  const [loadingData, setLoadingData] = useState(true);
  const [showAllSourcesModal, setShowAllSourcesModal] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    if (!user) return;

    try {
      let artistId: string | null = null;

      // For artists, get their artist record first
      if (user.role === "artist") {
        const { data: artist, error: artistError } = await supabase
          .from("artists")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (artistError || !artist) {
          console.error("Error fetching artist:", artistError);
          setLoadingData(false);
          return;
        }
        artistId = artist.id;
      }

      // Try fetching from royalties_summary first (new system)
      const summaryResult = await fetchFromSummaryTable(artistId);

      if (summaryResult) {
        setAnalytics(summaryResult);
        console.log('[Analytics] Using royalties_summary table');
      } else {
        // Fallback to old royalties table
        console.warn('[Analytics] Summary table not available, falling back to royalties table');
        const fallbackResult = await fetchFromRoyaltiesTable(artistId);
        setAnalytics(fallbackResult);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  // Fetch from new royalties_summary table via RPC
  const fetchFromSummaryTable = async (artistId: string | null): Promise<SummaryAnalytics | null> => {
    try {
      let totalRevenue = 0;
      let totalStreams = 0;
      let platformDist: Record<string, number> = {};
      let territoryDist: Record<string, number> = {};
      let topTerritoryName = "N/A";

      if (artistId) {
        // Artist-specific data: fetch summary records directly and aggregate
        // (Same approach as admin to ensure accurate territory/platform distribution)
        const { data: artistSummaries, error: summaryError } = await supabase
          .from('royalties_summary')
          .select('total_net, total_streams, platform_distribution, territory_distribution, top_territory')
          .eq('artist_id', artistId)
          .neq('top_platform', 'Advance Payment');

        if (summaryError) {
          console.warn('Artist summary query failed:', summaryError.message);
          return null;
        }

        if (artistSummaries && artistSummaries.length > 0) {
          const platformTotals = new Map<string, number>();
          const territoryTotals = new Map<string, number>();

          for (const summary of artistSummaries) {
            const net = parseFloat(String(summary.total_net || 0));
            totalRevenue += net;
            totalStreams += parseInt(String(summary.total_streams || 0), 10);

            // Aggregate platform distributions
            // Check if values are percentages (sum ~1.0) or absolute amounts
            const platforms = summary.platform_distribution || {};
            const platformValues = Object.values(platforms) as number[];
            const platformSum = platformValues.reduce((a, b) => a + b, 0);
            const platformIsPercentage = platformSum > 0 && platformSum <= 1.1;

            for (const [platform, val] of Object.entries(platforms)) {
              const amt = platformIsPercentage ? net * (val as number) : (val as number);
              platformTotals.set(platform, (platformTotals.get(platform) || 0) + amt);
            }

            // For territory: use top_territory field directly with the record's net revenue
            // This is more reliable than the distribution JSON which may have inconsistent formats
            if (summary.top_territory) {
              territoryTotals.set(
                summary.top_territory,
                (territoryTotals.get(summary.top_territory) || 0) + net
              );
            }
          }

          // Convert to percentage distributions
          if (totalRevenue > 0) {
            platformTotals.forEach((amt, platform) => {
              platformDist[platform] = amt / totalRevenue;
            });
            territoryTotals.forEach((amt, territory) => {
              territoryDist[territory] = amt / totalRevenue;
            });
          }

          // Get top territory by revenue
          const sortedTerritories = Array.from(territoryTotals.entries()).sort((a, b) => b[1] - a[1]);
          topTerritoryName = sortedTerritories[0]?.[0] || "N/A";
        }

        console.log('[Analytics] Artist data aggregated:', { totalRevenue, totalStreams, territories: Object.keys(territoryDist).length });
      } else {
        // Admin: aggregate from all summary records
        const { data: adminTotals, error: adminError } = await supabase.rpc('get_admin_royalties_totals');

        if (adminError) {
          console.warn('Admin totals RPC failed:', adminError.message);
          return null;
        }

        const adminData = adminTotals?.[0] || {};
        totalRevenue = parseFloat(adminData.total_net || 0);
        totalStreams = parseInt(adminData.total_streams || 0, 10);

        // For admin, fetch all summary records and aggregate distributions
        const { data: allSummaries, error: summaryError } = await supabase
          .from('royalties_summary')
          .select('total_net, total_streams, platform_distribution, territory_distribution, top_territory')
          .neq('top_platform', 'Advance Payment');

        console.log('[Analytics Debug] Fetched summaries:', {
          count: allSummaries?.length || 0,
          error: summaryError?.message,
          sample: allSummaries?.[0] ? {
            total_net: allSummaries[0].total_net,
            platform_distribution: allSummaries[0].platform_distribution,
            top_territory: allSummaries[0].top_territory
          } : null
        });

        if (allSummaries && allSummaries.length > 0) {
          const platformTotals = new Map<string, number>();
          const territoryTotals = new Map<string, number>();
          const topTerritoryCount = new Map<string, number>();

          // If RPC returned 0 streams, sum directly from records
          if (totalStreams === 0) {
            let directStreamsSum = 0;
            for (const summary of allSummaries) {
              directStreamsSum += parseInt(String(summary.total_streams || 0), 10);
            }
            if (directStreamsSum > 0) {
              totalStreams = directStreamsSum;
              console.log('[Analytics] Direct query found total_streams:', totalStreams);
            }
          }

          for (const summary of allSummaries) {
            const net = parseFloat(summary.total_net || 0);

            // Aggregate platform distributions
            // Check if values are percentages (sum ~1.0) or absolute amounts
            const platforms = summary.platform_distribution || {};
            const platformValues = Object.values(platforms) as number[];
            const platformSum = platformValues.reduce((a, b) => a + b, 0);
            const platformIsPercentage = platformSum > 0 && platformSum <= 1.1;

            for (const [platform, val] of Object.entries(platforms)) {
              const amt = platformIsPercentage ? net * (val as number) : (val as number);
              platformTotals.set(platform, (platformTotals.get(platform) || 0) + amt);
            }

            // For territory: use top_territory field directly with the record's net revenue
            // This is more reliable than the distribution JSON which may have inconsistent formats
            if (summary.top_territory) {
              territoryTotals.set(
                summary.top_territory,
                (territoryTotals.get(summary.top_territory) || 0) + net
              );
            }
          }

          // Convert to percentage distributions
          if (totalRevenue > 0) {
            platformTotals.forEach((amt, platform) => {
              platformDist[platform] = amt / totalRevenue;
            });
            territoryTotals.forEach((amt, territory) => {
              territoryDist[territory] = amt / totalRevenue;
            });
          }

          // Get top territory by revenue
          const sortedTerritories = Array.from(territoryTotals.entries()).sort((a, b) => b[1] - a[1]);
          topTerritoryName = sortedTerritories[0]?.[0] || "N/A";
        }
      }

      // Get top tracks
      const { data: topTracksData, error: topTracksError } = artistId
        ? await supabase.rpc('get_artist_top_tracks', { _artist_id: artistId, _year: null, _quarter: null, _limit: 5 })
        : await supabase.from('royalties_summary')
          .select('track_id, total_net, total_streams, tracks(title)')
          .neq('top_platform', 'Advance Payment')
          .order('total_net', { ascending: false })
          .limit(5);

      console.log('[Analytics Debug] Top tracks query:', {
        count: topTracksData?.length || 0,
        error: topTracksError?.message,
        sample: topTracksData?.[0]
      });

      // Get quarterly trends
      let quarterlyRevenue: QuarterlyData[] = [];
      if (artistId) {
        const { data: trendsData } = await supabase.rpc('get_artist_quarterly_trends', { _artist_id: artistId, _limit: 8 });

        quarterlyRevenue = (trendsData || [])
          .map((t: any) => ({
            quarter: t.quarter_label || `Q${t.quarter} ${t.year}`,
            revenue: parseFloat(t.total_net || 0),
            year: t.year,
            qValue: t.quarter
          }))
          .sort((a: any, b: any) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.qValue - b.qValue;
          })
          .map((t: any) => ({
            quarter: t.quarter,
            revenue: t.revenue
          }));
      } else {
        // Admin: aggregate quarterly data
        const { data: allQuarterly } = await supabase
          .from('royalties_summary')
          .select('year, quarter, total_net')
          .neq('top_platform', 'Advance Payment');

        if (allQuarterly) {
          const quarterMap = new Map<string, number>();
          for (const row of allQuarterly) {
            const key = `Q${row.quarter} ${row.year}`;
            quarterMap.set(key, (quarterMap.get(key) || 0) + parseFloat(row.total_net || 0));
          }
          quarterlyRevenue = Array.from(quarterMap.entries())
            .map(([quarter, revenue]) => ({ quarter, revenue }))
            .sort((a, b) => {
              const [q1, y1] = a.quarter.split(' ');
              const [q2, y2] = b.quarter.split(' ');
              return y1 === y2 ? q1.localeCompare(q2) : y1.localeCompare(y2);
            })
            .slice(-8);
        }
      }

      // Top tracks
      const topTracks: TrackPerformance[] = (topTracksData || []).map((t: any) => ({
        title: t.track_title || t.tracks?.title || 'Unknown',
        revenue: parseFloat(t.total_net || 0),
        streams: parseInt(t.total_streams || 0, 10)
      }));

      // Platform distribution
      const sourceBreakdown: SourceData[] = Object.entries(platformDist)
        .map(([source, pct]) => ({
          source,
          revenue: totalRevenue * (pct as number)
        }))
        .sort((a, b) => b.revenue - a.revenue);

      // Territory distribution
      const territoryBreakdown: TerritoryData[] = Object.entries(territoryDist)
        .map(([territory, pct]) => ({
          territory,
          revenue: totalRevenue * (pct as number)
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      console.log('[Analytics] Summary data:', { totalRevenue, totalStreams, topTracks: topTracks.length, sources: sourceBreakdown.length });

      return {
        stats: {
          totalRevenue,
          totalStreams,
          averagePerStream: totalStreams > 0 ? totalRevenue / totalStreams : 0,
          topTerritory: topTerritoryName
        },
        topTracks,
        territoryBreakdown,
        sourceBreakdown,
        quarterlyRevenue
      };
    } catch (error) {
      console.warn('Error fetching from summary table:', error);
      return null;
    }
  };

  // Fallback: Fetch from old royalties table
  const fetchFromRoyaltiesTable = async (artistId: string | null): Promise<SummaryAnalytics> => {
    try {
      let query = supabase
        .from("royalties")
        .select("net_amount, usage_count, territory, exploitation_source_name, broadcast_date, tracks!inner(title)")
        .order("broadcast_date", { ascending: false });

      if (artistId) {
        query = query.eq("artist_id", artistId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const royalties = data || [];

      if (!royalties.length) {
        return {
          stats: { totalRevenue: 0, totalStreams: 0, averagePerStream: 0, topTerritory: "N/A" },
          topTracks: [],
          territoryBreakdown: [],
          sourceBreakdown: [],
          quarterlyRevenue: []
        };
      }

      // Process data
      let totalRevenue = 0;
      let totalStreams = 0;
      const trackMap = new Map<string, { revenue: number; streams: number }>();
      const territoryMap = new Map<string, number>();
      const sourceMap = new Map<string, number>();
      const quarterlyMap = new Map<string, number>();

      for (const r of royalties) {
        const revenue = Number(r.net_amount || 0);
        const streams = Number(r.usage_count || 0);
        totalRevenue += revenue;
        totalStreams += streams;

        const title = (Array.isArray(r.tracks) ? r.tracks[0]?.title : (r.tracks as any)?.title) || "Unknown";
        const track = trackMap.get(title);
        if (track) {
          track.revenue += revenue;
          track.streams += streams;
        } else {
          trackMap.set(title, { revenue, streams });
        }

        const territory = r.territory || "Unknown";
        territoryMap.set(territory, (territoryMap.get(territory) || 0) + revenue);

        const source = r.exploitation_source_name || "Unknown";
        sourceMap.set(source, (sourceMap.get(source) || 0) + revenue);

        if (r.broadcast_date) {
          const date = new Date(r.broadcast_date);
          const quarter = Math.floor(date.getMonth() / 3) + 1;
          const quarterKey = `Q${quarter} ${date.getFullYear()}`;
          quarterlyMap.set(quarterKey, (quarterlyMap.get(quarterKey) || 0) + revenue);
        }
      }

      return {
        stats: {
          totalRevenue,
          totalStreams,
          averagePerStream: totalStreams > 0 ? totalRevenue / totalStreams : 0,
          topTerritory: Array.from(territoryMap).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A"
        },
        topTracks: Array.from(trackMap, ([title, data]) => ({ title, revenue: data.revenue, streams: data.streams }))
          .sort((a, b) => b.revenue - a.revenue).slice(0, 5),
        territoryBreakdown: Array.from(territoryMap, ([territory, revenue]) => ({ territory, revenue }))
          .sort((a, b) => b.revenue - a.revenue).slice(0, 5),
        sourceBreakdown: Array.from(sourceMap, ([source, revenue]) => ({ source, revenue }))
          .sort((a, b) => b.revenue - a.revenue),
        quarterlyRevenue: Array.from(quarterlyMap, ([quarter, revenue]) => ({ quarter, revenue }))
          .sort((a, b) => {
            const [q1, y1] = a.quarter.split(' ');
            const [q2, y2] = b.quarter.split(' ');
            return y1 === y2 ? q1.localeCompare(q2) : y1.localeCompare(y2);
          }).slice(-8)
      };
    } catch (error) {
      console.error('Error fetching from royalties table:', error);
      return {
        stats: { totalRevenue: 0, totalStreams: 0, averagePerStream: 0, topTerritory: "N/A" },
        topTracks: [],
        territoryBreakdown: [],
        sourceBreakdown: [],
        quarterlyRevenue: []
      };
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    } else if (user) {
      fetchAnalytics();
    }
  }, [user, loading, router, fetchAnalytics]);

  if (loading || loadingData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-zinc-500">Loading analytics...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-8 p-1">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
        <p className="text-sm mt-2 text-gray-600">
          Performance insights and revenue breakdown
        </p>
      </div>

      {/* Key Metrics */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <MetricCard
          icon={DollarSign}
          color={GREEN_PALETTE.primary}
          label="Total Revenue"
          value={`$${analytics.stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Total Earnings"
        />
        <MetricCard
          icon={TrendingUp}
          color={GREEN_PALETTE.secondary}
          label="Total Streams"
          value={analytics.stats.totalStreams.toLocaleString()}
          subtitle="All platforms"
        />
        <MetricCard
          icon={Music}
          color={GREEN_PALETTE.dark}
          label="Avg per Stream"
          value={`$${analytics.stats.averagePerStream.toFixed(6)}`}
          subtitle="Revenue per play"
        />
        <MetricCard
          icon={Globe}
          color={GREEN_PALETTE.primary}
          label="Top Territory"
          value={analytics.stats.topTerritory}
          subtitle="Highest revenue"
        />
      </section>

      {/* Charts Row 1 */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Top Performing Tracks" subtitle="By revenue generated">
          {analytics.topTracks.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.topTracks} margin={{ left: 20, right: 20, top: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GREEN_PALETTE.grid} opacity={0.3} />
                <XAxis
                  dataKey="title"
                  tick={{ fill: '#6B7280', fontSize: 11 }}
                  axisLine={{ stroke: GREEN_PALETTE.grid }}
                  tickFormatter={(value) => value.length > 12 ? value.substring(0, 10) + '...' : value}
                />
                <YAxis tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={{ stroke: GREEN_PALETTE.grid }} tickFormatter={(value) => `$${value.toFixed(2)}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}
                  formatter={(value: any) => `$${Number(value).toFixed(2)}`}
                />
                <Bar dataKey="revenue" fill={GREEN_PALETTE.primary} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState />
          )}
        </ChartCard>

        <ChartCard title="Revenue by Source" subtitle="Platform distribution">
          {analytics.sourceBreakdown.length > 0 ? (
            <div className="space-y-4">
              <div className="flex flex-col lg:flex-row gap-6 items-center">
                <div className="w-full lg:w-1/2 flex justify-center">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={analytics.sourceBreakdown.slice(0, 5) as unknown as { [key: string]: string | number }[]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={false}
                        outerRadius={100}
                        fill={GREEN_PALETTE.primary}
                        dataKey="revenue"
                        nameKey="source"
                      >
                        {analytics.sourceBreakdown.slice(0, 5).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={GREEN_GRADIENT[index % GREEN_GRADIENT.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}
                        formatter={(value: any) => `$${Number(value).toFixed(2)}`}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <SourceLegend
                  sources={analytics.sourceBreakdown.slice(0, 5)}
                  colors={GREEN_GRADIENT}
                  totalRevenue={analytics.sourceBreakdown.reduce((sum, s) => sum + s.revenue, 0)}
                />
              </div>

              {analytics.sourceBreakdown.length > 5 && (
                <div className="flex justify-center">
                  <button
                    onClick={() => setShowAllSourcesModal(true)}
                    className="px-6 py-2 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-lg font-medium hover:from-green-600 hover:to-teal-600 transition-all duration-300 shadow-md hover:shadow-lg"
                  >
                    See More ({analytics.sourceBreakdown.length - 5} more sources)
                  </button>
                </div>
              )}
            </div>
          ) : (
            <EmptyState />
          )}
        </ChartCard>
      </section>

      {/* Charts Row 2 */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Revenue by Territory" subtitle="Geographic distribution">
          {analytics.territoryBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.territoryBreakdown} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GREEN_PALETTE.grid} opacity={0.3} />
                <XAxis type="number" tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={{ stroke: GREEN_PALETTE.grid }} tickFormatter={(value) => `$${value.toFixed(2)}`} />
                <YAxis
                  dataKey="territory"
                  type="category"
                  tick={{ fill: '#6B7280', fontSize: 11 }}
                  axisLine={{ stroke: GREEN_PALETTE.grid }}
                  width={100}
                  tickFormatter={(value) => value.length > 15 ? value.substring(0, 13) + '...' : value}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}
                  formatter={(value: any) => `$${Number(value).toFixed(2)}`}
                />
                <Bar dataKey="revenue" fill={GREEN_PALETTE.secondary} radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState />
          )}
        </ChartCard>

        <ChartCard title="Quarterly Revenue Trend" subtitle="Last 8 quarters performance">
          {analytics.quarterlyRevenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.quarterlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke={GREEN_PALETTE.grid} opacity={0.3} />
                <XAxis dataKey="quarter" tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={{ stroke: GREEN_PALETTE.grid }} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={{ stroke: GREEN_PALETTE.grid }} tickFormatter={(value) => `$${value.toFixed(2)}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}
                  formatter={(value: any) => `$${Number(value).toFixed(2)}`}
                />
                <Bar dataKey="revenue" fill={GREEN_PALETTE.dark} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState />
          )}
        </ChartCard>
      </section>

      {/* All Sources Modal */}
      {showAllSourcesModal && (
        <SourceModal
          sources={analytics.sourceBreakdown}
          colors={GREEN_GRADIENT}
          onClose={() => setShowAllSourcesModal(false)}
        />
      )}
    </div>
  );
}

// Memoized components to prevent unnecessary re-renders
const MetricCard = React.memo(({ icon: Icon, color, label, value, subtitle }: any) => (
  <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 border border-gray-100">
    <div className="flex items-start justify-between mb-4">
      <div className="p-3 rounded-lg" style={{ backgroundColor: `${color}20` }}>
        <Icon className="h-6 w-6" style={{ color }} />
      </div>
    </div>
    <div className="space-y-1">
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{subtitle}</p>
    </div>
  </div>
));

const ChartCard = React.memo(({ title, subtitle, children }: any) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
    <div className="p-6 border-b border-gray-100">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
    </div>
    <div className="p-6">{children}</div>
  </div>
));

const EmptyState = React.memo(() => (
  <div className="h-[300px] flex items-center justify-center text-gray-500">
    No data available
  </div>
));

const SourceLegend = React.memo(({ sources, colors, totalRevenue }: any) => (
  <div className="w-full lg:w-1/2">
    <div className="flex flex-col gap-3">
      {sources.map((item: SourceData, index: number) => {
        const percentage = ((item.revenue / totalRevenue) * 100).toFixed(1);
        return (
          <div key={item.source} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: colors[index % colors.length] }} />
              <span className="text-sm font-medium text-gray-700">{item.source}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-sm font-semibold text-gray-900">${item.revenue.toFixed(2)}</span>
              <span className="text-xs text-gray-500">{percentage}%</span>
            </div>
          </div>
        );
      })}
    </div>
  </div>
));

const SourceModal = React.memo(({ sources, colors, onClose }: any) => {
  const totalRevenue = useMemo(() =>
    sources.reduce((sum: number, s: SourceData) => sum + s.revenue, 0),
    [sources]
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-teal-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">All Revenue Sources</h2>
            <p className="text-sm text-gray-600 mt-1">Complete platform breakdown</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-lg transition-colors">
            <X className="h-6 w-6 text-gray-600" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-3">
            {sources.map((item: SourceData, index: number) => {
              const percentage = ((item.revenue / totalRevenue) * 100).toFixed(1);
              return (
                <div key={item.source} className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-green-300 hover:shadow-md transition-all duration-200 bg-gradient-to-r from-white to-gray-50">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-green-100 to-teal-100 text-green-700 font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: colors[index % colors.length] }} />
                    <span className="text-sm font-semibold text-gray-800">{item.source}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-sm font-bold text-gray-900">${item.revenue.toFixed(2)}</div>
                      <div className="text-xs text-gray-500">{percentage}% of total</div>
                    </div>
                    <div className="w-16">
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-green-500 to-teal-500 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-teal-50 rounded-xl border border-green-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Total Revenue</span>
              <span className="text-lg font-bold text-green-700">${totalRevenue.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm font-semibold text-gray-700">Total Sources</span>
              <span className="text-lg font-bold text-teal-700">{sources.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

// Add display names for React DevTools
MetricCard.displayName = "MetricCard";
ChartCard.displayName = "ChartCard";
EmptyState.displayName = "EmptyState";
SourceLegend.displayName = "SourceLegend";
SourceModal.displayName = "SourceModal";