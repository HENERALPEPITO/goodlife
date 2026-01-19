"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  FileDown,
  Search,
  Check,
  X,
  Eye,
  Edit2,
  Trash2
} from "lucide-react";
import type { AuthUser } from "@/types";
import InvoiceStatusBadge from "@/components/InvoiceStatusBadge";
import { InvoiceForm } from "./InvoiceForm";
import { PaymentRequestInvoicePDF } from "./PaymentRequestInvoicePDF";
import { getInvoiceSettings } from "@/lib/invoiceSettings";

interface Invoice {
  id: string;
  artist_id: string;
  artist_name: string;
  statement_number: string;
  period: string;
  total_net: number;
  amount?: number;
  total_amount?: number;
  payment_options: string;
  invoice_ref: string;
  invoice_date: string;
  invoice_number?: string;
  status: "pending" | "approved" | "rejected";
  payment_request_id?: string;
  created_at: string;
  updated_at: string;
  user_profiles?: {
    email: string;
  };
}

interface InvoiceManagementProps {
  user: AuthUser;
}

export default function InvoiceManagement({ user }: InvoiceManagementProps) {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [artists, setArtists] = useState<Array<{ id: string; name: string; email: string }>>([]);

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [artistFilter, setArtistFilter] = useState<string>("all");

  const isAdmin = user.role === "admin";

  useEffect(() => {
    fetchInvoices();
    if (isAdmin) {
      fetchArtists();
    }
  }, [user]);

  useEffect(() => {
    filterInvoices();
  }, [searchTerm, statusFilter, artistFilter, invoices]);

  const fetchArtists = async () => {
    try {
      const { data, error } = await supabase
        .from("artists")
        .select("id, name, email")
        .order("name");

      if (error) throw error;
      setArtists(data || []);
    } catch (error) {
      console.error("Error fetching artists:", error);
    }
  };

  const fetchInvoices = async () => {
    try {
      setLoading(true);

      // Get artist ID if user is artist
      let artistId: string | null = null;
      if (!isAdmin) {
        const { data: artist, error: artistError } = await supabase
          .from("artists")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (artistError || !artist) {
          console.error("Error fetching artist:", artistError);
          setInvoices([]);
          setLoading(false);
          return;
        }
        artistId = artist.id;
      }

      // Build query
      let query = supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false });

      if (!isAdmin && artistId) {
        query = query.eq("artist_id", artistId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch user profiles for admin view
      if (isAdmin && data && data.length > 0) {
        const artistIds = [...new Set(data.map((inv: any) => inv.artist_id).filter(Boolean))];
        const { data: artists } = await supabase
          .from("artists")
          .select("id, user_id")
          .in("id", artistIds);

        if (artists) {
          const userIds = artists.map(a => a.user_id).filter(Boolean);
          const { data: profiles } = await supabase
            .from("user_profiles")
            .select("id, email")
            .in("id", userIds);

          const artistToUserMap = new Map(artists.map(a => [a.id, a.user_id]));
          const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

          data.forEach((inv: any) => {
            const userId = artistToUserMap.get(inv.artist_id);
            if (userId) {
              inv.user_profiles = profileMap.get(userId);
            }
          });
        }
      }

      setInvoices(data || []);
    } catch (error: any) {
      console.error("Error fetching invoices:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to load invoices",
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
        (inv) =>
          inv.invoice_ref?.toLowerCase().includes(searchLower) ||
          inv.statement_number?.toLowerCase().includes(searchLower) ||
          inv.artist_name?.toLowerCase().includes(searchLower) ||
          inv.invoice_number?.toLowerCase().includes(searchLower)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((inv) => inv.status === statusFilter);
    }

    // Artist filter (admin only)
    if (isAdmin && artistFilter !== "all") {
      filtered = filtered.filter((inv) => inv.artist_id === artistFilter);
    }

    setFilteredInvoices(filtered);
  };

  const handleCreateInvoice = () => {
    setEditingInvoice(null);
    setShowForm(true);
  };

  const handleEditInvoice = (invoice: Invoice) => {
    // Only admin can edit invoices
    if (!isAdmin) {
      toast({
        title: "Cannot Edit",
        description: "Only admins can edit invoices. Artists can view and download only.",
        variant: "destructive",
      });
      return;
    }

    if (invoice.status !== "pending" && !isAdmin) {
      toast({
        title: "Cannot Edit",
        description: "Only pending invoices can be edited",
        variant: "destructive",
      });
      return;
    }
    setEditingInvoice(invoice);
    setShowForm(true);
  };

  const handleDeleteInvoice = async (invoice: Invoice) => {
    // Only admin can delete invoices
    if (!isAdmin) {
      toast({
        title: "Cannot Delete",
        description: "Only admins can delete invoices. Artists can view and download only.",
        variant: "destructive",
      });
      return;
    }

    if (!isAdmin && invoice.status !== "pending") {
      toast({
        title: "Cannot Delete",
        description: "Only pending invoices can be deleted",
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`Are you sure you want to delete invoice ${invoice.invoice_ref || invoice.invoice_number}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("invoices")
        .delete()
        .eq("id", invoice.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Invoice deleted successfully",
      });

      fetchInvoices();
    } catch (error: any) {
      console.error("Error deleting invoice:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to delete invoice",
        variant: "destructive",
      });
    }
  };

  const handleApproveReject = async (invoice: Invoice, status: "approved" | "rejected") => {
    if (!isAdmin) return;

    try {
      const { error } = await supabase
        .from("invoices")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", invoice.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Invoice ${status} successfully`,
      });

      fetchInvoices();
    } catch (error: any) {
      console.error(`Error ${status} invoice:`, error);
      toast({
        title: "Error",
        description: error?.message || `Failed to ${status} invoice`,
        variant: "destructive",
      });
    }
  };

  const handleDownloadPDF = async (invoice: Invoice) => {
    try {
      // Get invoice settings for PDF generation
      const settings = await getInvoiceSettings();

      // Check if this is a payment request invoice (has payment_request_id)
      if (invoice.payment_request_id) {
        await PaymentRequestInvoicePDF.downloadInvoice(
          {
            id: invoice.id,
            invoice_number: invoice.invoice_number || invoice.invoice_ref || "INV-0000",
            invoice_date: invoice.invoice_date || invoice.created_at,
            artist_name: invoice.artist_name || "Unknown Artist",
            artist_email: invoice.user_profiles?.email,
            total_net: invoice.total_net || invoice.amount || 0,
            status: invoice.status || "pending",
            payment_request_id: invoice.payment_request_id,
          },
          { settings }
        );
      } else {
        // Use original InvoicePDF for non-payment-request invoices
        const { InvoicePDF } = await import("./InvoicePDF");
        await InvoicePDF.downloadInvoice(invoice);
      }
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to generate PDF",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading invoices...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {isAdmin ? "Invoice Management" : "My Invoices"}
          </h1>
          <p className="text-sm mt-1 text-gray-600">
            {isAdmin
              ? "View and manage all invoices. Invoices are automatically generated when artists request payment."
              : "View your invoices. Invoices are automatically generated when you request payment."}
          </p>
        </div>
        {/* Invoices are automatically generated when artists request payment - no manual creation */}
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4 items-center flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by ref, statement, artist..."
            className="pl-9"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-md text-sm"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        {isAdmin && (
          <select
            value={artistFilter}
            onChange={(e) => setArtistFilter(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm min-w-[150px]"
          >
            <option value="all">All Artists</option>
            {artists.map((artist) => (
              <option key={artist.id} value={artist.id}>
                {artist.name || artist.email}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Invoice Ref</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Statement #</th>
              {isAdmin && (
                <th className="px-4 py-3 text-left font-medium text-gray-700">Artist</th>
              )}
              <th className="px-4 py-3 text-left font-medium text-gray-700">Period</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Total NET</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Date</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 8 : 7} className="px-4 py-8 text-center text-gray-500">
                  No invoices found
                </td>
              </tr>
            ) : (
              filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-900">{invoice.invoice_ref || invoice.invoice_number || "—"}</td>
                  <td className="px-4 py-3 text-gray-700">{invoice.statement_number || "—"}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-gray-700">
                      {invoice.artist_name || invoice.user_profiles?.email || "—"}
                    </td>
                  )}
                  <td className="px-4 py-3 text-gray-700">{invoice.period || "—"}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">
                    ${Number(invoice.total_net || invoice.total_amount || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(invoice.invoice_date || invoice.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <InvoiceStatusBadge status={invoice.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadPDF(invoice)}
                        title="Download PDF"
                      >
                        <FileDown className="h-4 w-4" />
                      </Button>
                      {/* Admins and artists can only view/download invoices - no editing */}
                      {/* Invoices are auto-generated receipts from payment requests */}
                      {/* To approve/reject, use the Payment Requests page */}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Invoice Form Modal */}
      {showForm && (
        <InvoiceForm
          invoice={editingInvoice}
          user={user}
          artists={isAdmin ? artists : []}
          onClose={() => {
            setShowForm(false);
            setEditingInvoice(null);
          }}
          onSave={() => {
            setShowForm(false);
            setEditingInvoice(null);
            fetchInvoices();
          }}
        />
      )}
    </div>
  );
}

