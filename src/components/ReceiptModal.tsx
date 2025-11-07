/**
 * Receipt Modal Component
 * Displays payment receipt details and allows PDF download
 */

"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Download, Eye, Loader2 } from "lucide-react";
import { PDFGenerator } from "./PDFGenerator";

interface RoyaltyItem {
  track_title: string;
  usage_count: number;
  gross_amount: number;
  admin_percent: number;
  net_amount: number;
  broadcast_date: string;
  platform: string;
  territory: string;
}

interface ReceiptData {
  receipt_number: string;
  artist_email: string;
  total_amount: number;
  status: string;
  created_at: string;
  approved_at: string | null;
  approved_by_email: string | null;
  royalties: RoyaltyItem[];
  totals: {
    total_gross: number;
    total_admin_fee: number;
    total_net: number;
    royalty_count: number;
  };
}

interface ReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentRequestId: string | null;
}

export function ReceiptModal({
  open,
  onOpenChange,
  paymentRequestId,
}: ReceiptModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  useEffect(() => {
    if (open && paymentRequestId) {
      fetchReceiptData();
    }
  }, [open, paymentRequestId]);

  const fetchReceiptData = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/payment/receipt?payment_request_id=${paymentRequestId}`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch receipt data");
      }

      setReceiptData(data.receipt);
    } catch (error) {
      console.error("Error fetching receipt:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to load receipt",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!receiptData) return;

    try {
      PDFGenerator.downloadReceipt(receiptData);
      toast({
        title: "Success",
        description: "Receipt PDF downloaded successfully",
      });
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive",
      });
    }
  };

  const handlePreviewPDF = () => {
    if (!receiptData) return;

    try {
      PDFGenerator.previewReceipt(receiptData);
    } catch (error) {
      console.error("Error previewing PDF:", error);
      toast({
        title: "Error",
        description: "Failed to preview PDF",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payment Receipt</DialogTitle>
          <DialogDescription>
            View and download payment receipt details
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : receiptData ? (
          <div className="space-y-6">
            {/* Receipt Header */}
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-600">Receipt Number</p>
                  <p className="font-semibold">{receiptData.receipt_number}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Status</p>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      receiptData.status === "approved" || receiptData.status === "paid"
                        ? "bg-green-100 text-green-800"
                        : receiptData.status === "rejected"
                        ? "bg-red-100 text-red-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {receiptData.status.toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Artist</p>
                  <p className="font-medium">{receiptData.artist_email}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Request Date</p>
                  <p className="font-medium">
                    {new Date(receiptData.created_at).toLocaleDateString()}
                  </p>
                </div>
                {receiptData.approved_at && (
                  <>
                    <div>
                      <p className="text-sm text-slate-600">Approved Date</p>
                      <p className="font-medium">
                        {new Date(receiptData.approved_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Approved By</p>
                      <p className="font-medium">
                        {receiptData.approved_by_email || "—"}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Royalty Details Table */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Royalty Details</h3>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Track</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Territory</TableHead>
                      <TableHead className="text-right">Usage</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Admin %</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receiptData.royalties.map((royalty, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {royalty.track_title}
                        </TableCell>
                        <TableCell>{royalty.platform || "—"}</TableCell>
                        <TableCell>{royalty.territory || "—"}</TableCell>
                        <TableCell className="text-right">
                          {royalty.usage_count}
                        </TableCell>
                        <TableCell className="text-right">
                          ${royalty.gross_amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {royalty.admin_percent.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          ${royalty.net_amount.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Totals */}
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Gross Amount:</span>
                  <span className="font-medium">
                    ${receiptData.totals.total_gross.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Admin Fee:</span>
                  <span className="font-medium">
                    ${receiptData.totals.total_admin_fee.toFixed(2)}
                  </span>
                </div>
                <div className="border-t border-slate-300 pt-2 mt-2">
                  <div className="flex justify-between text-lg">
                    <span className="font-semibold">Net Payable Amount:</span>
                    <span className="font-bold text-green-600">
                      ${receiptData.totals.total_net.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500">
            No receipt data available
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {receiptData && (
            <>
              <Button variant="outline" onClick={handlePreviewPDF} className="gap-2">
                <Eye className="w-4 h-4" />
                Preview PDF
              </Button>
              <Button onClick={handleDownloadPDF} className="gap-2">
                <Download className="w-4 h-4" />
                Download PDF
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}












