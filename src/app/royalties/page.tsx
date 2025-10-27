"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Edit, Trash2, Download, DollarSign } from "lucide-react";
import type { Royalty, PaymentRequest } from "@/types";
import jsPDF from "jspdf";

interface RoyaltyWithTrack extends Royalty {
  tracks?: { title: string } | null;
}

export default function RoyaltiesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [royalties, setRoyalties] = useState<RoyaltyWithTrack[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRoyalty, setEditingRoyalty] = useState<Royalty | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Royalty | null>(null);

  const [form, setForm] = useState({
    usage_count: 0,
    gross_amount: 0,
    admin_percent: 0,
    net_amount: 0,
    broadcast_date: "",
    exploitation_source_name: "",
    territory: "",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    } else if (user) {
      fetchRoyalties();
      fetchPaymentRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, router]);

  const fetchRoyalties = async () => {
    if (!user) return;

    try {
      setLoading(true);
      let query = supabase
        .from("royalties")
        .select("*, tracks(title)")
        .order("created_at", { ascending: false });

      // Artists only see their own royalties
      if (user.role === "artist") {
        query = query.eq("artist_id", user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRoyalties(data || []);
    } catch (error) {
      console.error("Error fetching royalties:", error);
      toast({
        title: "Error",
        description: "Failed to load royalties",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentRequests = async () => {
    if (!user) return;

    try {
      let query = supabase
        .from("payment_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (user.role === "artist") {
        query = query.eq("artist_id", user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setPaymentRequests(data || []);
    } catch (error) {
      console.error("Error fetching payment requests:", error);
    }
  };

  const handleEditRoyalty = async () => {
    if (!user || user.role !== "admin" || !editingRoyalty) return;

    try {
      const { error } = await supabase
        .from("royalties")
        .update({
          usage_count: form.usage_count,
          gross_amount: form.gross_amount,
          admin_percent: form.admin_percent,
          net_amount: form.net_amount,
          broadcast_date: form.broadcast_date || null,
          exploitation_source_name: form.exploitation_source_name || null,
          territory: form.territory || null,
        })
        .eq("id", editingRoyalty.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Royalty updated successfully",
      });

      setEditingRoyalty(null);
      fetchRoyalties();
    } catch (error) {
      console.error("Error updating royalty:", error);
      toast({
        title: "Error",
        description: "Failed to update royalty",
        variant: "destructive",
      });
    }
  };

  const handleDeleteRoyalty = async () => {
    if (!user || user.role !== "admin" || !deleteConfirm) return;

    try {
      const { error } = await supabase.from("royalties").delete().eq("id", deleteConfirm.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Royalty deleted successfully",
      });

      setDeleteConfirm(null);
      fetchRoyalties();
    } catch (error) {
      console.error("Error deleting royalty:", error);
      toast({
        title: "Error",
        description: "Failed to delete royalty",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (royalty: Royalty) => {
    setEditingRoyalty(royalty);
    setForm({
      usage_count: royalty.usage_count || 0,
      gross_amount: royalty.gross_amount || 0,
      admin_percent: royalty.admin_percent || 0,
      net_amount: royalty.net_amount || 0,
      broadcast_date: royalty.broadcast_date || "",
      exploitation_source_name: royalty.exploitation_source_name || "",
      territory: royalty.territory || "",
    });
  };

  const handleRequestPayment = async () => {
    if (!user || user.role !== "artist") return;

    // Calculate total available balance
    const totalRevenue = royalties.reduce((sum, r) => sum + Number(r.net_amount || 0), 0);
    const pendingRequests = paymentRequests
      .filter((pr) => pr.status === "pending")
      .reduce((sum, pr) => sum + Number(pr.amount || 0), 0);

    const availableBalance = totalRevenue - pendingRequests;

    if (availableBalance <= 0) {
      toast({
        title: "No funds available",
        description: "You don't have any available balance to request.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("payment_requests").insert({
        artist_id: user.id,
        amount: availableBalance,
        status: "pending",
      });

      if (error) throw error;

      toast({
        title: "Payment requested",
        description: `Successfully requested payment of $${availableBalance.toFixed(2)}`,
      });

      fetchPaymentRequests();
    } catch (error) {
      console.error("Error requesting payment:", error);
      toast({
        title: "Error",
        description: "Failed to request payment",
        variant: "destructive",
      });
    }
  };

  const handleApprovePayment = async (requestId: string) => {
    if (!user || user.role !== "admin") return;

    try {
      const { error } = await supabase
        .from("payment_requests")
        .update({ status: "approved" })
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Payment request approved",
      });

      fetchPaymentRequests();
    } catch (error) {
      console.error("Error approving payment:", error);
      toast({
        title: "Error",
        description: "Failed to approve payment",
        variant: "destructive",
      });
    }
  };

  const handleRejectPayment = async (requestId: string) => {
    if (!user || user.role !== "admin") return;

    try {
      const { error } = await supabase
        .from("payment_requests")
        .update({ status: "rejected" })
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Payment request rejected",
      });

      fetchPaymentRequests();
    } catch (error) {
      console.error("Error rejecting payment:", error);
      toast({
        title: "Error",
        description: "Failed to reject payment",
        variant: "destructive",
      });
    }
  };

  const exportToPDF = () => {
    const pdf = new jsPDF();
    pdf.text("Royalty Report", 14, 16);
    let y = 26;
    
    royalties.slice(0, 50).forEach((r) => {
      const trackTitle = r.tracks?.title || "Unknown";
      const text = `${trackTitle} | ${r.exploitation_source_name} | $${(r.net_amount || 0).toFixed(2)}`;
      pdf.text(text, 14, y);
      y += 8;
      if (y > 280) {
        pdf.addPage();
        y = 20;
      }
    });
    
    pdf.save("royalties_report.pdf");
  };

  const exportToCSV = () => {
    const headers = ["Track", "Source", "Territory", "Usage Count", "Gross", "Admin %", "Net", "Date"];
    const rows = royalties.map((r) => [
      r.tracks?.title || "Unknown",
      r.exploitation_source_name || "",
      r.territory || "",
      r.usage_count || 0,
      r.gross_amount || 0,
      r.admin_percent || 0,
      r.net_amount || 0,
      r.broadcast_date || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "royalties_export.csv";
    link.click();
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-zinc-500">Loading royalties...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isAdmin = user.role === "admin";
  const totalRevenue = royalties.reduce((sum, r) => sum + Number(r.net_amount || 0), 0);
  const totalStreams = royalties.reduce((sum, r) => sum + Number(r.usage_count || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
        <h1 className="text-2xl font-semibold">Royalties</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            {isAdmin ? "Manage all royalty records" : "View your earnings"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={exportToPDF}>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          {!isAdmin && (
            <Button onClick={handleRequestPayment} className="bg-green-600 hover:bg-green-700 text-white">
              <DollarSign className="h-4 w-4 mr-2" />
              Request Payment
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-950">
          <div className="text-sm text-zinc-500">Total Revenue</div>
          <div className="mt-1 text-2xl font-semibold">
            ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-950">
          <div className="text-sm text-zinc-500">Total Usage</div>
          <div className="mt-1 text-2xl font-semibold">{totalStreams.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-950">
          <div className="text-sm text-zinc-500">Total Records</div>
          <div className="mt-1 text-2xl font-semibold">{royalties.length}</div>
        </div>
      </section>

      {/* Payment Requests (for artists and admins) */}
      {paymentRequests.length > 0 && (
        <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6">
          <h2 className="text-lg font-semibold mb-4">Payment Requests</h2>
          <div className="space-y-3">
            {paymentRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-800"
              >
                <div>
                  <div className="font-medium">
                    ${Number(request.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    Requested on {new Date(request.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      request.status === "pending"
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                        : request.status === "approved"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                    }`}
                  >
                    {request.status}
                  </span>
                  {isAdmin && request.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleApprovePayment(request.id)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRejectPayment(request.id)}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
      </div>
        </section>
      )}

      {/* Royalties Table */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr className="text-left text-zinc-600 dark:text-zinc-400">
              <th className="p-4 font-medium">Track</th>
              <th className="p-4 font-medium">Source</th>
              <th className="p-4 font-medium">Territory</th>
              <th className="p-4 font-medium">Usage</th>
              <th className="p-4 font-medium">Gross</th>
              <th className="p-4 font-medium">Admin %</th>
              <th className="p-4 font-medium">Net</th>
              <th className="p-4 font-medium">Date</th>
              {isAdmin && <th className="p-4 font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {royalties.length === 0 ? (
              <tr>
                <td className="p-4 text-center text-zinc-500" colSpan={isAdmin ? 9 : 8}>
                  No royalties found
                </td>
              </tr>
            ) : (
              royalties.map((royalty) => (
                <tr
                  key={royalty.id}
                  className="border-t border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                >
                  <td className="p-4 font-medium">{royalty.tracks?.title || "Unknown"}</td>
                  <td className="p-4 text-zinc-600 dark:text-zinc-400">
                    {royalty.exploitation_source_name || "-"}
                  </td>
                  <td className="p-4 text-zinc-600 dark:text-zinc-400">{royalty.territory || "-"}</td>
                  <td className="p-4 text-zinc-600 dark:text-zinc-400">
                    {(royalty.usage_count || 0).toLocaleString()}
                  </td>
                  <td className="p-4 text-zinc-600 dark:text-zinc-400">
                    ${(royalty.gross_amount || 0).toFixed(2)}
                  </td>
                  <td className="p-4 text-zinc-600 dark:text-zinc-400">
                    {(royalty.admin_percent || 0).toFixed(1)}%
                  </td>
                  <td className="p-4 font-semibold text-green-600 dark:text-green-400">
                    ${(royalty.net_amount || 0).toFixed(2)}
                  </td>
                  <td className="p-4 text-zinc-600 dark:text-zinc-400">
                    {royalty.broadcast_date
                      ? new Date(royalty.broadcast_date).toLocaleDateString()
                      : "-"}
                  </td>
                  {isAdmin && (
                    <td className="p-4">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEditDialog(royalty)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDeleteConfirm(royalty)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingRoyalty} onOpenChange={(open) => !open && setEditingRoyalty(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Royalty</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Usage Count</label>
              <Input
                type="number"
                value={form.usage_count}
                onChange={(e) => setForm({ ...form, usage_count: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Gross Amount</label>
              <Input
                type="number"
                step="0.01"
                value={form.gross_amount}
                onChange={(e) => setForm({ ...form, gross_amount: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Admin %</label>
              <Input
                type="number"
                step="0.1"
                value={form.admin_percent}
                onChange={(e) => setForm({ ...form, admin_percent: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Net Amount</label>
              <Input
                type="number"
                step="0.01"
                value={form.net_amount}
                onChange={(e) => setForm({ ...form, net_amount: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Broadcast Date</label>
              <Input
                type="date"
                value={form.broadcast_date}
                onChange={(e) => setForm({ ...form, broadcast_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Source</label>
              <Input
                value={form.exploitation_source_name}
                onChange={(e) => setForm({ ...form, exploitation_source_name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Territory</label>
              <Input
                value={form.territory}
                onChange={(e) => setForm({ ...form, territory: e.target.value })}
              />
        </div>
      </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRoyalty(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditRoyalty}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Royalty</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Are you sure you want to delete this royalty record? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteRoyalty}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
