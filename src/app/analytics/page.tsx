"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
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
  
  const [topTracks, setTopTracks] = useState<TrackPerformance[]>([]);
  const [territoryBreakdown, setTerritoryBreakdown] = useState<TerritoryData[]>([]);
  const [sourceBreakdown, setSourceBreakdown] = useState<SourceData[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyData[]>([]);
  const [loadingData, setLoadingData] = useState(true);

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

  // Unified Green Color Palette
  const GREEN_PALETTE = {
    primary: "#1ABC9C",      // Primary Green
    secondary: "#48C9B0",    // Secondary Green (lighter)
    dark: "#16A085",         // Dark Green (text/accents)
    light: "#7EDCC7",        // Light Green (for gradients)
    lighter: "#A8E6D7",      // Lighter Green
    background: "#F8F9FA",   // Neutral Gray background
    grid: "#E5E7EB",         // Light Gray gridlines
  };

  // Green gradient for pie charts (monochrome)
  const GREEN_GRADIENT = [
    GREEN_PALETTE.primary,
    GREEN_PALETTE.secondary,
    GREEN_PALETTE.light,
    GREEN_PALETTE.lighter,
    "#C5F3E8"
  ];

  return (
    <div className="space-y-8 p-1">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
        <p className="text-sm mt-2 text-gray-600">
          Performance insights and revenue breakdown
        </p>
      </div>

      {/* Key Metrics - Modern Green Theme */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 border border-gray-100">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-lg" style={{ backgroundColor: `${GREEN_PALETTE.primary}20` }}>
              <DollarSign className="h-6 w-6" style={{ color: GREEN_PALETTE.primary }} />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-600">Total Revenue</p>
            <p className="text-3xl font-bold text-gray-900">
              €{stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500">Total Earnings</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 border border-gray-100">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-lg" style={{ backgroundColor: `${GREEN_PALETTE.secondary}20` }}>
              <TrendingUp className="h-6 w-6" style={{ color: GREEN_PALETTE.secondary }} />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-600">Total Streams</p>
            <p className="text-3xl font-bold text-gray-900">{stats.totalStreams.toLocaleString()}</p>
            <p className="text-xs text-gray-500">All platforms</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 border border-gray-100">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-lg" style={{ backgroundColor: `${GREEN_PALETTE.dark}20` }}>
              <Music className="h-6 w-6" style={{ color: GREEN_PALETTE.dark }} />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-600">Avg per Stream</p>
            <p className="text-3xl font-bold text-gray-900">
              €{stats.averagePerStream.toFixed(4)}
            </p>
            <p className="text-xs text-gray-500">Revenue per play</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 border border-gray-100">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-lg" style={{ backgroundColor: `${GREEN_PALETTE.light}20` }}>
              <Globe className="h-6 w-6" style={{ color: GREEN_PALETTE.primary }} />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-600">Top Territory</p>
            <p className="text-3xl font-bold text-gray-900">{stats.topTerritory}</p>
            <p className="text-xs text-gray-500">Highest revenue</p>
          </div>
        </div>
      </section>

      {/* Charts Row 1 */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performing Tracks */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900">Top Performing Tracks</h2>
            <p className="text-sm text-gray-500 mt-1">By revenue generated</p>
          </div>
          <div className="p-6">
            {topTracks.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topTracks}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GREEN_PALETTE.grid} opacity={0.3} />
                  <XAxis 
                    dataKey="title" 
                    tick={{ fill: '#6B7280', fontSize: 12 }} 
                    axisLine={{ stroke: GREEN_PALETTE.grid }}
                  />
                  <YAxis 
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                    axisLine={{ stroke: GREEN_PALETTE.grid }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    }}
                    formatter={(value: any) => `€${Number(value).toFixed(2)}`}
                  />
                  <Bar dataKey="revenue" fill={GREEN_PALETTE.primary} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Platform/Source Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900">Revenue by Source</h2>
            <p className="text-sm text-gray-500 mt-1">Platform distribution</p>
          </div>
          <div className="p-6">
            {sourceBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={sourceBreakdown as unknown as { [key: string]: string | number }[]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ source, revenue }) => `${source}: €${Number(revenue).toFixed(2)}`}
                    outerRadius={100}
                    fill={GREEN_PALETTE.primary}
                    dataKey="revenue"
                    nameKey="source"
                  >
                    {sourceBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={GREEN_GRADIENT[index % GREEN_GRADIENT.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    }}
                    formatter={(value: any) => `€${Number(value).toFixed(2)}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                No data available
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Charts Row 2 */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Territory Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900">Revenue by Territory</h2>
            <p className="text-sm text-gray-500 mt-1">Geographic distribution</p>
          </div>
          <div className="p-6">
            {territoryBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart 
                  data={territoryBreakdown} 
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={GREEN_PALETTE.grid} opacity={0.3} />
                  <XAxis 
                    type="number" 
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                    axisLine={{ stroke: GREEN_PALETTE.grid }}
                  />
                  <YAxis 
                    dataKey="territory" 
                    type="category" 
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                    axisLine={{ stroke: GREEN_PALETTE.grid }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    }}
                    formatter={(value: any) => `€${Number(value).toFixed(2)}`}
                  />
                  <Bar dataKey="revenue" fill={GREEN_PALETTE.secondary} radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Monthly Revenue Trend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900">Monthly Revenue Trend</h2>
            <p className="text-sm text-gray-500 mt-1">Last 6 months performance</p>
          </div>
          <div className="p-6">
            {monthlyRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GREEN_PALETTE.grid} opacity={0.3} />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                    axisLine={{ stroke: GREEN_PALETTE.grid }}
                  />
                  <YAxis 
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                    axisLine={{ stroke: GREEN_PALETTE.grid }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    }}
                    formatter={(value: any) => `€${Number(value).toFixed(2)}`}
                  />
                  <Bar dataKey="revenue" fill={GREEN_PALETTE.dark} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                No data available
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
