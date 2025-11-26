"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import {
  Table,  
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Eye, CheckCircle, XCircle, FileText } from "lucide-react";

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
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Redirect non-admin users
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

  // Fetch payment requests only when user is confirmed as admin
  useEffect(() => {
    if (!authLoading && user?.role === "admin") {
      fetchPaymentRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, authLoading]);

  const getAuthToken = async () => {
    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error("No authentication token found");
      }
      
      return session.access_token;
    } catch (error) {
      console.error("Error getting auth token:", error);
      throw error;
    }
  };

  const fetchPaymentRequests = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      
      console.log("=== FETCH PAYMENT REQUESTS DEBUG ===");
      console.log("Token exists:", !!token);
      console.log("Token preview:", token ? token.substring(0, 20) + "..." : "No token");
      console.log("User role:", user?.role);
      console.log("User ID:", user?.id);
      console.log("User email:", user?.email);
      
      const response = await fetch("/api/admin/payment-requests", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);
      console.log("Response headers:", Object.fromEntries(response.headers.entries()));

      const contentType = response.headers.get("content-type");
      console.log("Content-Type:", contentType);

      if (!response.ok) {
        let errorData;
        const responseText = await response.text();
        console.log("Raw error response:", responseText);
        
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          console.error("Failed to parse error response as JSON");
          errorData = { error: responseText || "Unknown error" };
        }
        
        console.error("Parsed error data:", errorData);
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Success response data:", data);

      if (data.success && data.paymentRequests) {
        console.log("Payment requests count:", data.paymentRequests.length);
        setPaymentRequests(data.paymentRequests);
      } else {
        throw new Error(data.error || "Failed to fetch payment requests");
      }
    } catch (error: any) {
      console.error("=== ERROR DETAILS ===");
      console.error("Error message:", error?.message);
      console.error("Error stack:", error?.stack);
      toast({
        title: "Error",
        description: error?.message || "Failed to load payment requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      setProcessingId(requestId);
      const token = await getAuthToken();
      const response = await fetch("/api/admin/payment-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: requestId,
          status: "approved",
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: "Payment request approved successfully",
        });
        await fetchPaymentRequests();
      } else {
        throw new Error(data.error || "Failed to approve payment request");
      }
    } catch (error: any) {
      console.error("Error approving payment request:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to approve payment request",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      setProcessingId(requestId);
      const token = await getAuthToken();
      const response = await fetch("/api/admin/payment-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: requestId,
          status: "rejected",
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: "Payment request rejected and royalties restored",
        });
        await fetchPaymentRequests();
      } else {
        throw new Error(data.error || "Failed to reject payment request");
      }
    } catch (error: any) {
      console.error("Error rejecting payment request:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to reject payment request",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleViewPDF = async (requestId: string) => {
    try {
      const token = await getAuthToken();
      const response = await fetch(`/api/invoices?payment_request_id=${requestId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch invoice");
      }

      if (data.invoice) {
        if (data.invoice.file_url) {
          window.open(data.invoice.file_url, "_blank");
        } else {
          const { supabase } = await import("@/lib/supabaseClient");
          const { data: paymentRequest } = await supabase
            .from("payment_requests")
            .select("*")
            .eq("id", requestId)
            .single();

          if (paymentRequest) {
            const { PaymentRequestInvoicePDF } = await import("@/components/PaymentRequestInvoicePDF");
            const { getInvoiceSettings } = await import("@/lib/invoiceSettings");
            const invoiceSettings = await getInvoiceSettings();

            const { data: artist } = await supabase
              .from("artists")
              .select("id, name, user_id")
              .eq("id", paymentRequest.artist_id)
              .single();

            if (artist) {
              const { data: userProfile } = await supabase
                .from("user_profiles")
                .select("email")
                .eq("id", artist.user_id)
                .single();

              const artistEmail = userProfile?.email || "";
              const invoiceDate = new Date(paymentRequest.created_at).toISOString().split("T")[0];
              const invoiceNumber = data.invoice.invoice_number || `INV-${new Date().getFullYear()}-${requestId.substring(0, 8).toUpperCase()}`;

              const invoiceData = {
                id: paymentRequest.id,
                invoice_number: invoiceNumber,
                invoice_date: invoiceDate,
                artist_name: artist.name || "Artist",
                artist_email: artistEmail,
                total_net: Number(paymentRequest.amount || 0),
                status: paymentRequest.status as "pending" | "approved" | "rejected",
                payment_request_id: paymentRequest.id,
              };

              const pdfDoc = await PaymentRequestInvoicePDF.generateInvoice(invoiceData, {
                settings: invoiceSettings,
              });

              const pdfBlob = pdfDoc.output("blob");
              const pdfUrl = URL.createObjectURL(pdfBlob);
              window.open(pdfUrl, "_blank");
            } else {
              throw new Error("Artist not found");
            }
          } else {
            throw new Error("Payment request not found");
          }
        }
      } else {
        throw new Error("Invoice not found");
      }
    } catch (error: any) {
      console.error("Error viewing PDF:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to open PDF",
        variant: "destructive",
      });
    }
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

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (user?.role !== "admin") {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Payment Requests</h1>
        </div>
        <p className="text-slate-600">Manage artist payment requests and approvals</p>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold">All Payment Requests</h2>
        </div>

        {paymentRequests.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-slate-400" />
            <p>No payment requests found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Artist Name</TableHead>
                  <TableHead className="text-right">Amount (€)</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.artist_email}</TableCell>
                    <TableCell className="text-right font-semibold">
                      €{Number(request.total_amount || 0).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {new Date(request.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewPDF(request.id)}
                          className="gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          View PDF
                        </Button>
                        {request.status === "pending" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleApprove(request.id)}
                              disabled={processingId === request.id}
                              className="gap-2 bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                            >
                              {processingId === request.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReject(request.id)}
                              disabled={processingId === request.id}
                              className="gap-2 bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                            >
                              {processingId === request.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <XCircle className="w-4 h-4" />
                              )}
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
    </div>
  );
}