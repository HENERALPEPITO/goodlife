"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, Receipt } from "lucide-react";
import type { Invoice, Royalty, AuthUser } from "@/types";
import DarkInvoiceStatusBadge from "@/components/DarkInvoiceStatusBadge";

interface ArtistInvoicesProps {
  user: AuthUser;
}

export default function ArtistInvoices({ user }: ArtistInvoicesProps) {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [availableBalance, setAvailableBalance] = useState(0);
  
  const [form, setForm] = useState({
    amount: "",
    mode_of_payment: "",
    remarks: "",
  });

  useEffect(() => {
    fetchInvoices();
    calculateAvailableBalance();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("artist_id", user.id)
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

  const calculateAvailableBalance = async () => {
    try {
      // Get total royalties
      const { data: royalties, error: royaltiesError } = await supabase
        .from("royalties")
        .select("net_amount")
        .eq("artist_id", user.id);

      if (royaltiesError) throw royaltiesError;

      const totalRoyalties = royalties?.reduce(
        (sum, r) => sum + Number(r.net_amount || 0),
        0
      ) || 0;

      // Get total approved/paid invoices
      const { data: paidInvoices, error: invoicesError } = await supabase
        .from("invoices")
        .select("amount")
        .eq("artist_id", user.id)
        .in("status", ["approved", "paid"]);

      if (invoicesError) throw invoicesError;

      const totalPaid = paidInvoices?.reduce(
        (sum, i) => sum + Number(i.amount || 0),
        0
      ) || 0;

      setAvailableBalance(totalRoyalties - totalPaid);
    } catch (error) {
      console.error("Error calculating balance:", error);
    }
  };

  const handleRequestPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    if (amount > availableBalance) {
      toast({
        title: "Insufficient Balance",
        description: `You can only request up to €${availableBalance.toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }

    try {
      // Generate invoice number by calling the database function
      const { data: invoiceNumberData, error: invoiceNumberError } = await supabase
        .rpc("generate_invoice_number");

      if (invoiceNumberError) throw invoiceNumberError;

      const invoiceNumber = invoiceNumberData;

      const { error } = await supabase.from("invoices").insert({
        artist_id: user.id,
        amount: amount,
        mode_of_payment: form.mode_of_payment,
        invoice_number: invoiceNumber,
        status: "pending",
        remarks: form.remarks || null,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Invoice ${invoiceNumber} created successfully`,
      });

      setForm({
        amount: "",
        mode_of_payment: "",
        remarks: "",
      });
      setIsRequestDialogOpen(false);
      fetchInvoices();
      calculateAvailableBalance();
    } catch (error) {
      console.error("Error creating invoice:", error);
      toast({
        title: "Error",
        description: "Failed to create invoice",
        variant: "destructive",
      });
    }
  };


  if (loading) {
    return (
      <div 
        className="flex items-center justify-center h-64"
        style={{ backgroundColor: '#0B0C10' }}
      >
        <div style={{ color: '#B0B3B8' }}>Loading invoices...</div>
      </div>
    );
  }

  return (
    <div 
      className="space-y-6"
      style={{ 
        backgroundColor: '#0B0C10',
        minHeight: '100vh',
        padding: '0',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Header Section */}
      <div 
        className="flex items-center justify-between"
        style={{
          backgroundColor: '#111317',
          padding: '24px',
          borderRadius: '12px',
          border: '1px solid #2C2F36',
        }}
      >
        <div>
          <h1 
            className="font-semibold" 
            style={{ 
              color: '#F9FAFB', 
              fontSize: '1.8rem',
              fontWeight: 600,
              marginBottom: '4px',
            }}
          >
            My Invoices
          </h1>
          <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>
            Request payments and track your invoices
          </p>
        </div>
        <Button
          onClick={() => setIsRequestDialogOpen(true)}
          className="rounded-full transition-all duration-200"
          style={{
            background: 'linear-gradient(135deg, #2563EB, #3B82F6)',
            color: '#FFFFFF',
            fontWeight: 600,
            border: 'none',
            boxShadow: '0 0 12px rgba(37, 99, 235, 0.4)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #3B82F6, #60A5FA)';
            e.currentTarget.style.boxShadow = '0 0 16px rgba(59, 130, 246, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #2563EB, #3B82F6)';
            e.currentTarget.style.boxShadow = '0 0 12px rgba(37, 99, 235, 0.4)';
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Request Payment
        </Button>
      </div>

      {/* Available Balance Card */}
      <div 
        className="rounded-xl p-6 transition-all duration-200"
        style={{
          background: 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)',
          border: '1px solid #1F2937',
          boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm" style={{ color: '#9CA3AF' }}>Available Balance</div>
            <div className="mt-1 text-3xl font-bold" style={{ color: '#3B82F6' }}>
              €{availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <Receipt 
            className="h-12 w-12" 
            style={{ color: '#3B82F6', opacity: 0.5 }} 
          />
        </div>
      </div>

      {/* Invoices Table */}
      <div 
        className="rounded-xl overflow-x-auto"
        style={{
          backgroundColor: '#111317',
          border: '1px solid #2C2F36',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        }}
      >
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: '#1E2026', borderBottom: '1px solid #2C2F36' }}>
            <tr className="text-left">
              <th className="font-medium" style={{ color: '#9CA3AF', padding: '14px 16px', fontWeight: 500 }}>Invoice #</th>
              <th className="font-medium" style={{ color: '#9CA3AF', padding: '14px 16px', fontWeight: 500 }}>Amount</th>
              <th className="font-medium" style={{ color: '#9CA3AF', padding: '14px 16px', fontWeight: 500 }}>Payment Mode</th>
              <th className="font-medium" style={{ color: '#9CA3AF', padding: '14px 16px', fontWeight: 500 }}>Status</th>
              <th className="font-medium" style={{ color: '#9CA3AF', padding: '14px 16px', fontWeight: 500 }}>Remarks</th>
              <th className="font-medium" style={{ color: '#9CA3AF', padding: '14px 16px', fontWeight: 500 }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td 
                  className="text-center" 
                  colSpan={6} 
                  style={{ 
                    padding: '48px 16px',
                    color: '#9CA3AF',
                    backgroundColor: 'transparent',
                  }}
                >
                  No invoices yet. Click "Request Payment" to create your first invoice.
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="border-b transition-all duration-200"
                  style={{
                    borderColor: '#1F232B',
                    backgroundColor: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#1A1C21';
                    e.currentTarget.style.boxShadow = '0 1px 4px rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <td 
                    className="p-4 font-mono font-medium" 
                    style={{ color: '#E5E7EB' }}
                  >
                    {invoice.invoice_number}
                  </td>
                  <td 
                    className="p-4 font-semibold" 
                    style={{ color: '#22C55E' }}
                  >
                    €{Number(invoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-4" style={{ color: '#E5E7EB' }}>{invoice.mode_of_payment}</td>
                  <td className="p-4">
                    <DarkInvoiceStatusBadge 
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
                  <td className="p-4" style={{ color: '#B0B3B8' }}>{invoice.remarks || "-"}</td>
                  <td className="p-4" style={{ color: '#9CA3AF' }}>
                    {new Date(invoice.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Request Payment Dialog */}
      <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
        <DialogContent 
          style={{ 
            backgroundColor: '#1A1C21', 
            border: '1px solid #2C2F36', 
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: '#F9FAFB', fontSize: '1.25rem', fontWeight: 600 }}>
              Request Payment
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRequestPayment} className="space-y-4">
            <div 
              className="p-4 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.2)',
              }}
            >
              <div className="text-sm" style={{ color: '#9CA3AF' }}>Available Balance</div>
              <div className="mt-1 text-2xl font-bold" style={{ color: '#3B82F6' }}>
                €{availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#E5E7EB' }}>Amount *</label>
              <Input
                required
                type="number"
                step="0.01"
                min="0.01"
                max={availableBalance}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="Enter amount"
                className="rounded-md"
                style={{
                  backgroundColor: '#111317',
                  border: '1px solid #2C2F36',
                  color: '#E5E7EB',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#3B82F6';
                  e.currentTarget.style.outline = 'none';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.2)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#2C2F36';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#E5E7EB' }}>Mode of Payment *</label>
              <select
                required
                value={form.mode_of_payment}
                onChange={(e) => setForm({ ...form, mode_of_payment: e.target.value })}
                className="w-full px-3 py-2 rounded-md text-sm transition-all"
                style={{
                  backgroundColor: '#111317',
                  border: '1px solid #2C2F36',
                  color: '#E5E7EB',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#3B82F6';
                  e.currentTarget.style.outline = 'none';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.2)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#2C2F36';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <option value="" style={{ backgroundColor: '#111317', color: '#E5E7EB' }}>Select payment mode</option>
                <option value="Bank Transfer" style={{ backgroundColor: '#111317', color: '#E5E7EB' }}>Bank Transfer</option>
                <option value="PayPal" style={{ backgroundColor: '#111317', color: '#E5E7EB' }}>PayPal</option>
                <option value="GCash" style={{ backgroundColor: '#111317', color: '#E5E7EB' }}>GCash</option>
                <option value="Wise" style={{ backgroundColor: '#111317', color: '#E5E7EB' }}>Wise</option>
                <option value="Stripe" style={{ backgroundColor: '#111317', color: '#E5E7EB' }}>Stripe</option>
                <option value="Other" style={{ backgroundColor: '#111317', color: '#E5E7EB' }}>Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#E5E7EB' }}>Remarks (Optional)</label>
              <Input
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                placeholder="Add any notes or comments"
                className="rounded-md"
                style={{
                  backgroundColor: '#111317',
                  border: '1px solid #2C2F36',
                  color: '#E5E7EB',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#3B82F6';
                  e.currentTarget.style.outline = 'none';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.2)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#2C2F36';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRequestDialogOpen(false)}
                className="rounded-full transition-all"
                style={{
                  border: '1px solid #2C2F36',
                  color: '#B0B3B8',
                  backgroundColor: '#111317',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#1A1C21';
                  e.currentTarget.style.borderColor = '#3B82F6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#111317';
                  e.currentTarget.style.borderColor = '#2C2F36';
                }}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="rounded-full transition-all"
                style={{
                  background: 'linear-gradient(135deg, #2563EB, #3B82F6)',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  border: 'none',
                  boxShadow: '0 0 12px rgba(37, 99, 235, 0.4)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #3B82F6, #60A5FA)';
                  e.currentTarget.style.boxShadow = '0 0 16px rgba(59, 130, 246, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #2563EB, #3B82F6)';
                  e.currentTarget.style.boxShadow = '0 0 12px rgba(37, 99, 235, 0.4)';
                }}
              >
                Create Invoice
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}





