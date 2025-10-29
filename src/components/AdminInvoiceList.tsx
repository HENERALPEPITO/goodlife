"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Check, X, DollarSign, Search } from "lucide-react";
import type { Invoice, AuthUser } from "@/types";

interface InvoiceWithArtist extends Invoice {
  user_profiles?: {
    email: string;
  };
}

interface AdminInvoiceListProps {
  user: AuthUser;
}

export default function AdminInvoiceList({ user }: AdminInvoiceListProps) {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<InvoiceWithArtist[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<InvoiceWithArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithArtist | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "paid" | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    fetchInvoices();
  }, []);

  useEffect(() => {
    filterInvoices();
  }, [searchTerm, statusFilter, invoices]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          user_profiles!artist_id(email)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      toast({
        title: "Error",
        description: "Failed to load invoices",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterInvoices = () => {
    let filtered = [...invoices];

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (invoice) =>
          invoice.invoice_number.toLowerCase().includes(searchLower) ||
          invoice.user_profiles?.email.toLowerCase().includes(searchLower) ||
          invoice.mode_of_payment.toLowerCase().includes(searchLower)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((invoice) => invoice.status === statusFilter);
    }

    setFilteredInvoices(filtered);
  };

  const handleUpdateStatus = async (status: "approved" | "rejected" | "paid") => {
    if (!selectedInvoice) return;

    try {
      const { error } = await supabase
        .from("invoices")
        .update({ status })
        .eq("id", selectedInvoice.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Invoice ${selectedInvoice.invoice_number} has been ${status}`,
      });

      setSelectedInvoice(null);
      setActionType(null);
      fetchInvoices();
    } catch (error) {
      console.error("Error updating invoice:", error);
      toast({
        title: "Error",
        description: "Failed to update invoice",
        variant: "destructive",
      });
    }
  };

  const openActionDialog = (invoice: InvoiceWithArtist, action: "approve" | "reject" | "paid") => {
    setSelectedInvoice(invoice);
    setActionType(action);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
      case "approved":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
      case "paid":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
      case "rejected":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
      default:
        return "bg-zinc-100 text-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-300";
    }
  };

  const getActionDialogContent = () => {
    if (!selectedInvoice || !actionType) return null;

    const actionTexts = {
      approve: {
        title: "Approve Invoice",
        message: `Are you sure you want to approve invoice ${selectedInvoice.invoice_number} for $${Number(
          selectedInvoice.amount
        ).toFixed(2)}?`,
        buttonText: "Approve",
        buttonClass: "bg-green-600 hover:bg-green-700 text-white",
      },
      reject: {
        title: "Reject Invoice",
        message: `Are you sure you want to reject invoice ${selectedInvoice.invoice_number}?`,
        buttonText: "Reject",
        buttonClass: "bg-red-600 hover:bg-red-700 text-white",
      },
      paid: {
        title: "Mark as Paid",
        message: `Confirm that invoice ${selectedInvoice.invoice_number} has been paid?`,
        buttonText: "Mark as Paid",
        buttonClass: "bg-blue-600 hover:bg-blue-700 text-white",
      },
    };

    return actionTexts[actionType];
  };

  // Calculate statistics
  const stats = {
    total: invoices.length,
    pending: invoices.filter((i) => i.status === "pending").length,
    approved: invoices.filter((i) => i.status === "approved").length,
    paid: invoices.filter((i) => i.status === "paid").length,
    rejected: invoices.filter((i) => i.status === "rejected").length,
    totalAmount: invoices.reduce((sum, i) => sum + Number(i.amount || 0), 0),
    pendingAmount: invoices
      .filter((i) => i.status === "pending")
      .reduce((sum, i) => sum + Number(i.amount || 0), 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-500">Loading invoices...</div>
      </div>
    );
  }

  const dialogContent = getActionDialogContent();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Invoice Management</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Review and manage artist payment requests
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-950">
          <div className="text-sm text-zinc-500">Total Invoices</div>
          <div className="mt-1 text-2xl font-semibold">{stats.total}</div>
        </div>
        <div className="rounded-lg border border-yellow-200 dark:border-yellow-900 p-4 bg-yellow-50 dark:bg-yellow-950/30">
          <div className="text-sm text-yellow-700 dark:text-yellow-300">Pending</div>
          <div className="mt-1 text-2xl font-semibold text-yellow-700 dark:text-yellow-300">
            {stats.pending}
          </div>
          <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
            ${stats.pendingAmount.toFixed(2)}
          </div>
        </div>
        <div className="rounded-lg border border-green-200 dark:border-green-900 p-4 bg-green-50 dark:bg-green-950/30">
          <div className="text-sm text-green-700 dark:text-green-300">Paid</div>
          <div className="mt-1 text-2xl font-semibold text-green-700 dark:text-green-300">
            {stats.paid}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-950">
          <div className="text-sm text-zinc-500">Total Amount</div>
          <div className="mt-1 text-2xl font-semibold">
            ${stats.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </section>

      {/* Search and Filter */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by invoice number, artist email, or payment mode..."
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm min-w-[140px]"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Invoices Table */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr className="text-left text-zinc-600 dark:text-zinc-400">
              <th className="p-4 font-medium">Invoice #</th>
              <th className="p-4 font-medium">Artist</th>
              <th className="p-4 font-medium">Amount</th>
              <th className="p-4 font-medium">Payment Mode</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Remarks</th>
              <th className="p-4 font-medium">Created</th>
              <th className="p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.length === 0 ? (
              <tr>
                <td className="p-4 text-center text-zinc-500" colSpan={8}>
                  {searchTerm || statusFilter !== "all"
                    ? "No invoices match your filters"
                    : "No invoices found"}
                </td>
              </tr>
            ) : (
              filteredInvoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="border-t border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                >
                  <td className="p-4 font-mono font-medium">{invoice.invoice_number}</td>
                  <td className="p-4 text-zinc-600 dark:text-zinc-400">
                    {invoice.user_profiles?.email || "Unknown"}
                  </td>
                  <td className="p-4 font-semibold text-green-600 dark:text-green-400">
                    ${Number(invoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-4 text-zinc-600 dark:text-zinc-400">{invoice.mode_of_payment}</td>
                  <td className="p-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        invoice.status
                      )}`}
                    >
                      {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                    </span>
                  </td>
                  <td className="p-4 text-zinc-600 dark:text-zinc-400 max-w-xs truncate">
                    {invoice.remarks || "-"}
                  </td>
                  <td className="p-4 text-zinc-600 dark:text-zinc-400">
                    {new Date(invoice.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      {invoice.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => openActionDialog(invoice, "approve")}
                            className="bg-green-600 hover:bg-green-700 text-white"
                            title="Approve"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openActionDialog(invoice, "reject")}
                            className="text-red-600 hover:text-red-700"
                            title="Reject"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {invoice.status === "approved" && (
                        <Button
                          size="sm"
                          onClick={() => openActionDialog(invoice, "paid")}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          title="Mark as Paid"
                        >
                          <DollarSign className="h-4 w-4 mr-1" />
                          Mark Paid
                        </Button>
                      )}
                      {(invoice.status === "paid" || invoice.status === "rejected") && (
                        <span className="text-xs text-zinc-500 px-2 py-1">No actions</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Action Confirmation Dialog */}
      <Dialog
        open={!!selectedInvoice && !!actionType}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedInvoice(null);
            setActionType(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogContent?.title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{dialogContent?.message}</p>
          {selectedInvoice && (
            <div className="mt-4 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">Artist:</span>
                <span className="font-medium">{selectedInvoice.user_profiles?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">Payment Mode:</span>
                <span className="font-medium">{selectedInvoice.mode_of_payment}</span>
              </div>
              {selectedInvoice.remarks && (
                <div className="flex justify-between">
                  <span className="text-zinc-600 dark:text-zinc-400">Remarks:</span>
                  <span className="font-medium">{selectedInvoice.remarks}</span>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedInvoice(null);
                setActionType(null);
              }}
            >
              Cancel
            </Button>
            <Button
              className={dialogContent?.buttonClass}
              onClick={() => actionType && handleUpdateStatus(actionType)}
            >
              {dialogContent?.buttonText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}




