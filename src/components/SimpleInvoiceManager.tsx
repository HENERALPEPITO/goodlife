/**
 * Simplified Invoice Manager Component
 * Linked to payment requests - no line items, just total amount
 */

"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Edit2, 
  FileDown, 
  Eye,
  Check,
  X,
  Save,
  Search
} from "lucide-react";
import type { AuthUser } from "@/types";
import InvoiceStatusBadge from "@/components/InvoiceStatusBadge";
import { SimpleInvoicePDF, SimpleInvoiceData } from "./SimpleInvoicePDF";
import { loadLogoAsBase64 } from "@/lib/invoiceUtils";

interface SimpleInvoice {
  id: string;
  payment_request_id?: string;
  artist_id: string;
  invoice_number: string;
  invoice_date: string;
  artist_name?: string;
  artist_address?: string;
  artist_email?: string;
  artist_phone?: string;
  total_amount?: number; // Standardized field
  amount?: number; // Database field (legacy)
  status: "pending" | "approved" | "rejected";
  payment_method?: string;
  notes?: string;
  pdf_url?: string;
  created_at: string;
  updated_at: string;
  user_profiles?: {
    email: string;
  };
  payment_requests?: {
    total_amount?: number;
    amount?: number; // Database field
    status: string;
  };
}

interface SimpleInvoiceManagerProps {
  user: AuthUser;
}

export default function SimpleInvoiceManager({ user }: SimpleInvoiceManagerProps) {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<SimpleInvoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<SimpleInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<SimpleInvoice | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    artist_name: "",
    artist_address: "",
    artist_email: "",
    artist_phone: "",
    total_amount: 0,
    payment_method: "",
    notes: "",
  });

  const isAdmin = user.role === "admin";

  useEffect(() => {
    // Only fetch invoices if user is available
    if (user?.id) {
      fetchInvoices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    filterInvoices();
  }, [searchTerm, statusFilter, invoices]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      
      // Get the current session token from Supabase client
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      
      const response = await fetch('/api/invoices-simple', {
        credentials: 'include', // Include cookies in the request
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.details || errorData.error || `Failed to fetch invoices (${response.status})`;
        
        // If unauthorized, show error but don't redirect (page-level auth handles that)
        if (response.status === 401) {
          toast({
            title: "Authentication Error",
            description: "Unable to verify authentication. Please refresh the page or log in again.",
            variant: "destructive",
          });
          // Don't redirect - let the page-level auth check handle it
          return;
        }
        
        // For other errors, check if it's a table missing error
        if (errorData.code === '42P01' || errorMessage.includes('relation') || errorMessage.includes('does not exist')) {
          toast({
            title: "Database Error",
            description: "Invoices table not found. Please run the database migration first.",
            variant: "destructive",
          });
          return;
        }
        
        throw new Error(errorMessage);
      }
      
      const { invoices: invoicesData } = await response.json();
      setInvoices(invoicesData || []);
    } catch (error: any) {
      console.error("Error fetching invoices:", error);
      const errorMessage = error?.message || "Failed to load invoices. Please ensure you are logged in and the database migration has been run.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterInvoices = () => {
    let filtered = [...invoices];

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (invoice) =>
          invoice.invoice_number.toLowerCase().includes(searchLower) ||
          invoice.user_profiles?.email.toLowerCase().includes(searchLower) ||
          invoice.artist_name?.toLowerCase().includes(searchLower)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((invoice) => invoice.status === statusFilter);
    }

    setFilteredInvoices(filtered);
  };

  const openEditModal = (invoice: SimpleInvoice) => {
    if (!isAdmin) return;
    
    setEditingInvoice(invoice);
    setFormData({
      artist_name: invoice.artist_name || invoice.user_profiles?.email || "",
      artist_address: invoice.artist_address || "",
      artist_email: invoice.artist_email || invoice.user_profiles?.email || "",
      artist_phone: invoice.artist_phone || "",
      total_amount: invoice.total_amount || invoice.amount || invoice.payment_requests?.total_amount || invoice.payment_requests?.amount || 0,
      payment_method: invoice.payment_method || "",
      notes: invoice.notes || "",
    });
    setIsEditModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingInvoice || !isAdmin) return;

    try {
      const response = await fetch(`/api/invoices-simple/${editingInvoice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist_name: formData.artist_name,
          artist_address: formData.artist_address,
          artist_email: formData.artist_email,
          artist_phone: formData.artist_phone,
          // total_amount is fixed and not editable - it comes from payment_request
          payment_method: formData.payment_method,
          notes: formData.notes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update invoice');
      }

      toast({
        title: "Success",
        description: "Invoice updated successfully",
      });

      setIsEditModalOpen(false);
      fetchInvoices();
    } catch (error) {
      console.error("Error updating invoice:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update invoice",
        variant: "destructive",
      });
    }
  };

  const handleApprove = async (invoice: SimpleInvoice) => {
    if (!isAdmin) return;

    try {
      // Update invoice status
      const response = await fetch(`/api/invoices-simple/${invoice.id}/approve`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to approve invoice');

      toast({
        title: "Success",
        description: "Invoice approved successfully",
      });

      fetchInvoices();
    } catch (error) {
      console.error("Error approving invoice:", error);
      toast({
        title: "Error",
        description: "Failed to approve invoice",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (invoice: SimpleInvoice) => {
    if (!isAdmin) return;

    try {
      const response = await fetch(`/api/invoices-simple/${invoice.id}/reject`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to reject invoice');

      toast({
        title: "Success",
        description: "Invoice rejected successfully",
      });

      fetchInvoices();
    } catch (error) {
      console.error("Error rejecting invoice:", error);
      toast({
        title: "Error",
        description: "Failed to reject invoice",
        variant: "destructive",
      });
    }
  };

  const handleExportPDF = async (invoice: SimpleInvoice) => {
    try {
      // Ensure total_amount is a number, try multiple sources
      // Note: Database uses 'amount' but we standardize to 'total_amount' in the response
      const totalAmount = Number(
        invoice.total_amount ?? 
        invoice.amount ?? 
        invoice.payment_requests?.total_amount ?? 
        invoice.payment_requests?.amount ?? 
        0
      );
      
      console.log('PDF Export - Invoice data:', {
        invoice_id: invoice.id,
        invoice_amount: invoice.amount,
        invoice_total_amount: invoice.total_amount,
        payment_request_total: invoice.payment_requests?.total_amount,
        payment_request_amount: invoice.payment_requests?.amount,
        final_totalAmount: totalAmount
      });
      
      const invoiceData: SimpleInvoiceData = {
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date || invoice.created_at,
        artist_name: invoice.artist_name || invoice.user_profiles?.email || "Artist",
        artist_address: invoice.artist_address,
        artist_email: invoice.artist_email || invoice.user_profiles?.email,
        artist_phone: invoice.artist_phone,
        total_amount: totalAmount,
        status: invoice.status,
        payment_method: invoice.payment_method,
        notes: invoice.notes,
        currency: "€",
      };

      const logoBase64 = await loadLogoAsBase64('/logo.png');
      SimpleInvoicePDF.downloadInvoice(invoiceData, logoBase64);
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast({
        title: "Error",
        description: "Failed to export PDF",
        variant: "destructive",
      });
    }
  };

  const handlePreview = async (invoice: SimpleInvoice) => {
    try {
      // Ensure total_amount is a number, try multiple sources
      // Note: Database uses 'amount' but we standardize to 'total_amount' in the response
      const totalAmount = Number(
        invoice.total_amount ?? 
        invoice.amount ?? 
        invoice.payment_requests?.total_amount ?? 
        invoice.payment_requests?.amount ?? 
        0
      );
      
      console.log('PDF Preview - Invoice data:', {
        invoice_id: invoice.id,
        invoice_amount: invoice.amount,
        invoice_total_amount: invoice.total_amount,
        payment_request_total: invoice.payment_requests?.total_amount,
        payment_request_amount: invoice.payment_requests?.amount,
        final_totalAmount: totalAmount
      });
      
      const invoiceData: SimpleInvoiceData = {
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date || invoice.created_at,
        artist_name: invoice.artist_name || invoice.user_profiles?.email || "Artist",
        artist_address: invoice.artist_address,
        artist_email: invoice.artist_email || invoice.user_profiles?.email,
        artist_phone: invoice.artist_phone,
        total_amount: totalAmount,
        status: invoice.status,
        payment_method: invoice.payment_method,
        notes: invoice.notes,
        currency: "€",
      };

      const logoBase64 = await loadLogoAsBase64('/logo.png');
      SimpleInvoicePDF.previewInvoice(invoiceData, logoBase64);
    } catch (error) {
      console.error("Error previewing PDF:", error);
      toast({
        title: "Error",
        description: "Failed to preview PDF",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div style={{ color: '#6B7280' }}>Loading invoices...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: '#1F2937' }}>
            {isAdmin ? "Invoice Management" : "My Invoices"}
          </h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
            {isAdmin ? "View and manage all invoices" : "View and download your invoices"}
          </p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#9CA3AF' }} />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by invoice number, artist, or recipient..."
            className="pl-9 rounded-md"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #D1D5DB',
            }}
          />
        </div>
        {isAdmin && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-md text-sm min-w-[140px]"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #D1D5DB',
            }}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        )}
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
          <thead style={{ backgroundColor: '#F9FAFB' }}>
            <tr className="text-left">
              <th className="p-4 font-medium" style={{ color: '#6B7280' }}>Invoice #</th>
              {isAdmin && (
                <th className="p-4 font-medium" style={{ color: '#6B7280' }}>Artist</th>
              )}
              <th className="p-4 font-medium" style={{ color: '#6B7280' }}>Recipient</th>
              <th className="p-4 font-medium" style={{ color: '#6B7280' }}>Date</th>
              <th className="p-4 font-medium" style={{ color: '#6B7280' }}>Amount</th>
              <th className="p-4 font-medium" style={{ color: '#6B7280' }}>Status</th>
              <th className="p-4 font-medium" style={{ color: '#6B7280' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.length === 0 ? (
              <tr>
                <td className="p-4 text-center" colSpan={isAdmin ? 7 : 6} style={{ color: '#6B7280' }}>
                  No invoices found
                </td>
              </tr>
            ) : (
              filteredInvoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="border-t transition-colors"
                  style={{ borderColor: '#E5E7EB' }}
                >
                  <td className="p-4 font-mono font-medium" style={{ color: '#1F2937' }}>
                    {invoice.invoice_number}
                  </td>
                  {isAdmin && (
                    <td className="p-4" style={{ color: '#6B7280' }}>
                      {invoice.user_profiles?.email || "Unknown"}
                    </td>
                  )}
                  <td className="p-4" style={{ color: '#6B7280' }}>
                    {invoice.artist_name || invoice.user_profiles?.email || "—"}
                  </td>
                  <td className="p-4" style={{ color: '#6B7280' }}>
                    {new Date(invoice.invoice_date || invoice.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-4 font-semibold" style={{ color: '#166534' }}>
                    €{(invoice.total_amount || invoice.amount || 0).toFixed(2)}
                  </td>
                  <td className="p-4">
                    <InvoiceStatusBadge status={invoice.status} />
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePreview(invoice)}
                        title="Preview"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExportPDF(invoice)}
                        title="Download PDF"
                      >
                        <FileDown className="h-4 w-4" />
                      </Button>
                      {isAdmin && invoice.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditModal(invoice)}
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApprove(invoice)}
                            title="Approve"
                            style={{ borderColor: '#22C55E', color: '#22C55E' }}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(invoice)}
                            title="Reject"
                            style={{ borderColor: '#DC2626', color: '#DC2626' }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && editingInvoice && (
        <SimpleInvoiceEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          formData={formData}
          setFormData={setFormData}
          onSave={handleSave}
          onPreview={() => {
            const previewData: SimpleInvoice = {
              ...editingInvoice,
              artist_name: formData.artist_name,
              artist_address: formData.artist_address,
              artist_email: formData.artist_email,
              artist_phone: formData.artist_phone,
              total_amount: formData.total_amount,
              payment_method: formData.payment_method,
              notes: formData.notes,
            };
            handlePreview(previewData);
          }}
        />
      )}
    </div>
  );
}

// Edit Modal Component
interface SimpleInvoiceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  formData: any;
  setFormData: (data: any) => void;
  onSave: () => void;
  onPreview: () => void;
}

function SimpleInvoiceEditModal({
  isOpen,
  onClose,
  formData,
  setFormData,
  onSave,
  onPreview,
}: SimpleInvoiceEditModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ margin: '20px' }}
      >
        <div className="p-6 border-b" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold" style={{ color: '#1F2937' }}>
              Edit Invoice
            </h2>
            <button onClick={onClose} style={{ color: '#6B7280' }}>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Artist Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium" style={{ color: '#1F2937' }}>
              Artist Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                  Artist Name *
                </label>
                <Input
                  value={formData.artist_name}
                  onChange={(e) => setFormData({ ...formData, artist_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                  Email *
                </label>
                <Input
                  type="email"
                  value={formData.artist_email}
                  onChange={(e) => setFormData({ ...formData, artist_email: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                  Phone
                </label>
                <Input
                  value={formData.artist_phone}
                  onChange={(e) => setFormData({ ...formData, artist_phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                  Total Amount (Fixed)
                </label>
                <Input
                  type="number"
                  value={formData.total_amount}
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                  style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}
                  readOnly
                />
                <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
                  This amount is fixed and matches the payment request amount.
                </p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                Address
              </label>
              <textarea
                value={formData.artist_address}
                onChange={(e) => setFormData({ ...formData, artist_address: e.target.value })}
                className="w-full px-3 py-2 rounded-md border"
                style={{ borderColor: '#D1D5DB' }}
                rows={3}
              />
            </div>
          </div>

          {/* Payment Information */}
          <div className="space-y-4 border-t pt-4" style={{ borderColor: '#E5E7EB' }}>
            <h3 className="text-lg font-medium" style={{ color: '#1F2937' }}>
              Payment Information
            </h3>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                Payment Method
              </label>
              <Input
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                placeholder="e.g., Bank Transfer, PayPal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                Payment Instructions / Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 rounded-md border"
                style={{ borderColor: '#D1D5DB' }}
                rows={3}
                placeholder="Payment terms, instructions, etc."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t" style={{ borderColor: '#E5E7EB' }}>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={onPreview}
              style={{ borderColor: '#2563EB', color: '#2563EB' }}
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview PDF
            </Button>
            <Button
              onClick={onSave}
              style={{ backgroundColor: '#2563EB', color: '#FFFFFF' }}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

