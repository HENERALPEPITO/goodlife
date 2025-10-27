"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, Receipt } from "lucide-react";
import type { Invoice, Royalty, AuthUser } from "@/types";

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
        description: `You can only request up to $${availableBalance.toFixed(2)}`,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-500">Loading invoices...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Invoices</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Request payments and track your invoices
          </p>
        </div>
        <Button
          onClick={() => setIsRequestDialogOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Request Payment
        </Button>
      </div>

      {/* Available Balance Card */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">Available Balance</div>
            <div className="mt-1 text-3xl font-bold text-blue-600 dark:text-blue-400">
              ${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <Receipt className="h-12 w-12 text-blue-600 dark:text-blue-400 opacity-50" />
        </div>
      </div>

      {/* Invoices Table */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr className="text-left text-zinc-600 dark:text-zinc-400">
              <th className="p-4 font-medium">Invoice #</th>
              <th className="p-4 font-medium">Amount</th>
              <th className="p-4 font-medium">Payment Mode</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Remarks</th>
              <th className="p-4 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td className="p-4 text-center text-zinc-500" colSpan={6}>
                  No invoices yet. Click "Request Payment" to create your first invoice.
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="border-t border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                >
                  <td className="p-4 font-mono font-medium">{invoice.invoice_number}</td>
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
                  <td className="p-4 text-zinc-600 dark:text-zinc-400">{invoice.remarks || "-"}</td>
                  <td className="p-4 text-zinc-600 dark:text-zinc-400">
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRequestPayment} className="space-y-4">
            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
              <div className="text-sm text-zinc-600 dark:text-zinc-400">Available Balance</div>
              <div className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">
                ${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Amount *</label>
              <Input
                required
                type="number"
                step="0.01"
                min="0.01"
                max={availableBalance}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="Enter amount"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Mode of Payment *</label>
              <select
                required
                value={form.mode_of_payment}
                onChange={(e) => setForm({ ...form, mode_of_payment: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm"
              >
                <option value="">Select payment mode</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="PayPal">PayPal</option>
                <option value="GCash">GCash</option>
                <option value="Wise">Wise</option>
                <option value="Stripe">Stripe</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Remarks (Optional)</label>
              <Input
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                placeholder="Add any notes or comments"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRequestDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Create Invoice</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}



