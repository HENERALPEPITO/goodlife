/**
 * Artist Payments Page
 * /artist/payments
 * 
 * Displays artist's payment requests and allows viewing receipts
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
import { ReceiptModal } from "@/components/ReceiptModal";
import { Loader2, FileText, Eye } from "lucide-react";
import { useRouter } from "next/navigation";

interface PaymentRequest {
  id: string;
  total_amount: number | null | undefined;
  status: string;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
}

export default function ArtistPaymentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  // Check authorization
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
      fetchPaymentRequests();
    }
  }, [user]);

  const fetchPaymentRequests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("payment_requests")
        .select("*")
        .eq("artist_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setPaymentRequests(data || []);
    } catch (error) {
      console.error("Error fetching payment requests:", error);
      toast({
        title: "Error",
        description: "Failed to load payment requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewReceipt = (requestId: string) => {
    setSelectedRequestId(requestId);
    setReceiptModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      paid: "bg-blue-100 text-blue-800",
      rejected: "bg-red-100 text-red-800",
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          statusClasses[status as keyof typeof statusClasses] || "bg-slate-100 text-slate-800"
        }`}
      >
        {status.toUpperCase()}
      </span>
    );
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
        <div className="flex items-center gap-3 mb-2">
          <FileText className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Payment Requests</h1>
        </div>
        <p className="text-slate-600">View your payment request history and receipts</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-6 border border-slate-200">
          <p className="text-sm text-slate-600 mb-1">Total Requests</p>
          <p className="text-2xl font-bold">{paymentRequests.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 border border-yellow-200 bg-yellow-50">
          <p className="text-sm text-slate-600 mb-1">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">
            {paymentRequests.filter((r) => r.status === "pending").length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 border border-green-200 bg-green-50">
          <p className="text-sm text-slate-600 mb-1">Approved/Paid</p>
          <p className="text-2xl font-bold text-green-600">
            {
              paymentRequests.filter(
                (r) => r.status === "approved" || r.status === "paid"
              ).length
            }
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 border border-red-200 bg-red-50">
          <p className="text-sm text-slate-600 mb-1">Rejected</p>
          <p className="text-2xl font-bold text-red-600">
            {paymentRequests.filter((r) => r.status === "rejected").length}
          </p>
        </div>
      </div>

      {/* Payment Requests Table */}
      <div className="bg-white rounded-lg shadow-md border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold">Payment History</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : paymentRequests.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-slate-400" />
            <p>No payment requests yet.</p>
            <p className="text-sm mt-2">
              Go to{" "}
              <a href="/artist/royalties" className="text-blue-600 hover:underline">
                Royalties
              </a>{" "}
              to request your first payment.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approved Date</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      {new Date(request.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      €{(parseFloat(request.total_amount?.toString() || "0") || 0).toFixed(2)}
                    </TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>
                      {request.approved_at
                        ? new Date(request.approved_at).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {request.remarks || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewReceipt(request.id)}
                        className="gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        View Receipt
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Receipt Modal */}
      <ReceiptModal
        open={receiptModalOpen}
        onOpenChange={setReceiptModalOpen}
        paymentRequestId={selectedRequestId}
      />
    </div>
  );
}




