/**
 * Artist Royalties Page
 * /artist/royalties
 * 
 * Displays artist's royalties and allows requesting payment
 */

"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Loader2, DollarSign, AlertCircle, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface Royalty {
  id: string;
  track_title: string;
  platform: string;
  territory: string;
  usage_count: number;
  gross_amount: number;
  admin_percent: number;
  net_amount: number;
  broadcast_date: string;
  paid_status: string;
  created_at: string;
}

export default function ArtistRoyaltiesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [royalties, setRoyalties] = useState<Royalty[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [confirmRequestOpen, setConfirmRequestOpen] = useState(false);

  const [unpaidTotal, setUnpaidTotal] = useState(0);
  const [unpaidCount, setUnpaidCount] = useState(0);

  // Check authorization - redirect non-artists
  useEffect(() => {
    if (!authLoading && !user) {
      toast({
        title: "Access Denied",
        description: "Please login to access this page.",
        variant: "destructive",
      });
      router.push("/login");
    }
  }, [user, authLoading, router, toast]);

  useEffect(() => {
    if (user) {
      fetchRoyalties();
    }
  }, [user]);

  const fetchRoyalties = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("royalties")
        .select("*")
        .eq("artist_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setRoyalties(data || []);

      // Calculate unpaid totals
      const unpaid = (data || []).filter((r) => r.paid_status === "unpaid");
      const total = unpaid.reduce((sum, r) => sum + parseFloat(r.net_amount || "0"), 0);
      setUnpaidTotal(total);
      setUnpaidCount(unpaid.length);
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

  const handleRequestPayment = async () => {
    if (unpaidTotal <= 0) {
      toast({
        title: "No Unpaid Royalties",
        description: "You don't have any unpaid royalties to request payment for.",
        variant: "destructive",
      });
      return;
    }

    try {
      setRequesting(true);

      const response = await fetch("/api/payment/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to request payment");
      }

      toast({
        title: "Success",
        description: `Payment request submitted for $${data.paymentRequest.total_amount.toFixed(2)}`,
      });

      setConfirmRequestOpen(false);
      fetchRoyalties(); // Refresh to show updated status
    } catch (error) {
      console.error("Error requesting payment:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to request payment",
        variant: "destructive",
      });
    } finally {
      setRequesting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-8 h-8" />
              <h1 className="text-3xl font-bold">My Royalties</h1>
            </div>
            <p className="text-slate-600">View your royalty earnings and request payments</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total Royalties</p>
                <p className="text-2xl font-bold">{royalties.length}</p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Unpaid Amount</p>
                <p className="text-2xl font-bold text-orange-600">
                  ${unpaidTotal.toFixed(2)}
                </p>
                <p className="text-xs text-slate-500 mt-1">{unpaidCount} royalties</p>
              </div>
              <div className="bg-orange-100 rounded-full p-3">
                <AlertCircle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Paid Amount</p>
                <p className="text-2xl font-bold text-green-600">
                  $
                  {royalties
                    .filter((r) => r.paid_status === "paid")
                    .reduce((sum, r) => sum + parseFloat(r.net_amount || "0"), 0)
                    .toFixed(2)}
                </p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Request Payment Button */}
        {unpaidCount > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-6 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg mb-1">Ready to request payment?</h3>
                <p className="text-sm text-slate-600">
                  You have ${unpaidTotal.toFixed(2)} in unpaid royalties ({unpaidCount}{" "}
                  items)
                </p>
              </div>
              <Button
                onClick={() => setConfirmRequestOpen(true)}
                size="lg"
                className="gap-2"
              >
                <DollarSign className="w-5 h-5" />
                Request Payment
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Royalties Table */}
      <div className="bg-white rounded-lg shadow-md border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold">Royalty Details</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : royalties.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No royalties found. Check back later for updates.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Track Title</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Territory</TableHead>
                  <TableHead className="text-right">Usage</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Admin %</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {royalties.map((royalty) => (
                  <TableRow key={royalty.id}>
                    <TableCell className="font-medium">
                      {royalty.track_title || "—"}
                    </TableCell>
                    <TableCell>{royalty.platform || "—"}</TableCell>
                    <TableCell>{royalty.territory || "—"}</TableCell>
                    <TableCell className="text-right">
                      {royalty.usage_count || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      ${parseFloat(royalty.gross_amount || "0").toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {parseFloat(royalty.admin_percent || "0").toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      ${parseFloat(royalty.net_amount || "0").toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          royalty.paid_status === "paid"
                            ? "bg-green-100 text-green-800"
                            : royalty.paid_status === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        {royalty.paid_status || "unpaid"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {royalty.broadcast_date
                        ? new Date(royalty.broadcast_date).toLocaleDateString()
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Confirm Payment Request Modal */}
      <ConfirmModal
        open={confirmRequestOpen}
        onOpenChange={setConfirmRequestOpen}
        onConfirm={handleRequestPayment}
        title="Request Payment"
        description={`Are you sure you want to request payment for $${unpaidTotal.toFixed(
          2
        )}? This will include ${unpaidCount} unpaid royalt${
          unpaidCount === 1 ? "y" : "ies"
        }.`}
        confirmText="Request Payment"
        loading={requesting}
      />
    </div>
  );
}



