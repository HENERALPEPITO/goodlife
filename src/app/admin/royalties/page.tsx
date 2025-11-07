/**
 * Admin Royalties Management Page
 * /admin/royalties
 * 
 * Allows admins to:
 * - View all royalties with pagination
 * - Search and filter royalties
 * - Select multiple royalties for bulk deletion
 * - Edit individual royalty records
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import { MultiSelectToolbar } from "@/components/MultiSelectToolbar";
import {
  Loader2,
  Search,
  Filter,
  Trash2,
  Edit,
  ChevronLeft,
  ChevronRight,
  DollarSign,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { Royalty } from "@/types";

interface RoyaltyWithDetails extends Royalty {
  artist_email?: string;
  track_title?: string;
  platform?: string;
  territory?: string;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function AdminRoyaltiesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // Data state
  const [royalties, setRoyalties] = useState<RoyaltyWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Search and filters
  const [searchTerm, setSearchTerm] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [territoryFilter, setTerritoryFilter] = useState<string>("all");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [territories, setTerritories] = useState<string[]>([]);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Check authorization
  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      toast({
        title: "Access Denied",
        description: "You must be an admin to access this page.",
        variant: "destructive",
      });
      router.push("/");
    }
  }, [user, authLoading, router, toast]);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounced(searchTerm);
      setCurrentPage(1); // Reset to first page on search
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch filter options
  useEffect(() => {
    if (user?.role === "admin") {
      fetchFilterOptions();
    }
  }, [user]);

  // Fetch royalties when filters or pagination change
  useEffect(() => {
    if (user?.role === "admin") {
      fetchRoyalties();
    }
  }, [user, currentPage, pageSize, searchDebounced, platformFilter, territoryFilter]);

  const fetchFilterOptions = async () => {
    try {
      // Fetch unique platforms
      const { data: platformData } = await supabase
        .from("royalties")
        .select("platform")
        .not("platform", "is", null);

      if (platformData) {
        const uniquePlatforms = Array.from(
          new Set(platformData.map((r) => r.platform).filter(Boolean))
        ) as string[];
        setPlatforms(uniquePlatforms.sort());
      }

      // Fetch unique territories
      const { data: territoryData } = await supabase
        .from("royalties")
        .select("territory")
        .not("territory", "is", null);

      if (territoryData) {
        const uniqueTerritories = Array.from(
          new Set(territoryData.map((r) => r.territory).filter(Boolean))
        ) as string[];
        setTerritories(uniqueTerritories.sort());
      }
    } catch (error) {
      console.error("Error fetching filter options:", error);
    }
  };

  const fetchRoyalties = async () => {
    try {
      setLoading(true);

      // Build query
      let query = supabase.from("royalties").select("*", { count: "exact" });

      // Apply search
      if (searchDebounced) {
        query = query.or(
          `track_title.ilike.%${searchDebounced}%,artist_email.ilike.%${searchDebounced}%`
        );
      }

      // Apply filters
      if (platformFilter !== "all") {
        query = query.eq("platform", platformFilter);
      }
      if (territoryFilter !== "all") {
        query = query.eq("territory", territoryFilter);
      }

      // Apply pagination
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      // Order by created_at descending
      query = query.order("created_at", { ascending: false });

      const { data, error, count } = await query;

      if (error) throw error;

      setRoyalties(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error("Error fetching royalties:", error);
      toast({
        title: "Error",
        description: "Failed to load royalties",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        const allIds = new Set(royalties.map((r) => r.id));
        setSelectedIds(allIds);
      } else {
        setSelectedIds(new Set());
      }
    },
    [royalties]
  );

  const handleSelectOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  }, []);

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;

    try {
      setDeleting(true);

      const response = await fetch("/api/admin/delete-royalties", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to delete royalties");
      }

      toast({
        title: "Success",
        description: `Deleted ${data.count} royalt${data.count === 1 ? "y" : "ies"}`,
      });

      // Clear selection and refresh
      setSelectedIds(new Set());
      setDeleteConfirmOpen(false);
      fetchRoyalties();
    } catch (error) {
      console.error("Error deleting royalties:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete royalties",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSingle = async (id: string) => {
    try {
      const response = await fetch("/api/admin/delete-royalties", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids: [id],
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to delete royalty");
      }

      toast({
        title: "Success",
        description: "Royalty deleted successfully",
      });

      fetchRoyalties();
    } catch (error) {
      console.error("Error deleting royalty:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete royalty",
        variant: "destructive",
      });
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);
  const allSelected = royalties.length > 0 && selectedIds.size === royalties.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < royalties.length;

  if (authLoading || user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <DollarSign className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Royalties Management</h1>
        </div>
        <p className="text-slate-600">Search, filter, and manage all royalty records</p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <Label htmlFor="search" className="mb-2 block">
              Search
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                id="search"
                type="text"
                placeholder="Search by track title or artist email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Platform Filter */}
          <div>
            <Label htmlFor="platform-filter" className="mb-2 block">
              Platform
            </Label>
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger id="platform-filter">
                <SelectValue placeholder="All platforms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                {platforms.map((platform) => (
                  <SelectItem key={platform} value={platform}>
                    {platform}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Territory Filter */}
          <div>
            <Label htmlFor="territory-filter" className="mb-2 block">
              Territory
            </Label>
            <Select value={territoryFilter} onValueChange={setTerritoryFilter}>
              <SelectTrigger id="territory-filter">
                <SelectValue placeholder="All territories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Territories</SelectItem>
                {territories.map((territory) => (
                  <SelectItem key={territory} value={territory}>
                    {territory}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active Filters Display */}
        {(searchDebounced || platformFilter !== "all" || territoryFilter !== "all") && (
          <div className="mt-4 flex items-center gap-2 text-sm">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-slate-500">Active filters:</span>
            {searchDebounced && (
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                Search: "{searchDebounced}"
              </span>
            )}
            {platformFilter !== "all" && (
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                Platform: {platformFilter}
              </span>
            )}
            {territoryFilter !== "all" && (
              <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                Territory: {territoryFilter}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setPlatformFilter("all");
                setTerritoryFilter("all");
              }}
            >
              Clear all
            </Button>
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow-md border border-slate-200">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            Royalties ({totalCount} total)
          </h2>
          <div className="flex items-center gap-2">
            <Label htmlFor="page-size" className="text-sm">
              Show:
            </Label>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => {
                setPageSize(parseInt(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger id="page-size" className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : royalties.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No royalties found. Try adjusting your filters.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all"
                        ref={(el) => {
                          if (el) {
                            (el as any).indeterminate = someSelected;
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Track Title</TableHead>
                    <TableHead>Artist Email</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Territory</TableHead>
                    <TableHead className="text-right">Usage</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead>Broadcast Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {royalties.map((royalty) => (
                    <TableRow
                      key={royalty.id}
                      data-state={selectedIds.has(royalty.id) ? "selected" : undefined}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(royalty.id)}
                          onCheckedChange={(checked) =>
                            handleSelectOne(royalty.id, checked as boolean)
                          }
                          aria-label={`Select royalty ${royalty.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {royalty.track_title || "—"}
                      </TableCell>
                      <TableCell>{royalty.artist_email || "—"}</TableCell>
                      <TableCell>{royalty.platform || "—"}</TableCell>
                      <TableCell>{royalty.territory || "—"}</TableCell>
                      <TableCell className="text-right">
                        {royalty.usage_count || 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {royalty.gross_amount
                          ? `$${Number(royalty.gross_amount).toFixed(2)}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {royalty.net_amount
                          ? `$${Number(royalty.net_amount).toFixed(2)}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {royalty.broadcast_date
                          ? new Date(royalty.broadcast_date).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSingle(royalty.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="p-6 border-t border-slate-200 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Showing {(currentPage - 1) * pageSize + 1} to{" "}
                {Math.min(currentPage * pageSize, totalCount)} of {totalCount} results
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <div className="text-sm">
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Multi-Select Toolbar */}
      <MultiSelectToolbar
        selectedCount={selectedIds.size}
        onDelete={() => setDeleteConfirmOpen(true)}
        onClearSelection={() => setSelectedIds(new Set())}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={handleDeleteSelected}
        title="Delete Royalties"
        description={`Are you sure you want to delete ${selectedIds.size} royalt${
          selectedIds.size === 1 ? "y" : "ies"
        }? This action cannot be undone.`}
        confirmText="Delete"
        isDestructive
        loading={deleting}
      />
    </div>
  );
}











