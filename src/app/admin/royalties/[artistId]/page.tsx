"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui/use-toast";
import { EditableRoyaltyTable } from "@/components/royalties/EditableRoyaltyTable";
import { CsvExportDropdown } from "@/components/royalties/CsvExportDropdown";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader, AlertCircle, Trash2, ChevronDown, ChevronRight, Download } from "lucide-react";
import type { Royalty } from "@/types";
import { supabase } from "@/lib/supabaseClient";
import Big from "big.js";

// Helper to safely create a Big value from string or number
function toBig(value: string | number | null | undefined): Big {
  try {
    const strValue = String(value ?? 0).trim();
    if (strValue === '' || strValue === 'null' || strValue === 'undefined') {
      return new Big(0);
    }
    return new Big(strValue);
  } catch (e) {
    return new Big(0);
  }
}

interface QuarterGroup {
  quarter: string;
  year: number;
  royalties: Royalty[];
  totalNet: string;
  totalGross: string;
  displayedRoyalties?: Royalty[];
}

export default function ArtistRoyaltiesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  
  const artistId = params.artistId as string;
  const [royalties, setRoyalties] = useState<Royalty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [expandedQuarters, setExpandedQuarters] = useState<Set<string>>(new Set());
  const [deleteQuarterConfirm, setDeleteQuarterConfirm] = useState<string | null>(null);
  const [displayLimit, setDisplayLimit] = useState(10);

  // Group royalties by quarter using Big.js for precision
  const groupByQuarter = (royalties: Royalty[]): QuarterGroup[] => {
    const groups = new Map<string, QuarterGroup & { totalNetBig: Big; totalGrossBig: Big }>();

    royalties.forEach((royalty) => {
      if (!royalty.broadcast_date) return;

      const date = new Date(royalty.broadcast_date);
      const year = date.getFullYear();
      const month = date.getMonth();
      const quarter = Math.floor(month / 3) + 1;
      const key = `${year}-Q${quarter}`;

      if (!groups.has(key)) {
        groups.set(key, {
          quarter: `Q${quarter}`,
          year,
          royalties: [],
          totalNet: "0",
          totalGross: "0",
          totalNetBig: new Big(0),
          totalGrossBig: new Big(0),
        });
      }

      const group = groups.get(key)!;
      group.royalties.push(royalty);
      // Use Big.js for precise summation
      group.totalNetBig = group.totalNetBig.plus(toBig(royalty.net_amount));
      group.totalGrossBig = group.totalGrossBig.plus(toBig(royalty.gross_amount));
    });

    // Convert Big to string and sort by year and quarter (most recent first)
    return Array.from(groups.values())
      .map(group => ({
        quarter: group.quarter,
        year: group.year,
        royalties: group.royalties,
        totalNet: group.totalNetBig.toFixed(2),
        totalGross: group.totalGrossBig.toFixed(2),
      }))
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return parseInt(b.quarter.substring(1)) - parseInt(a.quarter.substring(1));
      });
  };

  // Group ALL royalties by quarter (for correct totals)
  const allQuarterGroups = groupByQuarter(royalties);
  
  // Limit which royalties to display (first N records globally)
  let displayedCount = 0;
  const quarterGroups = allQuarterGroups.map(group => {
    const remainingToDisplay = displayLimit - displayedCount;
    const royaltiesToShow = group.royalties.slice(0, remainingToDisplay);
    displayedCount += royaltiesToShow.length;
    
    return {
      ...group,
      // Keep original totals (from all records in quarter)
      // But limit displayed royalties
      displayedRoyalties: royaltiesToShow
    };
  }).filter(group => group.displayedRoyalties.length > 0);
  
  const hasMore = royalties.length > displayLimit;

  const toggleQuarter = (key: string) => {
    setExpandedQuarters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const exportQuarterToCSV = (quarterKey: string, royalties: Royalty[]) => {
    // CSV Headers
    const headers = [
      "Song Title",
      "ISWC",
      "Composer",
      "Date",
      "Territory",
      "Source",
      "Usage Count",
      "Gross",
      "Admin %",
      "Net"
    ];

    // Convert royalties to CSV rows
    const rows = royalties.map((royalty) => {
      const date = royalty.broadcast_date 
        ? new Date(royalty.broadcast_date).toLocaleDateString("en-US")
        : "";
      
      return [
        royalty.track_title || "",
        royalty.isrc || "",
        royalty.composer_name || "",
        date,
        royalty.territory || "",
        royalty.exploitation_source_name || "",
        royalty.usage_count?.toString() || "0",
        String(royalty.gross_amount || "0"),  // Exact precision
        String(royalty.admin_percent || "0"),  // Exact precision
        String(royalty.net_amount || "0")  // Exact precision
      ];
    });

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => 
        row.map((cell) => {
          // Escape cells that contain commas, quotes, or newlines
          if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        }).join(",")
      )
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `royalties-${quarterKey}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Success",
      description: `Exported ${royalties.length} record(s) from ${quarterKey}`,
    });
  };

  // Check authorization and fetch royalties
  useEffect(() => {
    if (loading) {
      // Still loading auth state
      return;
    }

    if (!user) {
      // No user at all
      router.push("/");
      return;
    }

    if (user.role !== "admin") {
      // Not an admin
      router.push("/");
      return;
    }

    // User is authenticated and is admin - fetch royalties
    fetchRoyalties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, artistId]);

  const fetchRoyalties = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Get the session token to send in Authorization header
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch(`/api/admin/royalties/${artistId}`, {
        headers,
        credentials: "include",
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          console.warn("Received 401 from API, checking session...");
          setError("Authentication expired. Please refresh the page.");
          return;
        }
        if (response.status === 403) {
          router.push("/");
          return;
        }
        throw new Error("Failed to fetch royalties");
      }

      const responseData = await response.json();
      
      // Handle both old format (array) and paginated format (object with data array)
      const data = Array.isArray(responseData) ? responseData : (responseData.data || []);
      
      // Debug: Log first royalty to verify data structure
      if (data && data.length > 0) {
        console.log("📊 Frontend received royalty data. Sample record:", {
          track_title: data[0].track_title,
          gross_amount: data[0].gross_amount,
          net_amount: data[0].net_amount,
          admin_percent: data[0].admin_percent,
          composer_name: data[0].composer_name,
          isrc: data[0].isrc,
          exploitation_source_name: data[0].exploitation_source_name,
          territory: data[0].territory,
        });
      }
      
      setRoyalties(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch royalties";
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateRoyalty = async (id: string, updates: Partial<Royalty>) => {
    try {
      setIsSaving(true);
      
      // Get the session token to send in Authorization header
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch(`/api/admin/royalties/record/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(updates),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to update royalty record");
      }

      const updated = await response.json();
      
      // Update local state
      setRoyalties((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updated } : r))
      );

      toast({
        title: "Success",
        description: "Royalty record updated",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update royalty record";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRoyalty = async (id: string) => {
    if (!confirm("Are you sure you want to delete this royalty record?")) {
      return;
    }

    try {
      setIsSaving(true);
      
      // Get the session token to send in Authorization header
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: HeadersInit = {};
      
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch(`/api/admin/royalties/record/${id}`, {
        method: "DELETE",
        headers,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete royalty record");
      }

      // Update local state
      setRoyalties((prev) => prev.filter((r) => r.id !== id));

      toast({
        title: "Success",
        description: "Royalty record deleted",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete royalty record";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteQuarter = async (quarterKey: string, royaltyIds: string[]) => {
    try {
      setIsSaving(true);
      
      // Get the session token to send in Authorization header
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: HeadersInit = {};
      
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      // Delete all royalties in the quarter one by one
      const deletePromises = royaltyIds.map((id) =>
        fetch(`/api/admin/royalties/record/${id}`, {
          method: "DELETE",
          headers,
          credentials: "include",
        })
      );

      const results = await Promise.all(deletePromises);
      
      // Check if all deletes were successful
      const failedDeletes = results.filter((r) => !r.ok);
      if (failedDeletes.length > 0) {
        throw new Error(`Failed to delete ${failedDeletes.length} record(s)`);
      }

      // Update local state to remove deleted royalties
      setRoyalties((prev) => prev.filter((r) => !royaltyIds.includes(r.id)));
      setDeleteQuarterConfirm(null);

      toast({
        title: "Success",
        description: `Deleted ${royaltyIds.length} record(s) from ${quarterKey}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete quarter records";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
      setDeleteQuarterConfirm(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm(
      "Are you sure you want to delete ALL royalty records for this artist? This action cannot be undone."
    )) {
      return;
    }

    try {
      setIsSaving(true);
      
      // Get the session token to send in Authorization header
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: HeadersInit = {};
      
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch(
        `/api/admin/royalties/delete-all/${artistId}`,
        {
          method: "DELETE",
          headers,
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete artist royalties");
      }

      // Clear the royalties
      setRoyalties([]);
      setShowDeleteAllConfirm(false);

      toast({
        title: "Success",
        description: "All royalty records deleted",
      });

      // Redirect back to list after a short delay
      setTimeout(() => {
        router.push("/admin/royalties");
      }, 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete artist royalties";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
      setShowDeleteAllConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with Back Button */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/royalties">
              <button className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Royalty Records
              </h1>
              <p className="text-slate-600 mt-1">
                Artist ID: {artistId}
              </p>
            </div>
          </div>
          {/* Export Original CSV Button */}
          <CsvExportDropdown artistId={artistId} />
        </div>

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-start gap-4 mb-8">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">{error}</h3>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-6 h-6 animate-spin text-slate-600" />
          </div>
        )}

        {/* Content */}
        {!isLoading && (
          <>
            {/* Info Bar */}
            <div className="mb-6 flex items-center justify-between gap-4">
              <div className="flex-1 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  Showing first <strong>{Math.min(displayLimit, royalties.length)}</strong> of <strong>{royalties.length}</strong> royalty {royalties.length === 1 ? "record" : "records"} organized into{" "}
                  <strong>{allQuarterGroups.length}</strong> {allQuarterGroups.length === 1 ? "quarter" : "quarters"}.
                  <strong>Quarter totals show all records</strong>, but only displaying first {displayLimit}. Click any quarter to expand.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setExpandedQuarters(new Set(quarterGroups.map(g => `${g.year}-${g.quarter}`)))}
                  variant="outline"
                  size="sm"
                  className="whitespace-nowrap"
                >
                  Expand All
                </Button>
                <Button
                  onClick={() => setExpandedQuarters(new Set())}
                  variant="outline"
                  size="sm"
                  className="whitespace-nowrap"
                >
                  Collapse All
                </Button>
              </div>
            </div>

            {/* Quarterly Groups or Empty State */}
            {royalties.length > 0 ? (
              <>
                <div className="space-y-6">
                  {quarterGroups.map((group) => {
                    const key = `${group.year}-${group.quarter}`;
                    const isExpanded = expandedQuarters.has(key);

                    return (
                      <div
                        key={key}
                        className="bg-white border border-slate-200 rounded-lg overflow-hidden"
                      >
                        {/* Quarter Header */}
                        <div className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                          <button
                            onClick={() => toggleQuarter(key)}
                            className="flex items-center gap-3 flex-1"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-slate-600" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-slate-600" />
                            )}
                            <div className="text-left">
                              <h3 className="text-lg font-semibold text-slate-900">
                                {group.quarter} {group.year}
                              </h3>
                              <p className="text-sm text-slate-600">
                                {group.royalties.length} {group.royalties.length === 1 ? "record" : "records"}
                                {group.displayedRoyalties && group.displayedRoyalties.length < group.royalties.length && (
                                  <span className="text-blue-600"> (showing {group.displayedRoyalties.length})</span>
                                )}
                              </p>
                            </div>
                          </button>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm text-slate-600">Gross</p>
                              <p className="text-lg font-semibold text-slate-900">
                                ${parseFloat(group.totalGross).toFixed(2)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-slate-600">Net</p>
                              <p className="text-lg font-semibold text-green-600">
                                ${parseFloat(group.totalNet).toFixed(2)}
                              </p>
                            </div>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Export ALL royalties in this quarter, not just displayed ones
                                const fullGroup = allQuarterGroups.find(g => `${g.year}-${g.quarter}` === key);
                                if (fullGroup) {
                                  exportQuarterToCSV(key, fullGroup.royalties);
                                }
                              }}
                              variant="ghost"
                              size="sm"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              title="Export to CSV"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteQuarterConfirm(key);
                              }}
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Delete quarter"
                              disabled={isSaving}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Delete Quarter Confirmation */}
                        {deleteQuarterConfirm === key && (
                          <div className="px-6 py-3 bg-red-50 border-t border-red-200 flex items-center justify-between">
                            <p className="text-sm font-medium text-red-900">
                              Delete all {group.royalties.length} record(s) from {group.quarter} {group.year}?
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  // Delete ALL royalties in this quarter
                                  const fullGroup = allQuarterGroups.find(g => `${g.year}-${g.quarter}` === key);
                                  if (fullGroup) {
                                    handleDeleteQuarter(key, fullGroup.royalties.map(r => r.id));
                                  }
                                }}
                                disabled={isSaving}
                                className="px-3 py-1.5 bg-red-600 text-white text-sm rounded font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                              >
                                {isSaving ? "Deleting..." : "Delete"}
                              </button>
                              <button
                                onClick={() => setDeleteQuarterConfirm(null)}
                                disabled={isSaving}
                                className="px-3 py-1.5 bg-slate-200 text-slate-900 text-sm rounded font-medium hover:bg-slate-300 disabled:opacity-50 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Quarter Content */}
                        {isExpanded && (
                          <div className="border-t border-slate-200">
                            <EditableRoyaltyTable
                              royalties={group.displayedRoyalties || group.royalties}
                              onUpdate={handleUpdateRoyalty}
                              onDelete={handleDeleteRoyalty}
                              isLoading={isSaving}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Load More Button */}
                {hasMore && (
                  <div className="mt-6 flex justify-center">
                    <Button
                      onClick={() => setDisplayLimit(prev => prev + 10)}
                      variant="outline"
                      className="px-6"
                    >
                      Load 10 More ({royalties.length - displayLimit} remaining)
                    </Button>
                  </div>
                )}

                {/* Delete All Button */}
                <div className="mt-8 flex justify-end">
                  {showDeleteAllConfirm ? (
                    <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                      <p className="text-sm font-medium text-red-900">
                        Delete all records? This cannot be undone.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleDeleteAll}
                          disabled={isSaving}
                          className="px-4 py-2 bg-red-600 text-white rounded font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          {isSaving ? "Deleting..." : "Yes, Delete All"}
                        </button>
                        <button
                          onClick={() => setShowDeleteAllConfirm(false)}
                          disabled={isSaving}
                          className="px-4 py-2 bg-slate-200 text-slate-900 rounded font-medium hover:bg-slate-300 disabled:opacity-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={() => setShowDeleteAllConfirm(true)}
                      variant="destructive"
                      className="flex items-center gap-2"
                      disabled={isSaving}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete All Records
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-white border-2 border-dashed border-slate-300 rounded-lg p-12 text-center">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  No Royalty Records
                </h3>
                <p className="text-slate-600">
                  This artist has no royalty records yet
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}