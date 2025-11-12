"use client";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { ArrowLeft, Download } from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

interface RoyaltyRecord {
  id: string;
  songTitle: string;
  source: string;
  territory: string;
  usageCount: number;
  gross: number;
  adminPercent: number;
  net: number;
  date: string;
  iswc: string;
  composer: string;
  broadcastDate: string | null;
}

interface Quarter {
  year: number;
  quarter: number;
  label: string;
  startDate: Date;
  endDate: Date;
}

type ViewMode = "quarters" | "detail";

interface AnalyticsData {
  topTracks: { title: string; revenue: number }[];
  revenueBySource: { source: string; revenue: number; percentage: number }[];
  revenueByTerritory: { territory: string; revenue: number }[];
  monthlyRevenue: { month: string; revenue: number }[];
}

// Utility function to get quarter from a date
function getQuarterFromDate(date: Date): { year: number; quarter: number } {
  const month = date.getMonth(); // 0-11
  const quarter = Math.floor(month / 3) + 1; // 1-4
  return { year: date.getFullYear(), quarter };
}

// Utility function to get quarter label
function getQuarterLabel(year: number, quarter: number): string {
  return `${year} Quarter ${quarter}`;
}

// Utility function to get quarter date range
function getQuarterDateRange(year: number, quarter: number): { startDate: Date; endDate: Date } {
  const startMonth = (quarter - 1) * 3; // 0, 3, 6, 9
  const startDate = new Date(year, startMonth, 1);
  const endDate = new Date(year, startMonth + 3, 0, 23, 59, 59, 999); // Last day of the quarter
  
  return { startDate, endDate };
}

// Group royalties by quarter
function groupRoyaltiesByQuarter(royalties: RoyaltyRecord[]): Map<string, RoyaltyRecord[]> {
  const quarterMap = new Map<string, RoyaltyRecord[]>();

  royalties.forEach((royalty) => {
    if (!royalty.broadcastDate) {
      // Skip royalties without a date or add to "Unknown" quarter
      return;
    }

    const date = new Date(royalty.broadcastDate);
    if (isNaN(date.getTime())) {
      return;
    }

    const { year, quarter } = getQuarterFromDate(date);
    const quarterKey = `${year}-Q${quarter}`;

    if (!quarterMap.has(quarterKey)) {
      quarterMap.set(quarterKey, []);
    }
    quarterMap.get(quarterKey)!.push(royalty);
  });

  return quarterMap;
}

// Get sorted quarters from the map
function getSortedQuarters(quarterMap: Map<string, RoyaltyRecord[]>): Quarter[] {
  const quarters: Quarter[] = [];

  quarterMap.forEach((records, key) => {
    const [year, quarterStr] = key.split("-Q");
    const yearNum = parseInt(year);
    const quarterNum = parseInt(quarterStr);
    const { startDate, endDate } = getQuarterDateRange(yearNum, quarterNum);

    quarters.push({
      year: yearNum,
      quarter: quarterNum,
      label: getQuarterLabel(yearNum, quarterNum),
      startDate,
      endDate,
    });
  });

  // Sort by year and quarter descending (most recent first)
  return quarters.sort((a, b) => {
    if (a.year !== b.year) {
      return b.year - a.year;
    }
    return b.quarter - a.quarter;
  });
}

// Format date range for display
function formatDateRange(startDate: Date, endDate: Date): string {
  const startMonth = startDate.toLocaleDateString("en-US", { month: "short" });
  const startDay = startDate.getDate();
  const endMonth = endDate.toLocaleDateString("en-US", { month: "short" });
  const endDay = endDate.getDate();
  const year = startDate.getFullYear();
  
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
}

// Calculate analytics for a quarter
function calculateAnalytics(records: RoyaltyRecord[], selectedQuarter?: Quarter | null): AnalyticsData {
  // Top Performing Tracks (top 5 by revenue)
  const trackRevenue = new Map<string, number>();
  records.forEach((r) => {
    const existing = trackRevenue.get(r.songTitle) || 0;
    trackRevenue.set(r.songTitle, existing + r.net);
  });
  
  const topTracks = Array.from(trackRevenue.entries())
    .map(([title, revenue]) => ({ title, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Revenue by Source
  const sourceRevenue = new Map<string, number>();
  records.forEach((r) => {
    const existing = sourceRevenue.get(r.source) || 0;
    sourceRevenue.set(r.source, existing + r.net);
  });
  
  const totalRevenue = records.reduce((sum, r) => sum + r.net, 0);
  const revenueBySource = Array.from(sourceRevenue.entries())
    .map(([source, revenue]) => ({
      source,
      revenue,
      percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // Revenue by Territory
  const territoryRevenue = new Map<string, number>();
  records.forEach((r) => {
    const existing = territoryRevenue.get(r.territory) || 0;
    territoryRevenue.set(r.territory, existing + r.net);
  });
  
  const revenueByTerritory = Array.from(territoryRevenue.entries())
    .map(([territory, revenue]) => ({ territory, revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  // Monthly Revenue Trend
  const monthRevenue = new Map<string, number>();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  records.forEach((r) => {
    if (r.broadcastDate) {
      const date = new Date(r.broadcastDate);
      const monthKey = `${monthNames[date.getMonth()]}`;
      const existing = monthRevenue.get(monthKey) || 0;
      monthRevenue.set(monthKey, existing + r.net);
    }
  });
  
  // Get months for the quarter (Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec)
  let quarterMonths: string[] = [];
  if (selectedQuarter) {
    // Use the selected quarter to determine months
    const quarter = selectedQuarter.quarter - 1; // Convert to 0-based (0-3)
    const startMonth = quarter * 3;
    for (let i = 0; i < 3; i++) {
      quarterMonths.push(monthNames[startMonth + i]);
    }
  } else if (records.length > 0) {
    // Fallback: determine quarter from first record
    const firstRecord = records.find(r => r.broadcastDate);
    if (firstRecord) {
      const firstDate = new Date(firstRecord.broadcastDate);
      const month = firstDate.getMonth(); // 0-11
      const quarter = Math.floor(month / 3); // 0-3
      const startMonth = quarter * 3;
      for (let i = 0; i < 3; i++) {
        quarterMonths.push(monthNames[startMonth + i]);
      }
    }
  }
  
  const monthlyRevenue = quarterMonths.map((month) => ({
    month,
    revenue: monthRevenue.get(month) || 0,
  }));

  return {
    topTracks,
    revenueBySource,
    revenueByTerritory,
    monthlyRevenue,
  };
}

// Chart colors for pie/donut chart
const PIE_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#F97316", // Orange
];

export default function RoyaltiesPage() {
  const { user } = useAuth();
  const [allRoyalties, setAllRoyalties] = useState<RoyaltyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("quarters");
  const [selectedQuarter, setSelectedQuarter] = useState<Quarter | null>(null);
  const [quarters, setQuarters] = useState<Quarter[]>([]);
  const [quarterData, setQuarterData] = useState<Map<string, RoyaltyRecord[]>>(new Map());

  async function loadAllRoyalties() {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Build query based on role - select all fields from royalties
      let query = supabase.from("royalties").select("*");

      // If artist, filter by their artist_id
      if (user.role === "artist") {
        // First, get the artist record from the artists table
        const { data: artistRecord, error: artistError } = await supabase
          .from("artists")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (artistError || !artistRecord) {
          setAllRoyalties([]);
          setLoading(false);
          return;
        }

        // Filter by artist_id
        query = query.eq("artist_id", artistRecord.id);
      }

      // Order by broadcast_date descending (most recent first)
      query = query.order("broadcast_date", { ascending: false, nullsFirst: false });

      // Execute query - load all royalties for grouping
      const { data: royalties, error } = await query;

      if (error) {
        console.error("Error fetching royalties:", error);
        setAllRoyalties([]);
        return;
      }

      // Transform data to match the table format
      const records: RoyaltyRecord[] = (royalties || [])
        .filter((royalty) => royalty.broadcast_date) // Only include royalties with dates
        .map((royalty) => {
          // Format date
          let dateStr = "N/A";
          if (royalty.broadcast_date) {
            const date = new Date(royalty.broadcast_date);
            dateStr = date.toLocaleDateString();
          }

          return {
            id: royalty.id,
            songTitle: royalty.track_title || royalty.song_title || "Unknown",
            source: royalty.exploitation_source_name || royalty.platform || "Unknown",
            territory: royalty.territory || "Unknown",
            usageCount: royalty.usage_count || 0,
            gross: Number(royalty.gross_amount || 0),
            adminPercent: Number(royalty.admin_percent || royalty.administration_percent || 0),
            net: Number(royalty.net_amount || 0),
            date: dateStr,
            iswc: royalty.iswc || "—",
            composer: royalty.song_composers || royalty.composers || "—",
            broadcastDate: royalty.broadcast_date || null,
          };
        });

      setAllRoyalties(records);

      // Group by quarter
      const grouped = groupRoyaltiesByQuarter(records);
      setQuarterData(grouped);
      const sortedQuarters = getSortedQuarters(grouped);
      setQuarters(sortedQuarters);
    } catch (error) {
      console.error("Error loading royalties:", error);
      setAllRoyalties([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) {
      loadAllRoyalties();
    }
  }, [user]);

  // Get quarter records (always call hooks before conditional returns)
  const getQuarterRecords = (): RoyaltyRecord[] => {
    if (!selectedQuarter) return [];
    const quarterKey = `${selectedQuarter.year}-Q${selectedQuarter.quarter}`;
    return quarterData.get(quarterKey) || [];
  };

  const quarterRecords = getQuarterRecords();
  
  // Calculate analytics (must be called unconditionally before any early returns)
  const analytics = useMemo(() => {
    if (viewMode === "detail" && quarterRecords.length > 0) {
      return calculateAnalytics(quarterRecords, selectedQuarter);
    }
    // Return empty analytics when not in detail view
    return {
      topTracks: [],
      revenueBySource: [],
      revenueByTerritory: [],
      monthlyRevenue: [],
    };
  }, [quarterRecords, selectedQuarter, viewMode]);

  const handleQuarterClick = (quarter: Quarter) => {
    setSelectedQuarter(quarter);
    setViewMode("detail");
  };

  const handleBackToQuarters = () => {
    setViewMode("quarters");
    setSelectedQuarter(null);
  };

  const handleExportCSV = () => {
    if (!selectedQuarter) {
      return;
    }

    // Get records for the selected quarter
    const quarterKey = `${selectedQuarter.year}-Q${selectedQuarter.quarter}`;
    const records = quarterData.get(quarterKey) || [];

    if (records.length === 0) {
      return;
    }

    // Define CSV headers
    const headers = [
      "Song Title",
      "Source",
      "Territory",
      "Usage Count",
      "Gross",
      "Admin %",
      "Net",
      "Date",
      "ISWC",
      "Composer",
    ];

    // Convert records to CSV rows
    const rows = records.map((r) => [
      r.songTitle,
      r.source,
      r.territory,
      r.usageCount.toString(),
      r.gross.toFixed(2),
      r.adminPercent.toFixed(1),
      r.net.toFixed(2),
      r.date,
      r.iswc,
      r.composer,
    ]);

    // Create CSV content
    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const quarterLabel = selectedQuarter.label.replace(/\s+/g, "-");
    a.download = `royalties-${quarterLabel}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Quarter List View
  if (viewMode === "quarters") {
    return (
      <div 
        className="min-h-screen bg-white p-4 md:p-6 transition-opacity duration-300" 
        style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
      >
        <div className="max-w-6xl mx-auto">
          {/* Header Section */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Royalties</h1>
            <p className="text-sm text-gray-600">View royalty data grouped by quarters</p>
          </div>

          {/* Quarters Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
                <span className="text-gray-600">Loading quarters...</span>
              </div>
            </div>
          ) : quarters.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-600">No royalty data available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {quarters.map((quarter) => {
                const quarterKey = `${quarter.year}-Q${quarter.quarter}`;
                const records = quarterData.get(quarterKey) || [];
                const totalRecords = records.length;
                const totalNet = records.reduce((sum, r) => sum + r.net, 0);
                const dateRange = formatDateRange(quarter.startDate, quarter.endDate);

                return (
                  <button
                    key={quarterKey}
                    onClick={() => handleQuarterClick(quarter)}
                    className="bg-[#F9FAFB] hover:bg-[#F3F4F6] rounded-2xl p-6 text-left transition-all duration-200 ease-in-out shadow-sm hover:shadow-md transform hover:-translate-y-1 cursor-pointer"
                  >
                    <div className="font-semibold text-lg text-gray-900 mb-2">{quarter.label}</div>
                    <div className="text-xl font-bold text-blue-600 mb-2">€{totalNet.toFixed(2)}</div>
                    <div className="text-sm text-gray-500 mb-2">{dateRange}</div>
                    <div className="text-sm text-gray-600 mt-2">
                      {totalRecords} {totalRecords === 1 ? "record" : "records"}
                    </div>
                    <div className="text-xs text-gray-500 mt-3">Click to view details</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Quarter Detail View


  return (
    <div 
      className="min-h-screen bg-white transition-opacity duration-300" 
      style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
    >
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Header with Back Button */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handleBackToQuarters}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors duration-200 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Quarters</span>
            </button>
            {selectedQuarter && quarterRecords.length > 0 && (
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200 ease-in-out"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
            )}
          </div>
          <h1 className="text-2xl font-semibold text-gray-800 mb-2">
            Royalties — {selectedQuarter?.label || ""}
          </h1>
          <p className="text-sm text-gray-600">Detailed breakdown and analytics for this quarter.</p>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-[#E5E7EB]">
                    <th className="px-3 md:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                      Song Title
                    </th>
                    <th className="px-3 md:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                      Source
                    </th>
                    <th className="px-3 md:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                      Territory
                    </th>
                    <th className="px-3 md:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                      Usage Count
                    </th>
                    <th className="px-3 md:px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                      Gross
                    </th>
                    <th className="px-3 md:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                      Admin %
                    </th>
                    <th className="px-3 md:px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                      Net
                    </th>
                    <th className="px-3 md:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                      Date
                    </th>
                    <th className="px-3 md:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                      ISWC
                    </th>
                    <th className="px-3 md:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                      Composer
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-[#E5E7EB]">
                  {quarterRecords.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-gray-600" colSpan={10}>
                        No royalties found for this quarter
                      </td>
                    </tr>
                  ) : (
                    quarterRecords.map((r, index) => (
                      <tr
                        key={r.id}
                        className={`transition-colors duration-150 ${
                          index % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"
                        } hover:bg-gray-50`}
                      >
                        <td className="px-3 md:px-4 py-3 text-[#222] whitespace-nowrap">{r.songTitle}</td>
                        <td className="px-3 md:px-4 py-3 text-[#222] whitespace-nowrap">{r.source}</td>
                        <td className="px-3 md:px-4 py-3 text-[#222] whitespace-nowrap">{r.territory}</td>
                        <td className="px-3 md:px-4 py-3 text-[#222] whitespace-nowrap">{r.usageCount.toLocaleString()}</td>
                        <td className="px-3 md:px-4 py-3 text-right text-[#222] font-medium whitespace-nowrap">
                          €{r.gross.toFixed(2)}
                        </td>
                        <td className="px-3 md:px-4 py-3 text-[#222] whitespace-nowrap">{r.adminPercent.toFixed(1)}%</td>
                        <td className="px-3 md:px-4 py-3 text-right text-[#222] font-semibold whitespace-nowrap">
                          €{r.net.toFixed(2)}
                        </td>
                        <td className="px-3 md:px-4 py-3 text-[#222] whitespace-nowrap">{r.date}</td>
                        <td className="px-3 md:px-4 py-3 text-[#222] whitespace-nowrap">{r.iswc}</td>
                        <td className="px-3 md:px-4 py-3 text-[#222] whitespace-nowrap">{r.composer}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
          </div>
        </div>

        {/* Analytics Dashboard */}
        <div className="mt-8">
          <div className="border-t border-[#E5E7EB] pt-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">Analytics Dashboard</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Performing Tracks */}
              <div className="bg-white rounded-xl shadow-sm p-5 border border-[#E5E7EB]">
                <h3 className="text-gray-800 font-semibold mb-3">Top Performing Tracks</h3>
                {analytics.topTracks.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={analytics.topTracks}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 150, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.3} />
                      <XAxis type="number" tick={{ fill: "#6B7280", fontSize: 12 }} />
                      <YAxis
                        type="category"
                        dataKey="title"
                        width={140}
                        tick={{ fill: "#6B7280", fontSize: 11 }}
                        interval={0}
                      />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                                <p className="font-semibold text-gray-800 mb-1">{data.title}</p>
                                <p className="text-sm text-gray-600">Revenue: €{data.revenue.toFixed(2)}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="revenue" fill="#3B82F6" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">
                    No data available
                  </div>
                )}
              </div>

              {/* Revenue by Source */}
              <div className="bg-white rounded-xl shadow-sm p-5 border border-[#E5E7EB]">
                <h3 className="text-gray-800 font-semibold mb-3">Revenue by Source</h3>
                {analytics.revenueBySource.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={analytics.revenueBySource}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ percentage }) => percentage > 5 ? `${percentage.toFixed(1)}%` : ''}
                        outerRadius={80}
                        innerRadius={40}
                        fill="#8884d8"
                        dataKey="revenue"
                      >
                        {analytics.revenueBySource.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                                <p className="font-semibold text-gray-800">{data.source}</p>
                                <p className="text-sm text-gray-600">Revenue: €{data.revenue.toFixed(2)}</p>
                                <p className="text-sm text-gray-600">Share: {data.percentage.toFixed(1)}%</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">
                    No data available
                  </div>
                )}
              </div>

              {/* Revenue by Territory */}
              <div className="bg-white rounded-xl shadow-sm p-5 border border-[#E5E7EB]">
                <h3 className="text-gray-800 font-semibold mb-3">Revenue by Territory</h3>
                {analytics.revenueByTerritory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.revenueByTerritory} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.3} />
                      <XAxis 
                        dataKey="territory" 
                        tick={{ fill: "#6B7280", fontSize: 11 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis tick={{ fill: "#6B7280", fontSize: 12 }} />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                                <p className="font-semibold text-gray-800 mb-1">{data.territory}</p>
                                <p className="text-sm text-gray-600">Revenue: €{data.revenue.toFixed(2)}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="revenue" fill="#10B981" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">
                    No data available
                  </div>
                )}
              </div>

              {/* Monthly Revenue Trend */}
              <div className="bg-white rounded-xl shadow-sm p-5 border border-[#E5E7EB]">
                <h3 className="text-gray-800 font-semibold mb-3">Monthly Revenue Trend</h3>
                {analytics.monthlyRevenue.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analytics.monthlyRevenue} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.3} />
                      <XAxis dataKey="month" tick={{ fill: "#6B7280", fontSize: 12 }} />
                      <YAxis tick={{ fill: "#6B7280", fontSize: 12 }} />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                                <p className="font-semibold text-gray-800 mb-1">{data.month}</p>
                                <p className="text-sm text-gray-600">Revenue: €{data.revenue.toFixed(2)}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#F59E0B"
                        strokeWidth={2}
                        dot={{ fill: "#F59E0B", r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">
                    No data available
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Royalties and analytics are automatically generated by Good Life Music Portal.</p>
        </div>
      </div>
    </div>
  );
}


