"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Check, X, DollarSign, Search } from "lucide-react";
import type { Invoice, AuthUser } from "@/types";
import InvoiceStatusBadge from "@/components/InvoiceStatusBadge";

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
      const { data: invoicesData, error: invoicesError } = await supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false });

      if (invoicesError) throw invoicesError;

      // Fetch user profiles for artist_ids
      const artistIds = [...new Set((invoicesData || []).map((inv) => inv.artist_id).filter(Boolean))];
      const { data: profilesData } = await supabase
        .from("user_profiles")
        .select("id, email")
        .in("id", artistIds);

      // Map profiles by id
      const profilesMap = new Map((profilesData || []).map((p) => [p.id, p]));

      // Combine invoice data with profile emails
      const invoicesWithProfiles = (invoicesData || []).map((invoice) => ({
        ...invoice,
        user_profiles: profilesMap.get(invoice.artist_id) || null,
      }));

      setInvoices(invoicesWithProfiles as any);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load invoices",
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


  const getActionDialogContent = () => {
    if (!selectedInvoice || !actionType) return null;

    const actionTexts = {
      approve: {
        title: "Approve Invoice",
        message: `Are you sure you want to approve invoice ${selectedInvoice.invoice_number} for €${Number(
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
        <div style={{ color: '#6B7280' }}>Loading invoices...</div>
      </div>
    );
  }

  const dialogContent = getActionDialogContent();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: '#1F2937' }}>Invoice Management</h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
            Review and manage artist payment requests
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div 
          className="rounded-xl p-4"
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.08)',
          }}
        >
          <div className="text-sm" style={{ color: '#6B7280' }}>Total Invoices</div>
          <div className="mt-1 text-2xl font-semibold" style={{ color: '#1F2937' }}>{stats.total}</div>
        </div>
        <div 
          className="rounded-xl p-4"
          style={{
            backgroundColor: '#FEF9C3',
            border: '1px solid #FCD34D',
            boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.08)',
          }}
        >
          <div className="text-sm" style={{ color: '#92400E' }}>Pending</div>
          <div className="mt-1 text-2xl font-semibold" style={{ color: '#92400E' }}>
            {stats.pending}
          </div>
          <div className="text-xs mt-1" style={{ color: '#B45309' }}>
            €{stats.pendingAmount.toFixed(2)}
          </div>
        </div>
        <div 
          className="rounded-xl p-4"
          style={{
            backgroundColor: '#DCFCE7',
            border: '1px solid #22C55E',
            boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.08)',
          }}
        >
          <div className="text-sm" style={{ color: '#166534' }}>Paid</div>
          <div className="mt-1 text-2xl font-semibold" style={{ color: '#166534' }}>
            {stats.paid}
          </div>
        </div>
        <div 
          className="rounded-xl p-4"
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.08)',
          }}
        >
          <div className="text-sm" style={{ color: '#6B7280' }}>Total Amount</div>
          <div className="mt-1 text-2xl font-semibold" style={{ color: '#1F2937' }}>
            €{stats.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </section>

      {/* Search and Filter */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#9CA3AF' }} />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by invoice number, artist email, or payment mode..."
            className="pl-9 rounded-md"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #D1D5DB',
              color: '#1F2937',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#3B82F6';
              e.currentTarget.style.outline = 'none';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#D1D5DB';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-md text-sm min-w-[140px]"
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #D1D5DB',
            color: '#1F2937',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#3B82F6';
            e.currentTarget.style.outline = 'none';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#D1D5DB';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Invoices Table */}
      <div 
        className="rounded-xl overflow-x-auto"
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.08)',
        }}
      >
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: '#F3F4F6' }}>
            <tr className="text-left">
              <th className="p-4 font-medium" style={{ color: '#6B7280' }}>Invoice #</th>
              <th className="p-4 font-medium" style={{ color: '#6B7280' }}>Artist</th>
              <th className="p-4 font-medium" style={{ color: '#6B7280' }}>Amount</th>
              <th className="p-4 font-medium" style={{ color: '#6B7280' }}>Payment Mode</th>
              <th className="p-4 font-medium" style={{ color: '#6B7280' }}>Status</th>
              <th className="p-4 font-medium" style={{ color: '#6B7280' }}>Remarks</th>
              <th className="p-4 font-medium" style={{ color: '#6B7280' }}>Created</th>
              <th className="p-4 font-medium" style={{ color: '#6B7280' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.length === 0 ? (
              <tr>
                <td className="p-4 text-center" colSpan={8} style={{ color: '#6B7280' }}>
                  {searchTerm || statusFilter !== "all"
                    ? "No invoices match your filters"
                    : "No invoices found"}
                </td>
              </tr>
            ) : (
              filteredInvoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="border-t transition-colors"
                  style={{
                    borderColor: '#E5E7EB',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#F9FAFB';
                    e.currentTarget.style.boxShadow = '0px 1px 2px rgba(0, 0, 0, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#FFFFFF';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <td className="p-4 font-mono font-medium" style={{ color: '#1F2937' }}>{invoice.invoice_number}</td>
                  <td className="p-4" style={{ color: '#6B7280' }}>
                    {invoice.user_profiles?.email || "Unknown"}
                  </td>
                  <td className="p-4 font-semibold" style={{ color: '#166534' }}>
                    €{Number(invoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-4" style={{ color: '#6B7280' }}>{invoice.mode_of_payment}</td>
                  <td className="p-4">
                    <InvoiceStatusBadge 
                      status={
                        invoice.status === "pending" 
                          ? "pending" 
                          : invoice.status === "approved" 
                          ? "approved" 
                          : invoice.status === "paid"
                          ? "paid"
                          : "rejected"
                      } 
                    />
                  </td>
                  <td className="p-4 max-w-xs truncate" style={{ color: '#6B7280' }}>
                    {invoice.remarks || "-"}
                  </td>
                  <td className="p-4" style={{ color: '#6B7280' }}>
                    {new Date(invoice.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      {invoice.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => openActionDialog(invoice, "approve")}
                            className="rounded-full"
                            style={{
                              backgroundColor: '#22C55E',
                              color: '#FFFFFF',
                              fontWeight: 500,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#16A34A';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#22C55E';
                            }}
                            title="Approve"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openActionDialog(invoice, "reject")}
                            className="rounded-full"
                            style={{
                              border: '1px solid #DC2626',
                              color: '#DC2626',
                              backgroundColor: '#FFFFFF',
                              fontWeight: 500,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#FEE2E2';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#FFFFFF';
                            }}
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
                          className="rounded-full"
                          style={{
                            backgroundColor: '#2563EB',
                            color: '#FFFFFF',
                            fontWeight: 500,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#1D4ED8';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#2563EB';
                          }}
                          title="Mark as Paid"
                        >
                          <DollarSign className="h-4 w-4 mr-1" />
                          Mark Paid
                        </Button>
                      )}
                      {(invoice.status === "paid" || invoice.status === "rejected") && (
                        <span className="text-xs px-2 py-1" style={{ color: '#6B7280' }}>No actions</span>
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
        <DialogContent style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px' }}>
          <DialogHeader>
            <DialogTitle style={{ color: '#1F2937', fontSize: '1.25rem', fontWeight: 600 }}>{dialogContent?.title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ color: '#6B7280' }}>{dialogContent?.message}</p>
          {selectedInvoice && (
            <div 
              className="mt-4 p-4 rounded-lg space-y-2 text-sm"
              style={{
                backgroundColor: '#F3F4F6',
                border: '1px solid #E5E7EB',
              }}
            >
              <div className="flex justify-between">
                <span style={{ color: '#6B7280' }}>Artist:</span>
                <span className="font-medium" style={{ color: '#1F2937' }}>{selectedInvoice.user_profiles?.email}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#6B7280' }}>Payment Mode:</span>
                <span className="font-medium" style={{ color: '#1F2937' }}>{selectedInvoice.mode_of_payment}</span>
              </div>
              {selectedInvoice.remarks && (
                <div className="flex justify-between">
                  <span style={{ color: '#6B7280' }}>Remarks:</span>
                  <span className="font-medium" style={{ color: '#1F2937' }}>{selectedInvoice.remarks}</span>
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
              className="rounded-full"
              style={{
                border: '1px solid #E5E7EB',
                color: '#6B7280',
                backgroundColor: '#FFFFFF',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#F3F4F6';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#FFFFFF';
              }}
            >
              Cancel
            </Button>
            <Button
              className="rounded-full"
              style={
                actionType === "approve"
                  ? {
                      backgroundColor: '#22C55E',
                      color: '#FFFFFF',
                      fontWeight: 500,
                    }
                  : actionType === "reject"
                  ? {
                      border: '1px solid #DC2626',
                      color: '#DC2626',
                      backgroundColor: '#FFFFFF',
                      fontWeight: 500,
                    }
                  : {
                      backgroundColor: '#2563EB',
                      color: '#FFFFFF',
                      fontWeight: 500,
                    }
              }
              onMouseEnter={(e) => {
                if (actionType === "approve") {
                  e.currentTarget.style.backgroundColor = '#16A34A';
                } else if (actionType === "reject") {
                  e.currentTarget.style.backgroundColor = '#FEE2E2';
                } else {
                  e.currentTarget.style.backgroundColor = '#1D4ED8';
                }
              }}
              onMouseLeave={(e) => {
                if (actionType === "approve") {
                  e.currentTarget.style.backgroundColor = '#22C55E';
                } else if (actionType === "reject") {
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                } else {
                  e.currentTarget.style.backgroundColor = '#2563EB';
                }
              }}
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




