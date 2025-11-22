"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
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
  const [showAllSourcesModal, setShowAllSourcesModal] = useState(false);

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
              <div className="space-y-4">
                <div className="flex flex-col lg:flex-row gap-6 items-center">
                  {/* Pie Chart - Left Side */}
                  <div className="w-full lg:w-1/2 flex justify-center">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={sourceBreakdown.slice(0, 5) as unknown as { [key: string]: string | number }[]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={false}
                          outerRadius={100}
                          fill={GREEN_PALETTE.primary}
                          dataKey="revenue"
                          nameKey="source"
                        >
                          {sourceBreakdown.slice(0, 5).map((entry, index) => (
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
                  </div>

                  {/* Legend - Right Side */}
                  <div className="w-full lg:w-1/2">
                    <div className="flex flex-col gap-3">
                      {sourceBreakdown.slice(0, 5).map((item, index) => {
                        const totalRevenue = sourceBreakdown.reduce((sum, s) => sum + s.revenue, 0);
                        const percentage = ((item.revenue / totalRevenue) * 100).toFixed(1);
                        return (
                          <div 
                            key={item.source}
                            className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-4 h-4 rounded-full flex-shrink-0"
                                style={{ backgroundColor: GREEN_GRADIENT[index % GREEN_GRADIENT.length] }}
                              />
                              <span className="text-sm font-medium text-gray-700">
                                {item.source}
                              </span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-sm font-semibold text-gray-900">
                                €{item.revenue.toFixed(2)}
                              </span>
                              <span className="text-xs text-gray-500">
                                {percentage}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* See More Button */}
                {sourceBreakdown.length > 5 && (
                  <div className="flex justify-center">
                    <button
                      onClick={() => setShowAllSourcesModal(true)}
                      className="px-6 py-2 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-lg font-medium hover:from-green-600 hover:to-teal-600 transition-all duration-300 shadow-md hover:shadow-lg"
                    >
                      See More ({sourceBreakdown.length - 5} more sources)
                    </button>
                  </div>
                )}
              </div>
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

      {/* All Sources Modal */}
      {showAllSourcesModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={() => setShowAllSourcesModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-teal-50">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">All Revenue Sources</h2>
                <p className="text-sm text-gray-600 mt-1">Complete platform breakdown</p>
              </div>
              <button
                onClick={() => setShowAllSourcesModal(false)}
                className="p-2 hover:bg-white rounded-lg transition-colors"
              >
                <X className="h-6 w-6 text-gray-600" />
              </button>
            </div>
            
            {/* Modal Content - Scrollable */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="space-y-3">
                {sourceBreakdown.map((item, index) => {
                  const totalRevenue = sourceBreakdown.reduce((sum, s) => sum + s.revenue, 0);
                  const percentage = ((item.revenue / totalRevenue) * 100).toFixed(1);
                  return (
                    <div 
                      key={item.source}
                      className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-green-300 hover:shadow-md transition-all duration-200 bg-gradient-to-r from-white to-gray-50"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-green-100 to-teal-100 text-green-700 font-bold text-sm">
                          {index + 1}
                        </div>
                        <div 
                          className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: GREEN_GRADIENT[index % GREEN_GRADIENT.length] }}
                        />
                        <span className="text-sm font-semibold text-gray-800">
                          {item.source}
                        </span>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-sm font-bold text-gray-900">
                            €{item.revenue.toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {percentage}% of total
                          </div>
                        </div>
                        <div className="w-16">
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-green-500 to-teal-500 rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary Footer */}
              <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-teal-50 rounded-xl border border-green-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">Total Revenue</span>
                  <span className="text-lg font-bold text-green-700">
                    €{sourceBreakdown.reduce((sum, s) => sum + s.revenue, 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-semibold text-gray-700">Total Sources</span>
                  <span className="text-lg font-bold text-teal-700">
                    {sourceBreakdown.length}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="flex justify-end p-6 border-t border-gray-200 bg-gray-50">
                
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
