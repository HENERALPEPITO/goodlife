"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { supabase } from "@/lib/supabaseClient";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, Music, DollarSign, Globe } from "lucide-react";

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

interface MonthlyData {
  month: string;
  revenue: number;
}

export default function AnalyticsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  const [topTracks, setTopTracks] = useState<TrackPerformance[]>([]);
  const [territoryBreakdown, setTerritoryBreakdown] = useState<TerritoryData[]>([]);
  const [sourceBreakdown, setSourceBreakdown] = useState<SourceData[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyData[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Tooltip and chart styles based on theme
  const isDark = mounted && theme === "dark";
  const tooltipStyle = isDark
    ? {
        backgroundColor: "#18181b",
        border: "1px solid #3f3f46",
        borderRadius: "8px",
        color: "#e4e4e7",
      }
    : {
        backgroundColor: "#FFFFFF",
        border: "1px solid rgba(0, 0, 0, 0.1)",
        borderRadius: "8px",
        color: "#1F2937",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
      };
  
  const axisColor = isDark ? "#9ca3af" : "#6B7280";
  const gridColor = isDark ? "#374151" : "#D1D5DB"; // Light gray in white mode

  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalStreams: 0,
    averagePerStream: 0,
    topTerritory: "",
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    } else if (user) {
      fetchAnalytics();
    }
  }, [user, loading, router]);

  const fetchAnalytics = async () => {
    if (!user) return;

    try {
      // Fetch royalties based on role
      let query = supabase
        .from("royalties")
        .select("*, tracks(title)");

      // If artist, only get their royalties
      if (user.role === "artist") {
        // First, get the artist ID from the artists table
        const { data: artist, error: artistError } = await supabase
          .from("artists")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (artistError) {
          console.error("Error fetching artist:", artistError);
          setLoadingData(false);
          return;
        }

        if (!artist) {
          console.warn("No artist found for user");
          setLoadingData(false);
          return;
        }

        // Use artist.id instead of user.id
        query = query.eq("artist_id", artist.id);
      }

      const { data: royalties, error } = await query;

      if (error) throw error;

      if (!royalties || royalties.length === 0) {
        setLoadingData(false);
        return;
      }

      // Calculate stats
      const totalRevenue = royalties.reduce((sum, r) => sum + Number(r.net_amount || 0), 0);
      const totalStreams = royalties.reduce((sum, r) => sum + Number(r.usage_count || 0), 0);
      const averagePerStream = totalStreams > 0 ? totalRevenue / totalStreams : 0;

      // Top performing tracks
      const trackRevenue = new Map<string, { revenue: number; streams: number }>();
      royalties.forEach((r) => {
        const title = r.tracks?.title || "Unknown";
        const existing = trackRevenue.get(title) || { revenue: 0, streams: 0 };
        trackRevenue.set(title, {
          revenue: existing.revenue + Number(r.net_amount || 0),
          streams: existing.streams + Number(r.usage_count || 0),
        });
      });

      const topTracksData = Array.from(trackRevenue.entries())
        .map(([title, data]) => ({
          title,
          revenue: data.revenue,
          streams: data.streams,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      setTopTracks(topTracksData);

      // Territory breakdown
      const territoryRevenue = new Map<string, number>();
      royalties.forEach((r) => {
        const territory = r.territory || "Unknown";
        territoryRevenue.set(
          territory,
          (territoryRevenue.get(territory) || 0) + Number(r.net_amount || 0)
        );
      });

      const territoryData = Array.from(territoryRevenue.entries())
        .map(([territory, revenue]) => ({ territory, revenue }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      setTerritoryBreakdown(territoryData);

      const topTerritory = territoryData[0]?.territory || "N/A";

      // Source breakdown
      const sourceRevenue = new Map<string, number>();
      royalties.forEach((r) => {
        const source = r.exploitation_source_name || "Unknown";
        sourceRevenue.set(
          source,
          (sourceRevenue.get(source) || 0) + Number(r.net_amount || 0)
        );
      });

      const sourceData = Array.from(sourceRevenue.entries())
        .map(([source, revenue]) => ({ source, revenue }))
        .sort((a, b) => b.revenue - a.revenue);

      setSourceBreakdown(sourceData);

      // Monthly revenue (using broadcast_date)
      const monthlyRevenue = new Map<string, number>();
      royalties.forEach((r) => {
        if (r.broadcast_date) {
          const date = new Date(r.broadcast_date);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          monthlyRevenue.set(
            monthKey,
            (monthlyRevenue.get(monthKey) || 0) + Number(r.net_amount || 0)
          );
        }
      });

      const monthlyData = Array.from(monthlyRevenue.entries())
        .map(([month, revenue]) => ({ month, revenue }))
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-6); // Last 6 months

      setMonthlyRevenue(monthlyData);

      setStats({
        totalRevenue,
        totalStreams,
        averagePerStream,
        topTerritory,
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoadingData(false);
    }
  };

  if (loading || loadingData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-zinc-500">Loading analytics...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>Analytics Dashboard</h1>
        <p className="text-sm mt-1 transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
          Performance insights and revenue breakdown
        </p>
      </div>

      {/* Key Metrics */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div 
          className="rounded-lg border p-6 transition-colors"
          style={{
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="text-sm transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Total Revenue</div>
            <DollarSign className="h-5 w-5" style={{ color: '#10B981' }} />
          </div>
          <div className="mt-2 text-3xl font-semibold transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>
            €{stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs mt-1 transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>All time earnings</div>
        </div>

        <div 
          className="rounded-lg border p-6 transition-colors"
          style={{
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="text-sm transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Total Streams</div>
            <TrendingUp className="h-5 w-5" style={{ color: '#3B82F6' }} />
          </div>
          <div className="mt-2 text-3xl font-semibold transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>{stats.totalStreams.toLocaleString()}</div>
          <div className="text-xs mt-1 transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>All platforms</div>
        </div>

        <div 
          className="rounded-lg border p-6 transition-colors"
          style={{
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="text-sm transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Avg per Stream</div>
            <Music className="h-5 w-5" style={{ color: '#A78BFA' }} />
          </div>
          <div className="mt-2 text-3xl font-semibold transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>
            ${stats.averagePerStream.toFixed(4)}
          </div>
          <div className="text-xs mt-1 transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Revenue per play</div>
        </div>

        <div 
          className="rounded-lg border p-6 transition-colors"
          style={{
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="text-sm transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Top Territory</div>
            <Globe className="h-5 w-5" style={{ color: '#F59E0B' }} />
          </div>
          <div className="mt-2 text-3xl font-semibold transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>{stats.topTerritory}</div>
          <div className="text-xs mt-1 transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Highest revenue</div>
        </div>
      </section>

      {/* Charts Row 1 */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performing Tracks */}
        <div 
          className="rounded-lg border p-6 transition-colors"
          style={{
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <h2 className="text-lg font-semibold mb-4 transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>Top Performing Tracks</h2>
          {topTracks.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart 
                data={topTracks}
                style={{ backgroundColor: isDark ? "transparent" : "#F9FAFB" }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.3} />
                <XAxis dataKey="title" tick={{ fill: axisColor, fontSize: 12 }} />
                <YAxis tick={{ fill: axisColor, fontSize: 12 }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: tooltipStyle.color }}
                />
                <Bar dataKey="revenue" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
              No data available
            </div>
          )}
        </div>

        {/* Platform/Source Breakdown */}
        <div 
          className="rounded-lg border p-6 transition-colors"
          style={{
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <h2 className="text-lg font-semibold mb-4 transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>Revenue by Source</h2>
          {sourceBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart style={{ backgroundColor: isDark ? "transparent" : "#F9FAFB" }}>
                <Pie
                  data={sourceBreakdown as unknown as { [key: string]: string | number }[]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ source, revenue }) => `${source}: €${Number(revenue).toFixed(2)}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="revenue"
                  nameKey="source"
                >
                  {sourceBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: any) => `€${Number(value).toFixed(2)}`}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
              No data available
            </div>
          )}
        </div>
      </section>

      {/* Charts Row 2 */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Territory Breakdown */}
        <div 
          className="rounded-lg border p-6 transition-colors"
          style={{
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <h2 className="text-lg font-semibold mb-4 transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>Revenue by Territory</h2>
          {territoryBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart 
                data={territoryBreakdown} 
                layout="vertical"
                style={{ backgroundColor: isDark ? "transparent" : "#F9FAFB" }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.3} />
                <XAxis type="number" tick={{ fill: axisColor, fontSize: 12 }} />
                <YAxis dataKey="territory" type="category" tick={{ fill: axisColor, fontSize: 12 }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
              No data available
            </div>
          )}
        </div>

        {/* Monthly Revenue Trend */}
        <div 
          className="rounded-lg border p-6 transition-colors"
          style={{
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <h2 className="text-lg font-semibold mb-4 transition-colors" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>Monthly Revenue Trend</h2>
          {monthlyRevenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart 
                data={monthlyRevenue}
                style={{ backgroundColor: isDark ? "transparent" : "#F9FAFB" }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.3} />
                <XAxis dataKey="month" tick={{ fill: axisColor, fontSize: 12 }} />
                <YAxis tick={{ fill: axisColor, fontSize: 12 }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey="revenue" fill="#f59e0b" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center transition-colors" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
              No data available
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
