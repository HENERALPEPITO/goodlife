"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Save } from "lucide-react";
import type { AuthUser } from "@/types";

interface Invoice {
  id?: string;
  artist_id?: string;
  artist_name?: string;
  statement_number?: string;
  period?: string;
  total_net?: number;
  payment_options?: string;
  invoice_ref?: string;
  invoice_number?: string;
  invoice_date?: string;
  status?: "pending" | "approved" | "rejected";
}

interface InvoiceFormProps {
  invoice: Invoice | null;
  user: AuthUser;
  artists: Array<{ id: string; name: string; email: string }>;
  onClose: () => void;
  onSave: () => void;
}

export function InvoiceForm({ invoice, user, artists, onClose, onSave }: InvoiceFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    artist_id: "",
    artist_name: "",
    statement_number: "",
    period: "",
    total_net: "",
    payment_options: "",
    invoice_date: new Date().toISOString().split("T")[0],
  });

  const isAdmin = user.role === "admin";
  const isEdit = !!invoice;

  useEffect(() => {
    if (invoice) {
      setFormData({
        artist_id: invoice.artist_id || "",
        artist_name: invoice.artist_name || "",
        statement_number: invoice.statement_number || "",
        period: invoice.period || "",
        total_net: invoice.total_net?.toString() || "",
        payment_options: invoice.payment_options || "",
        invoice_date: invoice.invoice_date 
          ? new Date(invoice.invoice_date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
      });
    } else if (!isAdmin) {
      // Artists should not be able to create invoices manually
      // This should only be called by admin, but if somehow called, pre-fill artist info
      fetchArtistInfo();
    }
  }, [invoice, isAdmin]);

  const fetchArtistInfo = async () => {
    try {
      const { data: artist, error } = await supabase
        .from("artists")
        .select("id, name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (artist && !error) {
        setFormData(prev => ({
          ...prev,
          artist_id: artist.id,
          artist_name: artist.name || user.email || "",
        }));
      }
    } catch (error) {
      console.error("Error fetching artist info:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.artist_name || !formData.statement_number || !formData.total_net) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Get or generate invoice reference
      let invoiceRef = invoice?.invoice_ref;
      if (!invoiceRef) {
        const { data: refData, error: refError } = await supabase.rpc("generate_invoice_ref");
        if (refError) {
          // Fallback: generate client-side
          invoiceRef = `INV-${Date.now().toString(36).toUpperCase()}`;
        } else {
          invoiceRef = refData;
        }
      }

      // Generate invoice number if not exists
      let invoiceNumber = invoice?.invoice_number;
      if (!invoiceNumber) {
        invoiceNumber = `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
      }

      const invoiceData: any = {
        artist_id: formData.artist_id,
        artist_name: formData.artist_name,
        statement_number: formData.statement_number,
        period: formData.period,
        total_net: parseFloat(formData.total_net),
        amount: parseFloat(formData.total_net), // Keep for backward compatibility
        payment_options: formData.payment_options,
        invoice_ref: invoiceRef,
        invoice_number: invoiceNumber,
        invoice_date: new Date(formData.invoice_date).toISOString(),
        status: invoice?.status || "pending",
      };

      if (isEdit) {
        invoiceData.updated_at = new Date().toISOString();
        const { error } = await supabase
          .from("invoices")
          .update(invoiceData)
          .eq("id", invoice.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Invoice updated successfully",
        });
      } else {
        invoiceData.created_at = new Date().toISOString();
        const { error } = await supabase
          .from("invoices")
          .insert(invoiceData);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Invoice created successfully",
        });
      }

      onSave();
    } catch (error: any) {
      console.error("Error saving invoice:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to save invoice",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEdit ? "Edit Invoice" : "SUBMIT INVOICE"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Artist Selection (Admin only) */}
          {isAdmin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Artist *
              </label>
              <select
                value={formData.artist_id}
                onChange={(e) => {
                  const selected = artists.find(a => a.id === e.target.value);
                  setFormData({
                    ...formData,
                    artist_id: e.target.value,
                    artist_name: selected?.name || selected?.email || "",
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              >
                <option value="">Select Artist</option>
                {artists.map((artist) => (
                  <option key={artist.id} value={artist.id}>
                    {artist.name || artist.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Artist Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ARTIST NAME *
            </label>
            <Input
              value={formData.artist_name}
              onChange={(e) => setFormData({ ...formData, artist_name: e.target.value })}
              placeholder="Artist Name"
              required
              disabled={!isAdmin && !isEdit}
            />
          </div>

          {/* Address (Fixed) */}
          <div className="bg-gray-50 p-4 rounded-md">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ADDRESS:
            </label>
            <div className="text-gray-700 font-light">
              Calle 9 #86<br />
              Merida<br />
              97136 Mexico
            </div>
          </div>

          {/* Invoice To (Fixed) */}
          <div className="bg-gray-50 p-4 rounded-md">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              INVOICE TO:
            </label>
            <div className="text-gray-700 font-light">
              Lime Blue Music Limited Ground Floor<br />
              161 Rosebery Avenue London<br />
              ECIR 4QX<br />
              United Kingdom
            </div>
          </div>

          {/* Statement Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Statement # *
            </label>
            <Input
              value={formData.statement_number}
              onChange={(e) => setFormData({ ...formData, statement_number: e.target.value })}
              placeholder="Statement Number"
              required
            />
          </div>

          {/* Period */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Period
            </label>
            <Input
              value={formData.period}
              onChange={(e) => setFormData({ ...formData, period: e.target.value })}
              placeholder="e.g., January 2024 - March 2024"
            />
          </div>

          {/* Total NET */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              TOTAL NET (€) *
            </label>
            <Input
              type="number"
              step="0.01"
              value={formData.total_net}
              onChange={(e) => setFormData({ ...formData, total_net: e.target.value })}
              placeholder="0.00"
              required
            />
          </div>

          {/* Payment Options */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              PAYMENT OPTIONS
            </label>
            <Input
              value={formData.payment_options}
              onChange={(e) => setFormData({ ...formData, payment_options: e.target.value })}
              placeholder="Bank / PayPal / Wise / etc."
            />
          </div>

          {/* Invoice Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Invoice Date
            </label>
            <Input
              type="date"
              value={formData.invoice_date}
              onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
              required
            />
          </div>

          {/* Invoice Ref (read-only if editing) */}
          {isEdit && invoice?.invoice_ref && (
            <div className="bg-gray-50 p-4 rounded-md">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Invoice Ref:
              </label>
              <div className="text-gray-700 font-mono">{invoice.invoice_ref}</div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? "Saving..." : isEdit ? "Update Invoice" : "Create Invoice"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

