"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { ArrowLeft } from "lucide-react";

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

  const handleQuarterClick = (quarter: Quarter) => {
    setSelectedQuarter(quarter);
    setViewMode("detail");
  };

  const handleBackToQuarters = () => {
    setViewMode("quarters");
    setSelectedQuarter(null);
  };

  const getQuarterRecords = (): RoyaltyRecord[] => {
    if (!selectedQuarter) return [];
    const quarterKey = `${selectedQuarter.year}-Q${selectedQuarter.quarter}`;
    return quarterData.get(quarterKey) || [];
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

                return (
                  <button
                    key={quarterKey}
                    onClick={() => handleQuarterClick(quarter)}
                    className="bg-[#F9FAFB] hover:bg-[#F3F4F6] rounded-xl p-6 text-left transition-all duration-200 ease-in-out shadow-sm hover:shadow-md transform hover:-translate-y-1 cursor-pointer"
                  >
                    <div className="font-bold text-lg text-gray-800 mb-1">{quarter.label}</div>
                    <div className="text-sm text-gray-600 mt-2">
                      {totalRecords} {totalRecords === 1 ? "record" : "records"}
                    </div>
                    {totalNet > 0 && (
                      <div className="text-sm font-medium text-gray-700 mt-1">
                        Total Net: €{totalNet.toFixed(2)}
                      </div>
                    )}
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
  const quarterRecords = getQuarterRecords();

  return (
    <div 
      className="min-h-screen bg-white transition-opacity duration-300" 
      style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
    >
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Header with Back Button */}
        <div className="mb-6">
          <button
            onClick={handleBackToQuarters}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4 transition-colors duration-200 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Quarters</span>
          </button>
          <h1 className="text-2xl font-bold text-gray-800">
            Royalties — {selectedQuarter?.label || ""}
          </h1>
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

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Royalties data are automatically generated by Good Life Music Portal.</p>
        </div>
      </div>
    </div>
  );
}


