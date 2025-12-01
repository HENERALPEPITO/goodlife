/**
 * Invoice Manager Component
 * Full CRUD invoice management for admins
 * Read-only view for artists
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  FileDown, 
  Eye, 
  X,
  Save,
  Upload,
  Search
} from "lucide-react";
import type { AuthUser } from "@/types";
import InvoiceStatusBadge from "@/components/InvoiceStatusBadge";
import { PDFGenerator, InvoiceData } from "./PDFGenerator";
import { loadLogoAsBase64 } from "@/lib/invoiceUtils";

interface InvoiceLineItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  sort_order?: number;
}

interface FullInvoice {
  id: string;
  artist_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  recipient_name?: string;
  recipient_email?: string;
  recipient_phone?: string;
  recipient_address?: string;
  subtotal?: number;
  tax_rate?: number;
  tax_amount?: number;
  amount: number;
  currency?: string;
  notes?: string;
  logo_url?: string;
  status?: string;
  created_at: string;
  updated_at: string;
  invoice_line_items?: InvoiceLineItem[];
  user_profiles?: {
    email: string;
  };
}

interface InvoiceManagerProps {
  user: AuthUser;
}

export default function InvoiceManager({ user }: InvoiceManagerProps) {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<FullInvoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<FullInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Edit/Create modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<FullInvoice | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    artist_id: "",
    invoice_number: "",
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: "",
    recipient_name: "",
    recipient_email: "",
    recipient_phone: "",
    recipient_address: "",
    tax_rate: 0,
    currency: "€",
    notes: "",
    logo_url: "",
    line_items: [] as InvoiceLineItem[],
  });
  
  const [artists, setArtists] = useState<Array<{ id: string; email: string }>>([]);
  const [showPreview, setShowPreview] = useState(false);

  const isAdmin = user.role === "admin";

  useEffect(() => {
    fetchInvoices();
    if (isAdmin) {
      fetchArtists();
    }
  }, [isAdmin]);

  useEffect(() => {
    filterInvoices();
  }, [searchTerm, statusFilter, invoices]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/invoices');
      if (!response.ok) throw new Error('Failed to fetch invoices');
      
      const { invoices: invoicesData } = await response.json();
      setInvoices(invoicesData || []);
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

  const fetchArtists = useCallback(async () => {
    try {
      const res = await fetch("/api/data/artist-profiles", { cache: "no-store" });
      const json = await res.json();

      if (json.error) throw new Error(json.error);
      setArtists(json.data || []);
    } catch (error) {
      console.error("Error fetching artists:", error);
    }
  }, []);

  const filterInvoices = () => {
    let filtered = [...invoices];

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (invoice) =>
          invoice.invoice_number.toLowerCase().includes(searchLower) ||
          invoice.user_profiles?.email.toLowerCase().includes(searchLower) ||
          invoice.recipient_name?.toLowerCase().includes(searchLower)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((invoice) => invoice.status === statusFilter);
    }

    setFilteredInvoices(filtered);
  };

  const generateInvoiceNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const existingCount = invoices.filter(
      (inv) => inv.invoice_number.startsWith(`INV-${year}${month}`)
    ).length;
    const sequence = String(existingCount + 1).padStart(4, '0');
    return `INV-${year}${month}-${sequence}`;
  };

  const openCreateModal = () => {
    setIsCreating(true);
    setEditingInvoice(null);
    setFormData({
      artist_id: "",
      invoice_number: generateInvoiceNumber(),
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: "",
      recipient_name: "",
      recipient_email: "",
      recipient_phone: "",
      recipient_address: "",
      tax_rate: 0,
      currency: "€",
      notes: "",
      logo_url: "",
      line_items: [{ description: "", quantity: 1, unit_price: 0, subtotal: 0 }],
    });
    setIsEditModalOpen(true);
  };

  const openEditModal = (invoice: FullInvoice) => {
    setIsCreating(false);
    setEditingInvoice(invoice);
    setFormData({
      artist_id: invoice.artist_id,
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.invoice_date ? invoice.invoice_date.split('T')[0] : new Date().toISOString().split('T')[0],
      due_date: invoice.due_date ? invoice.due_date.split('T')[0] : "",
      recipient_name: invoice.recipient_name || "",
      recipient_email: invoice.recipient_email || "",
      recipient_phone: invoice.recipient_phone || "",
      recipient_address: invoice.recipient_address || "",
      tax_rate: invoice.tax_rate || 0,
      currency: invoice.currency || "€",
      notes: invoice.notes || "",
      logo_url: invoice.logo_url || "",
      line_items: invoice.invoice_line_items && invoice.invoice_line_items.length > 0
        ? invoice.invoice_line_items.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        : [{ description: "", quantity: 1, unit_price: 0, subtotal: 0 }],
    });
    setIsEditModalOpen(true);
  };

  const calculateLineItemTotal = (item: InvoiceLineItem) => {
    return (item.quantity || 1) * (item.unit_price || 0);
  };

  const updateLineItem = (index: number, field: keyof InvoiceLineItem, value: any) => {
    const updated = [...formData.line_items];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'quantity' || field === 'unit_price') {
      updated[index].subtotal = calculateLineItemTotal(updated[index]);
    }
    setFormData({ ...formData, line_items: updated });
  };

  const addLineItem = () => {
    setFormData({
      ...formData,
      line_items: [
        ...formData.line_items,
        { description: "", quantity: 1, unit_price: 0, subtotal: 0 },
      ],
    });
  };

  const removeLineItem = (index: number) => {
    const updated = formData.line_items.filter((_, i) => i !== index);
    setFormData({ ...formData, line_items: updated.length > 0 ? updated : [{ description: "", quantity: 1, unit_price: 0, subtotal: 0 }] });
  };

  const calculateTotals = () => {
    const subtotal = formData.line_items.reduce(
      (sum, item) => sum + calculateLineItemTotal(item),
      0
    );
    const taxAmount = subtotal * ((formData.tax_rate || 0) / 100);
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const handleSave = async () => {
    try {
      const { subtotal, taxAmount, total } = calculateTotals();

      const payload = {
        artist_id: formData.artist_id,
        invoice_number: formData.invoice_number,
        invoice_date: new Date(formData.invoice_date).toISOString(),
        due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
        recipient_name: formData.recipient_name,
        recipient_email: formData.recipient_email,
        recipient_phone: formData.recipient_phone,
        recipient_address: formData.recipient_address,
        tax_rate: formData.tax_rate,
        currency: formData.currency,
        notes: formData.notes,
        logo_url: formData.logo_url,
        line_items: formData.line_items.map((item, index) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: calculateLineItemTotal(item),
          sort_order: index,
        })),
      };

      const url = editingInvoice 
        ? `/api/invoices/${editingInvoice.id}`
        : '/api/invoices';
      const method = editingInvoice ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save invoice');
      }

      toast({
        title: "Success",
        description: `Invoice ${editingInvoice ? 'updated' : 'created'} successfully`,
      });

      setIsEditModalOpen(false);
      fetchInvoices();
    } catch (error) {
      console.error("Error saving invoice:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save invoice",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (invoiceId: string) => {
    if (!confirm("Are you sure you want to delete this invoice?")) return;

    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete invoice');

      toast({
        title: "Success",
        description: "Invoice deleted successfully",
      });

      fetchInvoices();
    } catch (error) {
      console.error("Error deleting invoice:", error);
      toast({
        title: "Error",
        description: "Failed to delete invoice",
        variant: "destructive",
      });
    }
  };

  const handlePreview = async (invoice: FullInvoice) => {
    setShowPreview(true);
    // Preview will be shown in the modal
  };

  const handleExportPDF = async (invoice: FullInvoice) => {
    try {
      const artistEmail = invoice.user_profiles?.email || "";
      const recipientName = invoice.recipient_name || artistEmail;

      const invoiceData: InvoiceData = {
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date || invoice.created_at,
        due_date: invoice.due_date || undefined,
        recipient_name: recipientName,
        recipient_email: invoice.recipient_email || artistEmail,
        recipient_address: invoice.recipient_address || undefined,
        line_items: invoice.invoice_line_items?.map(item => ({
          description: item.description,
          quantity: item.quantity,
          rate: item.unit_price,
          amount: item.subtotal,
        })) || [],
        subtotal: invoice.subtotal || invoice.amount,
        tax_rate: invoice.tax_rate || 0,
        tax_amount: invoice.tax_amount || 0,
        total: invoice.amount,
        status: invoice.status as any,
        currency: invoice.currency || "€",
        notes: invoice.notes || undefined,
      };

      const logoBase64 = invoice.logo_url 
        ? await loadLogoAsBase64(invoice.logo_url)
        : await loadLogoAsBase64('/logo.png');

      PDFGenerator.downloadInvoice(invoiceData, logoBase64);
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast({
        title: "Error",
        description: "Failed to export PDF",
        variant: "destructive",
      });
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // For now, store as data URL (in production, upload to storage first)
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({ ...formData, logo_url: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div style={{ color: '#6B7280' }}>Loading invoices...</div>
      </div>
    );
  }

  const { subtotal, taxAmount, total } = calculateTotals();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: '#1F2937' }}>
            {isAdmin ? "Invoice Management" : "My Invoices"}
          </h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
            {isAdmin ? "Create and manage invoices" : "View and download your invoices"}
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={openCreateModal}
            style={{
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
        )}
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
            <option value="paid">Paid</option>
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
                <>
                  <th className="p-4 font-medium" style={{ color: '#6B7280' }}>Artist</th>
                  <th className="p-4 font-medium" style={{ color: '#6B7280' }}>Recipient</th>
                </>
              )}
              <th className="p-4 font-medium" style={{ color: '#6B7280' }}>Date</th>
              <th className="p-4 font-medium" style={{ color: '#6B7280' }}>Amount</th>
              {isAdmin && (
                <th className="p-4 font-medium" style={{ color: '#6B7280' }}>Status</th>
              )}
              <th className="p-4 font-medium" style={{ color: '#6B7280' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.length === 0 ? (
              <tr>
                <td className="p-4 text-center" colSpan={isAdmin ? 7 : 5} style={{ color: '#6B7280' }}>
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
                    <>
                      <td className="p-4" style={{ color: '#6B7280' }}>
                        {invoice.user_profiles?.email || "Unknown"}
                      </td>
                      <td className="p-4" style={{ color: '#6B7280' }}>
                        {invoice.recipient_name || "—"}
                      </td>
                    </>
                  )}
                  <td className="p-4" style={{ color: '#6B7280' }}>
                    {new Date(invoice.invoice_date || invoice.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-4 font-semibold" style={{ color: '#166534' }}>
                    {invoice.currency || "€"}{invoice.amount.toFixed(2)}
                  </td>
                  {isAdmin && (
                    <td className="p-4">
                      <InvoiceStatusBadge status={invoice.status as any} />
                    </td>
                  )}
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
                      {isAdmin && (
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
                            onClick={() => handleDelete(invoice.id)}
                            title="Delete"
                            style={{ borderColor: '#DC2626', color: '#DC2626' }}
                          >
                            <Trash2 className="h-4 w-4" />
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

      {/* Edit/Create Modal - Continue in next message due to length */}
      {isEditModalOpen && (
        <InvoiceEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          isCreating={isCreating}
          formData={formData}
          setFormData={setFormData}
          artists={artists}
          onSave={handleSave}
          onLogoUpload={handleLogoUpload}
          onAddLineItem={addLineItem}
          onUpdateLineItem={updateLineItem}
          onRemoveLineItem={removeLineItem}
          totals={{ subtotal, taxAmount, total }}
          onPreview={() => {
            // Create temporary invoice for preview
            const tempInvoice: FullInvoice = {
              id: editingInvoice?.id || 'temp',
              artist_id: formData.artist_id,
              invoice_number: formData.invoice_number,
              invoice_date: new Date(formData.invoice_date).toISOString(),
              due_date: formData.due_date ? new Date(formData.due_date).toISOString() : undefined,
              recipient_name: formData.recipient_name,
              recipient_email: formData.recipient_email,
              recipient_phone: formData.recipient_phone,
              recipient_address: formData.recipient_address,
              tax_rate: formData.tax_rate,
              tax_amount: taxAmount,
              subtotal: subtotal,
              amount: total,
              currency: formData.currency,
              notes: formData.notes,
              logo_url: formData.logo_url,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              invoice_line_items: formData.line_items.map((item, index) => ({
                id: `temp-${index}`,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unit_price,
                subtotal: calculateLineItemTotal(item),
                sort_order: index,
              })),
            };
            handlePreview(tempInvoice);
          }}
        />
      )}
    </div>
  );
}

// Invoice Edit Modal Component
interface InvoiceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  isCreating: boolean;
  formData: any;
  setFormData: (data: any) => void;
  artists: Array<{ id: string; email: string }>;
  onSave: () => void;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddLineItem: () => void;
  onUpdateLineItem: (index: number, field: keyof InvoiceLineItem, value: any) => void;
  onRemoveLineItem: (index: number) => void;
  totals: { subtotal: number; taxAmount: number; total: number };
  onPreview: () => void;
}

function InvoiceEditModal({
  isOpen,
  onClose,
  isCreating,
  formData,
  setFormData,
  artists,
  onSave,
  onLogoUpload,
  onAddLineItem,
  onUpdateLineItem,
  onRemoveLineItem,
  totals,
  onPreview,
}: InvoiceEditModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ margin: '20px' }}
      >
        <div className="p-6 border-b" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold" style={{ color: '#1F2937' }}>
              {isCreating ? "Create Invoice" : "Edit Invoice"}
            </h2>
            <button onClick={onClose} style={{ color: '#6B7280' }}>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                Artist *
              </label>
              <select
                value={formData.artist_id}
                onChange={(e) => setFormData({ ...formData, artist_id: e.target.value })}
                className="w-full px-3 py-2 rounded-md border"
                style={{ borderColor: '#D1D5DB' }}
                required
              >
                <option value="">Select artist...</option>
                {artists.map((artist) => (
                  <option key={artist.id} value={artist.id}>
                    {artist.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                Invoice Number *
              </label>
              <Input
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                Invoice Date *
              </label>
              <Input
                type="date"
                value={formData.invoice_date}
                onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                Due Date
              </label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
          </div>

          {/* Recipient Info */}
          <div className="border-t pt-4" style={{ borderColor: '#E5E7EB' }}>
            <h3 className="text-lg font-medium mb-4" style={{ color: '#1F2937' }}>
              Recipient Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                  Name *
                </label>
                <Input
                  value={formData.recipient_name}
                  onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                  Email
                </label>
                <Input
                  type="email"
                  value={formData.recipient_email}
                  onChange={(e) => setFormData({ ...formData, recipient_email: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                  Phone
                </label>
                <Input
                  value={formData.recipient_phone}
                  onChange={(e) => setFormData({ ...formData, recipient_phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                  Currency
                </label>
                <Input
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                Address
              </label>
              <textarea
                value={formData.recipient_address}
                onChange={(e) => setFormData({ ...formData, recipient_address: e.target.value })}
                className="w-full px-3 py-2 rounded-md border"
                style={{ borderColor: '#D1D5DB' }}
                rows={3}
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="border-t pt-4" style={{ borderColor: '#E5E7EB' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium" style={{ color: '#1F2937' }}>
                Line Items
              </h3>
              <Button
                size="sm"
                onClick={onAddLineItem}
                style={{ backgroundColor: '#2563EB', color: '#FFFFFF' }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
            <div className="space-y-2">
              {formData.line_items.map((item: any, index: number) => (
                <div key={index} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => onUpdateLineItem(index, 'description', e.target.value)}
                    />
                  </div>
                  <div className="w-24">
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => onUpdateLineItem(index, 'quantity', parseFloat(e.target.value) || 1)}
                      min="1"
                    />
                  </div>
                  <div className="w-32">
                    <Input
                      type="number"
                      placeholder="Unit Price"
                      value={item.unit_price}
                      onChange={(e) => onUpdateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="w-32">
                    <Input
                      value={`${formData.currency || '€'}${item.subtotal.toFixed(2)}`}
                      disabled
                      style={{ backgroundColor: '#F9FAFB' }}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRemoveLineItem(index)}
                    style={{ borderColor: '#DC2626', color: '#DC2626' }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t pt-4" style={{ borderColor: '#E5E7EB' }}>
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between">
                  <span style={{ color: '#6B7280' }}>Subtotal:</span>
                  <span style={{ color: '#1F2937' }}>{formData.currency || '€'}{totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={formData.tax_rate}
                    onChange={(e) => setFormData({ ...formData, tax_rate: parseFloat(e.target.value) || 0 })}
                    className="w-24"
                    min="0"
                    step="0.01"
                  />
                  <span style={{ color: '#6B7280' }}>Tax Rate (%):</span>
                  <span style={{ color: '#1F2937' }}>{formData.currency || '€'}{totals.taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t" style={{ borderColor: '#E5E7EB' }}>
                  <span className="font-bold" style={{ color: '#1F2937' }}>Total:</span>
                  <span className="font-bold text-lg" style={{ color: '#1F2937' }}>
                    {formData.currency || '€'}{totals.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes and Logo */}
          <div className="grid grid-cols-2 gap-4 border-t pt-4" style={{ borderColor: '#E5E7EB' }}>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                Notes / Payment Instructions
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 rounded-md border"
                style={{ borderColor: '#D1D5DB' }}
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                Logo (Optional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={onLogoUpload}
                className="w-full"
              />
              {formData.logo_url && (
                <p className="text-xs mt-2" style={{ color: '#6B7280' }}>
                  Logo uploaded
                </p>
              )}
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
              {isCreating ? "Create Invoice" : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}











