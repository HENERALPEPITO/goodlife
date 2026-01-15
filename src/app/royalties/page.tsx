"use client";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { createClientTimer } from "@/lib/performanceLogger";
import { ArrowLeft, Download, DollarSign, Loader2, AlertCircle, Eye, FileText, Search, Filter, ChevronDown, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { useArtistQuarters, useQuarterSummary } from "@/hooks/useRoyaltiesSummary";
import type { QuarterSummary, ArtistRoyaltiesSummaryResponse } from "@/types/royalty-summary";
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
} from "recharts";

// Selected quarter for detail view
interface SelectedQuarterInfo {
  year: number;
  quarter: number;
  label: string;
  startDate: Date;
  endDate: Date;
  total_net: number;
  total_tracks: number;
  total_streams: number;
  storage_path?: string;
}

type ViewMode = "quarters" | "detail";

// Utility function to get quarter label
function getQuarterLabel(year: number, quarter: number): string {
  return `${year} Quarter ${quarter}`;
}

// Utility function to get quarter date range
function getQuarterDateRange(year: number, quarter: number): { startDate: Date; endDate: Date } {
  const startMonth = (quarter - 1) * 3;
  const startDate = new Date(year, startMonth, 1);
  const endDate = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
  return { startDate, endDate };
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

// Helper to convert string | number to number safely
function toNumber(value: string | number): number {
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  }
  return value;
}

// Unified Green Color Palette for Analytics
const GREEN_PALETTE = {
  primary: "#1ABC9C",
  secondary: "#48C9B0",
  dark: "#16A085",
  light: "#7DCEA0",
  lighter: "#A9DFBF",
  lightest: "#D5F4E6",
  neutral: "#F8F9FA",
  grid: "#E5E7EB",
};

// Green gradient for pie/donut charts
const PIE_COLORS = [
  GREEN_PALETTE.primary,
  GREEN_PALETTE.secondary,
  GREEN_PALETTE.light,
  GREEN_PALETTE.lighter,
  GREEN_PALETTE.dark,
  GREEN_PALETTE.lightest,
];

export default function RoyaltiesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("quarters");
  const [selectedQuarter, setSelectedQuarter] = useState<SelectedQuarterInfo | null>(null);
  
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

  // Performance timer
  const perfTimer = useRef(createClientTimer("RoyaltiesPage"));

  // Fetch quarters from royalties_summary via hook
  const { quarters: quartersData, loading: quartersLoading, error: quartersError } = useArtistQuarters();

  // Fetch quarter detail when a quarter is selected
  const { 
    summary: quarterSummary, 
    analytics, 
    loading: summaryLoading 
  } = useQuarterSummary(
    undefined, // artistId is resolved in the hook
    selectedQuarter?.year,
    selectedQuarter?.quarter
  );

  // Redirect admins - only artists can view royalties
  useEffect(() => {
    if (user && user.role === "admin") {
      router.push("/admin/users");
    }
  }, [user, router]);

  // Payment Request Functions
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
      const balanceRes = await fetch(`/api/data/balance?user_id=${user.id}`, { cache: "no-store" });
      const balanceJson = await balanceRes.json();
      
      if (!balanceJson.artistId) {
        throw new Error("Artist record not found");
      }

      const response = await fetch("/api/payment/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artist_id: balanceJson.artistId }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to create payment request");
      }

      toast({
        title: "Payment Request Created",
        description: "Your payment request has been submitted successfully.",
      });

      await fetchBalance();
      await checkPendingRequest();
      setConfirmOpen(false);
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

  useEffect(() => {
    if (user) {
      fetchBalance();
      checkPendingRequest();
    }
  }, [user, fetchBalance, checkPendingRequest]);

  const canRequest = balance >= 100 && !hasPendingRequest;
  const minBalance = 100;

  // Transform quarters data for display
  const quarters = useMemo(() => {
    return (quartersData || []).map((q: QuarterSummary & { storage_path?: string }) => {
      const { startDate, endDate } = getQuarterDateRange(q.year, q.quarter);
      return {
        year: q.year,
        quarter: q.quarter,
        label: q.label || getQuarterLabel(q.year, q.quarter),
        startDate,
        endDate,
        total_net: q.total_net || 0,
        total_tracks: q.total_tracks || 0,
        total_streams: q.total_streams || 0,
        storage_path: q.storage_path,
      };
    }).sort((a: SelectedQuarterInfo, b: SelectedQuarterInfo) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.quarter - a.quarter;
    });
  }, [quartersData]);

  // Get unique years for filter dropdown
  const availableYears = useMemo(() => {
    const years = new Set(quarters.map((q: SelectedQuarterInfo) => q.year));
    return Array.from(years).sort((a, b) => (b as number) - (a as number)) as number[];
  }, [quarters]);

  // Filter quarters based on search and year
  const filteredQuarters = useMemo(() => {
    return quarters.filter((quarter: SelectedQuarterInfo) => {
      const matchesYear = yearFilter === "all" || quarter.year.toString() === yearFilter;
      const matchesSearch = searchQuery === "" || 
        quarter.label.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesYear && matchesSearch;
    });
  }, [quarters, yearFilter, searchQuery]);

  // Quarter summary records for detail view
  const allQuarterRecords = quarterSummary || [];
  const quarterRecords = allQuarterRecords.slice(0, displayLimit);
  const hasMoreRecords = allQuarterRecords.length > displayLimit;

  const handleQuarterClick = (quarter: SelectedQuarterInfo) => {
    setSelectedQuarter(quarter);
    setViewMode("detail");
    setDisplayLimit(10);
  };

  const handleBackToQuarters = () => {
    setViewMode("quarters");
    setSelectedQuarter(null);
  };

  // Download original CSV from storage
  const handleDownloadCSV = async (storagePath?: string) => {
    if (!storagePath) {
      toast({
        title: "Download unavailable",
        description: "Original CSV file is not available for this quarter.",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await fetch(`/api/data/royalties-summary?action=download&path=${encodeURIComponent(storagePath)}`);
      const json = await res.json();
      
      if (json.error) {
        throw new Error(json.error);
      }
      
      if (json.url) {
        window.open(json.url, '_blank');
      }
    } catch (error: any) {
      toast({
        title: "Download failed",
        description: error?.message || "Failed to download CSV file.",
        variant: "destructive",
      });
    }
  };

  // Export current quarter data as CSV
  const handleExportCSV = () => {
    if (!selectedQuarter || allQuarterRecords.length === 0) return;

    const headers = [
      "Track Title",
      "Total Streams",
      "Total Revenue",
      "Total Net",
      "Total Gross",
      "Avg Per Stream",
      "Top Platform",
      "Top Territory",
    ];

    const rows = allQuarterRecords.map((r: ArtistRoyaltiesSummaryResponse) => [
      r.track_title,
      r.total_streams.toString(),
      r.total_revenue.toFixed(2),
      r.total_net.toFixed(2),
      r.total_gross.toFixed(2),
      r.avg_per_stream.toFixed(6),
      r.top_platform || "N/A",
      r.top_territory || "N/A",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const quarterLabel = selectedQuarter.label.replace(/\s+/g, "-");
    a.download = `royalties-summary-${quarterLabel}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Quarter List View
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
                  <p className="text-2xl font-bold text-emerald-600 mt-0.5 tabular-nums">${balance.toFixed(2)}</p>
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
                  <p className="text-sm text-blue-900 font-medium">Minimum balance of ${minBalance} required for payment requests</p>
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

          {quartersLoading ? (
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
                <div className="bg-gradient-to-b from-gray-100 to-gray-50 border-b-2 border-gray-300">
                  <div className="grid grid-cols-12 gap-6 px-6 py-4">
                    <div className="col-span-2 text-xs font-bold text-gray-800 uppercase tracking-wider">Quarter</div>
                    <div className="col-span-3 text-xs font-bold text-gray-800 uppercase tracking-wider">Date Range</div>
                    <div className="col-span-2 text-xs font-bold text-gray-800 uppercase tracking-wider text-right">Total Net ($)</div>
                    <div className="col-span-2 text-xs font-bold text-gray-800 uppercase tracking-wider text-center">Tracks</div>
                    <div className="col-span-2 text-xs font-bold text-gray-800 uppercase tracking-wider text-center">Status</div>
                    <div className="col-span-1 text-xs font-bold text-gray-800 uppercase tracking-wider text-center">Actions</div>
                  </div>
                </div>

                <div className="bg-white">
                  {filteredQuarters.map((quarter: SelectedQuarterInfo, index: number) => {
                    const dateRange = formatDateRange(quarter.startDate, quarter.endDate);
                    return (
                      <div
                        key={`${quarter.year}-Q${quarter.quarter}`}
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
                          <span className="text-sm font-bold text-gray-900 tabular-nums">${quarter.total_net.toFixed(2)}</span>
                        </div>

                        <div className="col-span-2 flex items-center justify-center">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                            {quarter.total_tracks}
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
                          >
                            <Eye className="w-4 h-4 text-gray-600 group-hover:text-emerald-700" />
                          </button>
                          <button
                            onClick={() => handleDownloadCSV(quarter.storage_path)}
                            className="p-2 rounded-lg hover:bg-emerald-100 hover:shadow-sm transition-all group"
                            title="Download CSV"
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
                {filteredQuarters.map((quarter: SelectedQuarterInfo) => {
                  const dateRange = formatDateRange(quarter.startDate, quarter.endDate);
                  return (
                    <div key={`${quarter.year}-Q${quarter.quarter}`} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
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
                          <span className="text-sm font-medium text-gray-600">Total Net</span>
                          <span className="text-lg font-bold text-gray-900 tabular-nums">${quarter.total_net.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-600">Tracks</span>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            {quarter.total_tracks}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-600">Total Streams</span>
                          <span className="text-sm text-gray-900">{quarter.total_streams.toLocaleString()}</span>
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
                          onClick={() => handleDownloadCSV(quarter.storage_path)}
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

        {/* Payment Request Dialog */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Payment Request</DialogTitle>
              <DialogDescription>Are you sure you want to request payment?</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-gray-600 mb-4">This will withdraw your entire balance and reset it to $0.</p>
              <div className="bg-gray-50 p-4 rounded-md">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Amount to withdraw:</span>
                  <span className="text-lg font-bold text-emerald-600 tabular-nums">${balance.toFixed(2)}</span>
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
                <span>Export Summary CSV</span>
              </button>
            )}
          </div>
          <h1 className="text-2xl font-semibold text-gray-800 mb-2">
            Royalties — {selectedQuarter?.label || ""}
          </h1>
          <p className="text-sm text-gray-600">Detailed breakdown and analytics for this quarter.</p>
        </div>

        {/* Loading State */}
        {summaryLoading ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex flex-col items-center justify-center py-32">
              <div className="animate-spin rounded-full h-10 w-10 border-3 border-gray-200 border-t-emerald-600 mb-4"></div>
              <span className="text-sm text-gray-600 font-medium">Loading quarter details...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Summary Table - Track Level */}
            <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[800px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-[#E5E7EB]">
                      <th className="px-3 md:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                        Track Title
                      </th>
                      <th className="px-3 md:px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                        Streams
                      </th>
                      <th className="px-3 md:px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                        Gross ($)
                      </th>
                      <th className="px-3 md:px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                        Net ($)
                      </th>
                      <th className="px-3 md:px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                        Avg/Stream
                      </th>
                      <th className="px-3 md:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                        Top Platform
                      </th>
                      <th className="px-3 md:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                        Top Territory
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-[#E5E7EB]">
                    {quarterRecords.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-gray-600" colSpan={7}>
                          No royalties found for this quarter
                        </td>
                      </tr>
                    ) : (
                      quarterRecords.map((r: ArtistRoyaltiesSummaryResponse, index: number) => (
                        <tr
                          key={r.track_id}
                          className={`transition-colors duration-150 ${
                            index % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"
                          } hover:bg-gray-50`}
                        >
                          <td className="px-3 md:px-4 py-3 text-[#222] whitespace-nowrap font-medium">{r.track_title}</td>
                          <td className="px-3 md:px-4 py-3 text-right text-[#222] whitespace-nowrap tabular-nums">
                            {r.total_streams.toLocaleString()}
                          </td>
                          <td className="px-3 md:px-4 py-3 text-right text-[#222] whitespace-nowrap tabular-nums">
                            ${toNumber(r.total_gross).toFixed(2)}
                          </td>
                          <td className="px-3 md:px-4 py-3 text-right text-[#222] font-semibold whitespace-nowrap tabular-nums">
                            ${toNumber(r.total_net).toFixed(2)}
                          </td>
                          <td className="px-3 md:px-4 py-3 text-right text-[#222] whitespace-nowrap tabular-nums">
                            ${toNumber(r.avg_per_stream).toFixed(6)}
                          </td>
                          <td className="px-3 md:px-4 py-3 text-[#222] whitespace-nowrap">{r.top_platform || "—"}</td>
                          <td className="px-3 md:px-4 py-3 text-[#222] whitespace-nowrap">{r.top_territory || "—"}</td>
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
                      Showing {Math.min(displayLimit, allQuarterRecords.length)} of {allQuarterRecords.length} tracks
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

            {/* Analytics Dashboard */}
            <div className="mt-10">
              <div className="border-t-2 border-gray-200 pt-8">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Analytics Dashboard</h2>
                  <div className="h-1 w-24 bg-gradient-to-r from-emerald-500 to-emerald-300 rounded-full"></div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Top Performing Tracks */}
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
                              tickFormatter={(value) => `$${value.toFixed(0)}`}
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
                                        Revenue: ${toNumber(data.revenue).toFixed(2)}
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
                                        <p className="text-sm text-emerald-700 font-semibold">Revenue: ${toNumber(data.revenue).toFixed(2)}</p>
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

                        <div className="w-full lg:w-1/2">
                          <div className="flex flex-col gap-3">
                            {analytics.revenueBySource.slice(0, 5).map((item, index) => (
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
                                    ${toNumber(item.revenue).toFixed(2)}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {item.percentage.toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                          
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
                                      Revenue: ${toNumber(data.revenue).toFixed(2)}
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

                  {/* Quarter Revenue */}
                  <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 p-6 border border-gray-200">
                    <div className="mb-5 pb-3 border-b border-gray-100">
                      <h3 className="text-lg font-bold text-gray-900">Quarter Revenue</h3>
                      <p className="text-xs text-gray-500 mt-1">Revenue breakdown by quarter</p>
                    </div>
                    {analytics.monthlyRevenue.length > 0 ? (
                      <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={analytics.monthlyRevenue} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={GREEN_PALETTE.grid} opacity={0.5} />
                          <XAxis 
                            dataKey="quarter" 
                            tick={{ fill: "#374151", fontSize: 12, fontWeight: 500 }} 
                          />
                          <YAxis 
                            tick={{ fill: "#374151", fontSize: 12, fontWeight: 500 }}
                            tickFormatter={(value) => `$${value.toFixed(0)}`}
                          />
                          <Tooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-white border-2 border-emerald-200 rounded-xl shadow-xl p-4">
                                    <p className="font-bold text-gray-900 mb-2">{selectedQuarter?.label}</p>
                                    <p className="text-sm text-emerald-700 font-semibold">
                                      Revenue: ${toNumber(data.revenue).toFixed(2)}
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
                            {analytics.monthlyRevenue.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={GREEN_PALETTE.primary} 
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
          </>
        )}
      </div>

      {/* Payment Request Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Payment Request</DialogTitle>
            <DialogDescription>Are you sure you want to request payment?</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600 mb-4">This will withdraw your entire balance and reset it to $0.</p>
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Amount to withdraw:</span>
                <span className="text-lg font-bold text-green-600">${balance.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={requesting}>Cancel</Button>
            <Button onClick={handleRequestPayment} disabled={requesting} className="bg-green-600 hover:bg-green-700">
              {requesting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>) : ("Confirm")}
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
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="space-y-3">
                {analytics.revenueBySource.map((item, index) => (
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
                          ${toNumber(item.revenue).toFixed(2)}
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
                ))}
              </div>

              {/* Summary Footer */}
              <div className="mt-6 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">Total Revenue</span>
                  <span className="text-xl font-bold text-emerald-700">
                    ${analytics.totalRevenue.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
