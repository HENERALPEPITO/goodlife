"use client";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { createClientTimer } from "@/lib/performanceLogger";
import { ArrowLeft, Download, DollarSign, Loader2, AlertCircle, Eye, FileText, Search, Filter, ChevronDown, X } from "lucide-react";
import Big from "big.js";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  gross: string | number;  // Keep as string for precision
  adminPercent: string | number;  // Keep as string for precision
  net: string | number;  // Keep as string for precision
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
  quarterlyRevenue: { quarter: string; revenue: number }[];
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

// Helper to convert string | number to number safely (for display only, after precision calculations)
function toNumber(value: string | number): number {
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  }
  return value;
}

// Helper to safely create a Big value from string or number
// This preserves full precision by working with the raw string value
function toBig(value: string | number): Big {
  try {
    // Prefer string representation to avoid float precision loss
    const strValue = String(value).trim();
    if (strValue === '' || strValue === 'null' || strValue === 'undefined') {
      return new Big(0);
    }
    return new Big(strValue);
  } catch (e) {
    console.warn('toBig: Failed to parse value, defaulting to 0:', value, e);
    return new Big(0);
  }
}

// Helper to sum amounts precisely using Big.js for arbitrary precision
// This matches Admin Dashboard's PostgreSQL NUMERIC precision
function sumAmountsPrecise(records: RoyaltyRecord[], field: 'net' | 'gross', debug = false): number {
  let sum = new Big(0);
  
  if (debug) {
    console.group(`[Precision Debug] Summing ${field} for ${records.length} records`);
  }
  
  records.forEach((r, index) => {
    const rawValue = r[field];
    const bigValue = toBig(rawValue);
    sum = sum.plus(bigValue);
    
    if (debug && index < 5) {
      // Log first 5 records for debugging
      console.log(`  Record ${index + 1}: Raw DB Value: "${rawValue}" → Parsed Big: ${bigValue.toString()} → Accumulated Sum: ${sum.toString()}`);
    }
  });
  
  const result = parseFloat(sum.toFixed(2));
  
  if (debug) {
    console.log(`  Final Sum (Big): ${sum.toString()}`);
    console.log(`  Final Sum (toFixed 2): ${sum.toFixed(2)}`);
    console.log(`  Final Result (Number): ${result}`);
    console.groupEnd();
  }
  
  return result;
}

// Helper to sum amounts and return as Big for intermediate calculations
function sumAmountsPreciseBig(records: RoyaltyRecord[], field: 'net' | 'gross'): Big {
  return records.reduce((sum, r) => {
    return sum.plus(toBig(r[field]));
  }, new Big(0));
}

// Calculate analytics for a quarter using Big.js for precision
function calculateAnalytics(records: RoyaltyRecord[], selectedQuarter?: Quarter | null): AnalyticsData {
  // Top Performing Tracks (top 5 by revenue) - using Big.js for precision
  const trackRevenueBig = new Map<string, Big>();
  records.forEach((r) => {
    const existing = trackRevenueBig.get(r.songTitle) || new Big(0);
    trackRevenueBig.set(r.songTitle, existing.plus(toBig(r.net)));
  });
  
  const topTracks = Array.from(trackRevenueBig.entries())
    .map(([title, revenueBig]) => ({ title, revenue: parseFloat(revenueBig.toFixed(2)) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Revenue by Source - using Big.js for precision
  const sourceRevenueBig = new Map<string, Big>();
  records.forEach((r) => {
    const existing = sourceRevenueBig.get(r.source) || new Big(0);
    sourceRevenueBig.set(r.source, existing.plus(toBig(r.net)));
  });
  
  const totalRevenueBig = sumAmountsPreciseBig(records, 'net');
  const totalRevenue = parseFloat(totalRevenueBig.toFixed(2));
  const revenueBySource = Array.from(sourceRevenueBig.entries())
    .map(([source, revenueBig]) => {
      const revenue = parseFloat(revenueBig.toFixed(2));
      return {
        source,
        revenue,
        percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // Revenue by Territory - using Big.js for precision
  const territoryRevenueBig = new Map<string, Big>();
  records.forEach((r) => {
    const existing = territoryRevenueBig.get(r.territory) || new Big(0);
    territoryRevenueBig.set(r.territory, existing.plus(toBig(r.net)));
  });
  
  const revenueByTerritory = Array.from(territoryRevenueBig.entries())
    .map(([territory, revenueBig]) => ({ territory, revenue: parseFloat(revenueBig.toFixed(2)) }))
    .sort((a, b) => b.revenue - a.revenue);

  // Monthly Revenue Trend - using Big.js for precision
  const monthRevenueBig = new Map<string, Big>();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  records.forEach((r) => {
    if (r.broadcastDate) {
      const date = new Date(r.broadcastDate);
      const monthKey = `${monthNames[date.getMonth()]}`;
      const existing = monthRevenueBig.get(monthKey) || new Big(0);
      monthRevenueBig.set(monthKey, existing.plus(toBig(r.net)));
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
    if (firstRecord && firstRecord.broadcastDate) {
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
    revenue: parseFloat((monthRevenueBig.get(month) || new Big(0)).toFixed(2)),
  }));

  // Quarterly Revenue Trend (for all-time view or multiple quarters) - using Big.js
  const quarterRevenueBig = new Map<string, Big>();
  records.forEach((r) => {
    if (r.broadcastDate) {
      const date = new Date(r.broadcastDate);
      const { year, quarter } = getQuarterFromDate(date);
      const quarterKey = `Q${quarter} ${year}`;
      const existing = quarterRevenueBig.get(quarterKey) || new Big(0);
      quarterRevenueBig.set(quarterKey, existing.plus(toBig(r.net)));
    }
  });

  const quarterlyRevenue = Array.from(quarterRevenueBig.entries())
    .map(([quarter, revenueBig]) => ({ quarter, revenue: parseFloat(revenueBig.toFixed(2)) }))
    .sort((a, b) => {
      const [q1, y1] = a.quarter.split(' ');
      const [q2, y2] = b.quarter.split(' ');
      return y1 === y2 ? q1.localeCompare(q2) : y1.localeCompare(y2);
    })
    .slice(-8);

  return {
    topTracks,
    revenueBySource,
    revenueByTerritory,
    monthlyRevenue,
    quarterlyRevenue,
  };
}

// Unified Green Color Palette for Analytics
const GREEN_PALETTE = {
  primary: "#1ABC9C",      // Primary Green
  secondary: "#48C9B0",    // Secondary Green
  dark: "#16A085",         // Dark Green
  light: "#7DCEA0",        // Light Green
  lighter: "#A9DFBF",      // Lighter Green
  lightest: "#D5F4E6",     // Lightest Green
  neutral: "#F8F9FA",      // Neutral Gray
  grid: "#E5E7EB",         // Light Gridline Gray
};

// Green gradient for pie/donut charts (monochrome green theme)
const PIE_COLORS = [
  GREEN_PALETTE.primary,   // Primary Green
  GREEN_PALETTE.secondary, // Secondary Green
  GREEN_PALETTE.light,     // Light Green
  GREEN_PALETTE.lighter,   // Lighter Green
  GREEN_PALETTE.dark,      // Dark Green
  GREEN_PALETTE.lightest,  // Lightest Green
];

export default function RoyaltiesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [allRoyalties, setAllRoyalties] = useState<RoyaltyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("quarters");
  const [selectedQuarter, setSelectedQuarter] = useState<Quarter | null>(null);
  const [quarters, setQuarters] = useState<Quarter[]>([]);
  const [quarterData, setQuarterData] = useState<Map<string, RoyaltyRecord[]>>(new Map());
  
  // Payment Request State
  const [balance, setBalance] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  
  // Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [displayLimit, setDisplayLimit] = useState(10);
  
  // Analytics Modal State
  const [showAllSourcesModal, setShowAllSourcesModal] = useState(false);

  // Redirect admins - only artists can view royalties
  useEffect(() => {
    if (user && user.role === "admin") {
      router.push("/admin/users");
    }
  }, [user, router]);

  // Performance timer
  const perfTimer = useRef(createClientTimer("RoyaltiesPage"));

  // Payment Request Functions
  // Using API route to fetch balance
  const fetchBalance = useCallback(async () => {
    try {
      if (!user) return;

      perfTimer.current.startApiRequest("/api/data/balance");
      const res = await fetch(`/api/data/balance?user_id=${user.id}`, { cache: "no-store" });
      const json = await res.json();
      perfTimer.current.endApiRequest("/api/data/balance");
      
      if (json.error) {
        console.error("Error fetching balance:", json.error);
        setBalance(0);
      } else {
        setBalance(json.balance || 0);
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
      setBalance(0);
    }
  }, [user]);

  // Using API route to check pending request
  const checkPendingRequest = useCallback(async () => {
    try {
      if (!user) return;

      perfTimer.current.startApiRequest("/api/data/pending-request");
      const res = await fetch(`/api/data/pending-request?user_id=${user.id}`, { cache: "no-store" });
      const json = await res.json();
      perfTimer.current.endApiRequest("/api/data/pending-request");
      
      if (json.error) {
        console.error("Error checking pending request:", json.error);
        return;
      }

      setHasPendingRequest(json.hasPendingRequest || false);
    } catch (error) {
      console.error("Error checking pending request:", error);
    }
  }, [user]);

  const handleRequestPayment = async () => {
    if (!user) return;

    try {
      setRequesting(true);

      // First, get the artist ID via API
      const balanceRes = await fetch(`/api/data/balance?user_id=${user.id}`, { cache: "no-store" });
      const balanceJson = await balanceRes.json();
      
      if (!balanceJson.artistId) {
        throw new Error("Artist record not found");
      }

      // Call the API to create payment request
      const response = await fetch("/api/payment/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          artist_id: balanceJson.artistId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to create payment request");
      }

      toast({
        title: "Payment Request Created",
        description: "Your payment request has been submitted successfully.",
      });

      // Refresh balance and check for pending requests
      await fetchBalance();
      await checkPendingRequest();
      setConfirmOpen(false);

      // Redirect to payments page
      router.push("/artist/payments");
    } catch (error: any) {
      console.error("Error creating payment request:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to create payment request",
        variant: "destructive",
      });
    } finally {
      setRequesting(false);
    }
  };

  const canRequest = balance >= 100 && !hasPendingRequest;
  const minBalance = 100;

  const loadAllRoyalties = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Skip loading if admin (will redirect)
    if (user.role === "admin") {
      return;
    }

    setLoading(true);
    perfTimer.current.startPageLoad();
    try {
      // Fetch royalties via API route
      perfTimer.current.startApiRequest("/api/data/royalties");
      const res = await fetch(
        `/api/data/royalties?user_id=${user.id}&role=${user.role}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      perfTimer.current.endApiRequest("/api/data/royalties");

      if (json.error) {
        console.error("Error fetching royalties:", json.error);
        setAllRoyalties([]);
        return;
      }

      const royalties = json.data || [];

      // Transform data to match the table format
      const records: RoyaltyRecord[] = royalties
        .filter((royalty: any) => royalty.broadcast_date) // Only include royalties with dates
        .map((royalty: any) => {
          // Format date
          let dateStr = "N/A";
          if (royalty.broadcast_date) {
            const date = new Date(royalty.broadcast_date);
            dateStr = date.toLocaleDateString();
          }

          return {
            id: royalty.id,
            songTitle: royalty.tracks?.title || "Unknown",
            source: royalty.exploitation_source_name || "Unknown",
            territory: royalty.territory || "Unknown",
            usageCount: royalty.usage_count || 0,
            gross: royalty.gross_amount || "0",  // Keep as string for precision
            adminPercent: royalty.admin_percent || "0",  // Keep as string for precision
            net: royalty.net_amount || "0",  // Keep as string for precision
            date: dateStr,
            iswc: royalty.tracks?.isrc || "—",
            composer: royalty.tracks?.composer_name || "—",
            broadcastDate: royalty.broadcast_date || null,
          };
        });

      setAllRoyalties(records);

      // Debug: Log precision information for first few records
      if (records.length > 0) {
        console.group('[Royalties Precision Debug] Data loaded');
        console.log(`Total records: ${records.length}`);
        console.log('Sample raw values from first 3 records:');
        records.slice(0, 3).forEach((r, i) => {
          console.log(`  Record ${i + 1}: gross="${r.gross}" (type: ${typeof r.gross}), net="${r.net}" (type: ${typeof r.net})`);
        });
        
        // Calculate and log totals using Big.js
        const totalGross = sumAmountsPrecise(records, 'gross', true);
        const totalNet = sumAmountsPrecise(records, 'net', true);
        console.log(`[Royalties Page] Total Gross (Big.js): €${totalGross.toFixed(2)}`);
        console.log(`[Royalties Page] Total Net (Big.js): €${totalNet.toFixed(2)}`);
        console.log('Compare these values with Admin Dashboard Total Revenue to verify precision match.');
        console.groupEnd();
      }

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
      perfTimer.current.endPageLoad();
      perfTimer.current.logSummary();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadAllRoyalties();
      fetchBalance();
      checkPendingRequest();
    }
  }, [user, loadAllRoyalties, fetchBalance, checkPendingRequest]);

  // Get quarter records (always call hooks before conditional returns)
  const getQuarterRecords = (): RoyaltyRecord[] => {
    if (!selectedQuarter) return [];
    const quarterKey = `${selectedQuarter.year}-Q${selectedQuarter.quarter}`;
    return quarterData.get(quarterKey) || [];
  };

  const allQuarterRecords = getQuarterRecords();
  const quarterRecords = allQuarterRecords.slice(0, displayLimit);
  const hasMoreRecords = allQuarterRecords.length > displayLimit;
  
  // Calculate analytics (must be called unconditionally before any early returns)
  const analytics = useMemo(() => {
    if (viewMode === "detail" && allQuarterRecords.length > 0) {
      return calculateAnalytics(allQuarterRecords, selectedQuarter);
    }
    // Return empty analytics when not in detail view
    return {
      topTracks: [],
      revenueBySource: [],
      revenueByTerritory: [],
      monthlyRevenue: [],
      quarterlyRevenue: [],
    };
  }, [allQuarterRecords, selectedQuarter, viewMode]);

  const handleQuarterClick = (quarter: Quarter) => {
    setSelectedQuarter(quarter);
    setViewMode("detail");
    setDisplayLimit(10); // Reset to 10 records when switching quarters
  };

  const handleBackToQuarters = () => {
    setViewMode("quarters");
    setSelectedQuarter(null);
  };

  // Get unique years for filter dropdown
  const availableYears = useMemo(() => {
    const years = new Set(quarters.map(q => q.year));
    return Array.from(years).sort((a, b) => b - a);
  }, [quarters]);

  // Filter quarters based on search and year
  const filteredQuarters = useMemo(() => {
    return quarters.filter(quarter => {
      const matchesYear = yearFilter === "all" || quarter.year.toString() === yearFilter;
      const matchesSearch = searchQuery === "" || 
        quarter.label.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesYear && matchesSearch;
    });
  }, [quarters, yearFilter, searchQuery]);

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
      r.gross.toString(),  // Keep full precision
      r.adminPercent.toString(),  // Keep full precision
      r.net.toString(),  // Keep full precision
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

  // Quarter List View - Enterprise Responsive Table
  if (viewMode === "quarters") {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Sticky Top Bar */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Royalty Statements</h1>
                <p className="text-sm text-gray-600 mt-1">Manage and review your quarterly royalty statements</p>
              </div>
              
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="text-right">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Available Balance</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-0.5 tabular-nums">€{balance.toFixed(2)}</p>
                </div>
                <Button
                  onClick={() => setConfirmOpen(true)}
                  disabled={!canRequest}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-medium px-5 py-2.5"
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Request Payment</span>
                  <span className="sm:hidden">Request</span>
                </Button>
              </div>
            </div>

            {hasPendingRequest && (
              <div className="mt-4">
                <div className="px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-yellow-900 font-medium">Payment request pending approval</p>
                </div>
              </div>
            )}
            {!canRequest && !hasPendingRequest && balance < minBalance && (
              <div className="mt-4">
                <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-900 font-medium">Minimum balance of €{minBalance} required for payment requests</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Filters */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search quarters..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
                />
              </div>
              
              <div className="relative sm:w-48">
                <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 appearance-none bg-white cursor-pointer transition-shadow"
                >
                  <option value="all">All Years</option>
                  {availableYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              <div className="flex items-center justify-center sm:justify-start text-sm px-4 py-2.5 bg-gray-50 rounded-lg border border-gray-200 whitespace-nowrap">
                <span className="font-semibold text-gray-900">{filteredQuarters.length}</span>
                <span className="ml-1.5 text-gray-600">{filteredQuarters.length === 1 ? 'statement' : 'statements'}</span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="flex flex-col items-center justify-center py-32">
                <div className="animate-spin rounded-full h-10 w-10 border-3 border-gray-200 border-t-emerald-600 mb-4"></div>
                <span className="text-sm text-gray-600 font-medium">Loading statements...</span>
              </div>
            </div>
          ) : filteredQuarters.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="text-center py-32">
                <FileText className="w-14 h-14 text-gray-300 mx-auto mb-4" />
                <p className="text-base text-gray-900 font-semibold">No statements found</p>
                <p className="text-sm text-gray-500 mt-2">Try adjusting your filters or search criteria</p>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* TABLE HEADER - ALWAYS AT TOP */}
                <div className="bg-gradient-to-b from-gray-100 to-gray-50 border-b-2 border-gray-300">
                  <div className="grid grid-cols-12 gap-6 px-6 py-4">
                    <div className="col-span-2 text-xs font-bold text-gray-800 uppercase tracking-wider">Quarter</div>
                    <div className="col-span-3 text-xs font-bold text-gray-800 uppercase tracking-wider">Date Range</div>
                    <div className="col-span-2 text-xs font-bold text-gray-800 uppercase tracking-wider text-right">Total Amount (€)</div>
                    <div className="col-span-2 text-xs font-bold text-gray-800 uppercase tracking-wider text-center">Records</div>
                    <div className="col-span-2 text-xs font-bold text-gray-800 uppercase tracking-wider text-center">Status</div>
                    <div className="col-span-1 text-xs font-bold text-gray-800 uppercase tracking-wider text-center">Actions</div>
                  </div>
                </div>

                {/* TABLE BODY */}
                <div className="bg-white">
                  {filteredQuarters.map((quarter, index) => {
                    const quarterKey = `${quarter.year}-Q${quarter.quarter}`;
                    const records = quarterData.get(quarterKey) || [];
                    const totalRecords = records.length;
                    const totalNet = sumAmountsPrecise(records, 'net');
                    const dateRange = formatDateRange(quarter.startDate, quarter.endDate);

                    return (
                      <div
                        key={quarterKey}
                        className={`grid grid-cols-12 gap-6 px-6 py-5 border-b border-gray-100 hover:bg-emerald-50/30 transition-all cursor-pointer ${
                          index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                        }`}
                        onClick={() => handleQuarterClick(quarter)}
                      >
                        <div className="col-span-2 flex items-center">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{quarter.label}</div>
                            <div className="text-xs text-gray-500 mt-0.5">FY {quarter.year}</div>
                          </div>
                        </div>

                        <div className="col-span-3 flex items-center">
                          <span className="text-sm text-gray-700">{dateRange}</span>
                        </div>

                        <div className="col-span-2 flex items-center justify-end">
                          <span className="text-sm font-bold text-gray-900 tabular-nums">€{totalNet.toFixed(2)}</span>
                        </div>

                        <div className="col-span-2 flex items-center justify-center">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                            {totalRecords}
                          </span>
                        </div>

                        <div className="col-span-2 flex items-center justify-center">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            Available
                          </span>
                        </div>

                        <div className="col-span-1 flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleQuarterClick(quarter)}
                            className="p-2 rounded-lg hover:bg-emerald-100 hover:shadow-sm transition-all group"
                            title="View Details"
                            aria-label="View quarter details"
                          >
                            <Eye className="w-4 h-4 text-gray-600 group-hover:text-emerald-700" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedQuarter(quarter);
                              setTimeout(handleExportCSV, 100);
                            }}
                            className="p-2 rounded-lg hover:bg-emerald-100 hover:shadow-sm transition-all group"
                            title="Download CSV"
                            aria-label="Download CSV report"
                          >
                            <Download className="w-4 h-4 text-gray-600 group-hover:text-emerald-700" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden space-y-4">
                {filteredQuarters.map((quarter) => {
                  const quarterKey = `${quarter.year}-Q${quarter.quarter}`;
                  const records = quarterData.get(quarterKey) || [];
                  const totalRecords = records.length;
                  const totalNet = sumAmountsPrecise(records, 'net');
                  const dateRange = formatDateRange(quarter.startDate, quarter.endDate);

                  return (
                    <div key={quarterKey} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-gray-100">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-base font-semibold text-gray-900">{quarter.label}</h3>
                            <p className="text-sm text-gray-500 mt-1">{dateRange}</p>
                          </div>
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 ml-3">
                            Available
                          </span>
                        </div>
                      </div>

                      <div className="px-5 py-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-600">Total Amount</span>
                          <span className="text-lg font-bold text-gray-900 tabular-nums">€{totalNet.toFixed(2)}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-600">Records</span>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            {totalRecords}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-600">Fiscal Year</span>
                          <span className="text-sm text-gray-900">{quarter.year}</span>
                        </div>
                      </div>

                      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
                        <button
                          onClick={() => handleQuarterClick(quarter)}
                          className="flex-1 inline-flex items-center justify-center px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </button>
                        <button
                          onClick={() => {
                            setSelectedQuarter(quarter);
                            setTimeout(handleExportCSV, 100);
                          }}
                          className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                          title="Download CSV"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Dialog */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Payment Request</DialogTitle>
              <DialogDescription>Are you sure you want to request payment?</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-gray-600 mb-4">This will withdraw your entire balance and reset it to €0.</p>
              <div className="bg-gray-50 p-4 rounded-md">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Amount to withdraw:</span>
                  <span className="text-lg font-bold text-emerald-600 tabular-nums">€{balance.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={requesting}>Cancel</Button>
              <Button onClick={handleRequestPayment} disabled={requesting} className="bg-emerald-600 hover:bg-emerald-700">
                {requesting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>) : ("Confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
                          €{r.gross.toString()}
                        </td>
                        <td className="px-3 md:px-4 py-3 text-[#222] whitespace-nowrap">{r.adminPercent.toString()}%</td>
                        <td className="px-3 md:px-4 py-3 text-right text-[#222] font-semibold whitespace-nowrap">
                          €{r.net.toString()}
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
          
          {/* Info and Load More */}
          {allQuarterRecords.length > 0 && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  Showing {Math.min(displayLimit, allQuarterRecords.length)} of {allQuarterRecords.length} records
                </span>
                {hasMoreRecords && (
                  <Button
                    onClick={() => setDisplayLimit(prev => prev + 10)}
                    variant="outline"
                    size="sm"
                  >
                    Load 10 More ({allQuarterRecords.length - displayLimit} remaining)
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

{/* Analytics Dashboard - Premium Green Theme */}
<div className="mt-10">
  <div className="border-t-2 border-gray-200 pt-8">
    <div className="mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Analytics Dashboard</h2>
      <div className="h-1 w-24 bg-gradient-to-r from-emerald-500 to-emerald-300 rounded-full"></div>
    </div>
    
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Top Performing Tracks - CENTERED */}
      <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 p-6 border border-gray-200">
        <div className="mb-5 pb-3 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Top Performing Tracks</h3>
          <p className="text-xs text-gray-500 mt-1">Revenue by track performance</p>
        </div>
        {analytics.topTracks.length > 0 ? (
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={analytics.topTracks}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={GREEN_PALETTE.grid} opacity={0.5} />
                <XAxis 
                  type="number" 
                  tick={{ fill: "#374151", fontSize: 12, fontWeight: 500 }}
                  tickFormatter={(value) => `€${value.toFixed(0)}`}
                />
                <YAxis
                  type="category"
                  dataKey="title"
                  width={150}
                  tick={{ fill: "#374151", fontSize: 11 }}
                  interval={0}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white border-2 border-emerald-200 rounded-xl shadow-xl p-4">
                          <p className="font-bold text-gray-900 mb-2">{data.title}</p>
                          <p className="text-sm text-emerald-700 font-semibold">
                            Revenue: €{toNumber(data.revenue).toFixed(2)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="revenue" radius={[0, 8, 8, 0]}>
                  {analytics.topTracks.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={index % 2 === 0 ? GREEN_PALETTE.primary : GREEN_PALETTE.secondary} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[320px] flex flex-col items-center justify-center text-gray-400">
            <div className="text-4xl mb-2">📊</div>
            <p className="text-sm">No data available</p>
          </div>
        )}
      </div>

      {/* Revenue by Source */}
      <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 p-6 border border-gray-200">
        <div className="mb-5 pb-3 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Revenue by Source</h3>
          <p className="text-xs text-gray-500 mt-1">Distribution across platforms</p>
        </div>
        {analytics.revenueBySource.length > 0 ? (
          <div className="flex flex-col lg:flex-row gap-6 items-center">
            {/* Pie Chart - Left Side */}
            <div className="w-full lg:w-1/2 flex justify-center">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics.revenueBySource}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={false}
                    outerRadius={90}
                    innerRadius={60}
                    dataKey="revenue"
                    stroke="#fff"
                    strokeWidth={2}
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
                          <div className="bg-white border-2 border-emerald-200 rounded-xl shadow-xl p-4">
                            <p className="font-bold text-gray-900 mb-1">{data.source}</p>
                            <p className="text-sm text-emerald-700 font-semibold">Revenue: €{toNumber(data.revenue).toFixed(2)}</p>
                            <p className="text-xs text-gray-600 mt-1">Share: {data.percentage.toFixed(1)}%</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend - Right Side */}
            <div className="w-full lg:w-1/2">
              <div className="flex flex-col gap-3">
                {analytics.revenueBySource.slice(0, 5).map((item, index) => {
                  return (
                    <div
                      key={item.source}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                        />
                        <span className="text-sm font-medium text-gray-700">
                          {item.source}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-semibold text-gray-900">
                          €{toNumber(item.revenue).toFixed(2)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {item.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* See More Button */}
              {analytics.revenueBySource.length > 5 && (
                <div className="flex justify-center mt-4">
                  <button
                    onClick={() => setShowAllSourcesModal(true)}
                    className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg font-medium hover:from-emerald-600 hover:to-teal-600 transition-all duration-300 shadow-md hover:shadow-lg"
                  >
                    See More ({analytics.revenueBySource.length - 5} more sources)
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-[320px] flex flex-col items-center justify-center text-gray-400">
            <div className="text-4xl mb-2">📊</div>
            <p className="text-sm">No data available</p>
          </div>
        )}
      </div>

      {/* Revenue by Territory */}
      <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 p-6 border border-gray-200">
        <div className="mb-5 pb-3 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Revenue by Territory</h3>
          <p className="text-xs text-gray-500 mt-1">Geographic revenue breakdown</p>
        </div>
        {analytics.revenueByTerritory.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={analytics.revenueByTerritory} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GREEN_PALETTE.grid} opacity={0.5} />
              <XAxis 
                dataKey="territory" 
                tick={{ fill: "#374151", fontSize: 11, fontWeight: 500 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis tick={{ fill: "#374151", fontSize: 12, fontWeight: 500 }} />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white border-2 border-emerald-200 rounded-xl shadow-xl p-4">
                        <p className="font-bold text-gray-900 mb-2">{data.territory}</p>
                        <p className="text-sm text-emerald-700 font-semibold">
                          Revenue: €{toNumber(data.revenue).toFixed(2)}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
                {analytics.revenueByTerritory.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index % 2 === 0 ? GREEN_PALETTE.dark : GREEN_PALETTE.primary} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[320px] flex flex-col items-center justify-center text-gray-400">
            <div className="text-4xl mb-2">🌍</div>
            <p className="text-sm">No data available</p>
          </div>
        )}
      </div>

      {/* Quarterly Revenue Trend - BAR CHART BY QUARTER */}
      <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 p-6 border border-gray-200">
        <div className="mb-5 pb-3 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Quarterly Revenue Trend</h3>
          <p className="text-xs text-gray-500 mt-1">Revenue progression by quarter</p>
        </div>
        {analytics.quarterlyRevenue.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={analytics.quarterlyRevenue} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GREEN_PALETTE.grid} opacity={0.5} />
              <XAxis 
                dataKey="quarter" 
                tick={{ fill: "#374151", fontSize: 12, fontWeight: 500 }} 
              />
              <YAxis 
                tick={{ fill: "#374151", fontSize: 12, fontWeight: 500 }}
                tickFormatter={(value) => `€${value.toFixed(0)}`}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white border-2 border-emerald-200 rounded-xl shadow-xl p-4">
                        <p className="font-bold text-gray-900 mb-2">{data.quarter}</p>
                        <p className="text-sm text-emerald-700 font-semibold">
                          Revenue: €{toNumber(data.revenue).toFixed(2)}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
                {analytics.quarterlyRevenue.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={[GREEN_PALETTE.primary, GREEN_PALETTE.secondary, GREEN_PALETTE.dark][index % 3]} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[320px] flex flex-col items-center justify-center text-gray-400">
            <div className="text-4xl mb-2">📈</div>
            <p className="text-sm">No data available</p>
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

      {/* Payment Request Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Payment Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to request payment?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600 mb-4">
              This will withdraw your entire balance and reset it to €0.
            </p>
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Amount to withdraw:</span>
                <span className="text-lg font-bold text-green-600">
                  €{balance.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={requesting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRequestPayment}
              disabled={requesting}
              className="bg-green-600 hover:bg-green-700"
            >
              {requesting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Confirm"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-teal-50">
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
                {analytics.revenueBySource.map((item, index) => {
                  return (
                    <div 
                      key={item.source}
                      className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-emerald-300 hover:shadow-md transition-all duration-200 bg-gradient-to-r from-white to-gray-50"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-700 font-bold text-sm">
                          {index + 1}
                        </div>
                        <div 
                          className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                        />
                        <span className="text-sm font-semibold text-gray-800">
                          {item.source}
                        </span>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-sm font-bold text-gray-900">
                            €{toNumber(item.revenue).toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {item.percentage.toFixed(1)}% of total
                          </div>
                        </div>
                        <div className="w-16">
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary Footer */}
              <div className="mt-6 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">Total Revenue</span>
                  <span className="text-lg font-bold text-emerald-700">
                    €{analytics.revenueBySource.reduce((sum, s) => sum + toNumber(s.revenue), 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-semibold text-gray-700">Total Sources</span>
                  <span className="text-lg font-bold text-teal-700">
                    {analytics.revenueBySource.length}
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