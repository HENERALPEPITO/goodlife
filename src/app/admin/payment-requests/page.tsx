/**
 * Admin Payment Requests Page
 * /admin/payment-requests
 * 
 * Allows admins to view and manage all payment requests
 */

"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ReceiptModal } from "@/components/ReceiptModal";
import {
  Loader2,
  FileText,
  CheckCircle2,
  XCircle,
  Eye,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface PaymentRequest {
  id: string;
  artist_id: string;
  artist_email: string;
  total_amount: number;
  status: string;
  remarks: string | null;
  royalty_count: number;
  created_at: string;
  updated_at: string;
  approved_by: string | null;
  approved_by_email: string | null;
  approved_at: string | null;
}

export default function AdminPaymentRequestsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [remarksModalOpen, setRemarksModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [selectedRequestIdForReceipt, setSelectedRequestIdForReceipt] = useState<string | null>(null);
  
  const [actionRemarks, setActionRemarks] = useState("");
  const [actionType, setActionType] = useState<"approved" | "rejected" | "paid">("approved");

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

  useEffect(() => {
    if (user?.role === "admin") {
      fetchPaymentRequests();
    }
  }, [user, statusFilter]);

  const fetchPaymentRequests = async () => {
    try {
      setLoading(true);

      const queryParams = new URLSearchParams();
      if (statusFilter !== "all") {
        queryParams.append("status", statusFilter);
      }

      const response = await fetch(`/api/admin/payment-requests?${queryParams.toString()}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch payment requests");
      }

      setPaymentRequests(data.paymentRequests);
    } catch (error) {
      console.error("Error fetching payment requests:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load payment requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedRequest) return;

    try {
      setProcessing(true);

      const response = await fetch("/api/admin/payment-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: selectedRequest.id,
          status: actionType,
          remarks: actionRemarks || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || `Failed to ${actionType} payment request`);
      }

      toast({
        title: "Success",
        description: `Payment request ${actionType} successfully`,
      });

      // Close modals and refresh
      setApproveModalOpen(false);
      setRejectModalOpen(false);
      setRemarksModalOpen(false);
      setActionRemarks("");
      setSelectedRequest(null);
      fetchPaymentRequests();
    } catch (error) {
      console.error("Error updating payment request:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : `Failed to ${actionType} payment request`,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleApprove = (request: PaymentRequest) => {
    setSelectedRequest(request);
    setActionType("approved");
    setActionRemarks("");
    setRemarksModalOpen(true);
  };

  const handleReject = (request: PaymentRequest) => {
    setSelectedRequest(request);
    setActionType("rejected");
    setActionRemarks("");
    setRemarksModalOpen(true);
  };

  const handleViewReceipt = (requestId: string) => {
    setSelectedRequestIdForReceipt(requestId);
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
          <FileText className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Payment Requests Management</h1>
        </div>
        <p className="text-slate-600">Review and manage artist payment requests</p>
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
          <p className="text-sm text-slate-600 mb-1">Approved</p>
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

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="status-filter">Status Filter</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="status-filter">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Payment Requests Table */}
      <div className="bg-white rounded-lg shadow-md border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold">
            Payment Requests ({paymentRequests.length})
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : paymentRequests.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No payment requests found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Artist</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Royalties</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Request Date</TableHead>
                  <TableHead>Approved By</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      {request.artist_email}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      ${parseFloat(request.total_amount.toString()).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      {request.royalty_count}
                    </TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>
                      {new Date(request.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {request.approved_by_email || "—"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm">
                      {request.remarks || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewReceipt(request.id)}
                          className="gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Button>
                        {request.status === "pending" && (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleApprove(request)}
                              className="gap-1 bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleReject(request)}
                              className="gap-1"
                            >
                              <XCircle className="w-4 h-4" />
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Remarks Modal */}
      <Dialog open={remarksModalOpen} onOpenChange={setRemarksModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approved" ? "Approve" : "Reject"} Payment Request
            </DialogTitle>
            <DialogDescription>
              {selectedRequest && `Amount: $${parseFloat(selectedRequest.total_amount.toString()).toFixed(2)} for ${selectedRequest.artist_email}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="remarks">Remarks (Optional)</Label>
              <Input
                id="remarks"
                placeholder="Add any notes or comments..."
                value={actionRemarks}
                onChange={(e) => setActionRemarks(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemarksModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={actionType === "approved" ? "default" : "destructive"}
              onClick={handleUpdateStatus}
              disabled={processing}
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {actionType === "approved" ? "Approve" : "Reject"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Modal */}
      <ReceiptModal
        open={receiptModalOpen}
        onOpenChange={setReceiptModalOpen}
        paymentRequestId={selectedRequestIdForReceipt}
      />
    </div>
  );
}



