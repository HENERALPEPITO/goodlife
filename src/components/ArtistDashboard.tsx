"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { DollarSign, Music, TrendingUp, FileText } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/ui/use-toast";

interface ArtistStats {
  totalRevenue: number;
  pendingRevenue: number;
  totalTracks: number;
  totalStreams: number;
}

export default function ArtistDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<ArtistStats>({
    totalRevenue: 0,
    pendingRevenue: 0,
    totalTracks: 0,
    totalStreams: 0,
  });
  const [loading, setLoading] = useState(true);
  const [requestingPayment, setRequestingPayment] = useState(false);

  useEffect(() => {
    if (user) {
      fetchArtistStats();
    }
  }, [user]);

  const fetchArtistStats = async () => {
    if (!user) return;

    try {
      // Get artist's tracks
      const { count: trackCount } = await supabase
        .from("tracks")
        .select("*", { count: "exact", head: true })
        .eq("artist_id", user.id);

      // Get artist's royalties
      const { data: royalties } = await supabase
        .from("royalties")
        .select("net_amount, usage_count")
        .eq("artist_id", user.id);

      const totalRevenue = royalties?.reduce(
        (sum, r) => sum + Number(r.net_amount || 0),
        0
      ) || 0;

      const totalStreams = royalties?.reduce(
        (sum, r) => sum + Number(r.usage_count || 0),
        0
      ) || 0;

      // Get pending payment requests
      const { data: pendingRequests } = await supabase
        .from("payment_requests")
        .select("amount")
        .eq("artist_id", user.id)
        .eq("status", "pending");

      const pendingRevenue = pendingRequests?.reduce(
        (sum, r) => sum + Number(r.amount || 0),
        0
      ) || 0;

      setStats({
        totalRevenue,
        pendingRevenue,
        totalTracks: trackCount || 0,
        totalStreams,
      });
    } catch (error) {
      console.error("Error fetching artist stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPayment = async () => {
    if (!user) return;

    setRequestingPayment(true);
    try {
      // Calculate available balance (total revenue - pending requests)
      const availableBalance = stats.totalRevenue - stats.pendingRevenue;

      if (availableBalance <= 0) {
        toast({
          title: "No funds available",
          description: "You don't have any available balance to request.",
          variant: "destructive",
        });
        return;
      }

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

      // Refresh stats
      await fetchArtistStats();
    } catch (error) {
      console.error("Error requesting payment:", error);
      toast({
        title: "Error",
        description: "Failed to request payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRequestingPayment(false);
    }
  };

  const kpis = [
    {
      label: "Total Revenue",
      value: `$${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: "All time earnings",
      icon: DollarSign,
      color: "text-green-600 dark:text-green-400",
    },
    {
      label: "Available Balance",
      value: `$${(stats.totalRevenue - stats.pendingRevenue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: "Ready to withdraw",
      icon: TrendingUp,
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Total Streams",
      value: stats.totalStreams.toLocaleString(),
      sub: "All platforms",
      icon: TrendingUp,
      color: "text-purple-600 dark:text-purple-400",
    },
    {
      label: "Active Tracks",
      value: stats.totalTracks.toString(),
      sub: "In catalog",
      icon: Music,
      color: "text-orange-600 dark:text-orange-400",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-500">Loading your dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Artist Dashboard</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Welcome back, {user?.email}!
          </p>
        </div>
        <button
          onClick={handleRequestPayment}
          disabled={requestingPayment || stats.totalRevenue - stats.pendingRevenue <= 0}
          className="px-4 py-2 text-sm rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {requestingPayment ? "Processing..." : "Request Payment"}
        </button>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 bg-white dark:bg-zinc-950"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm text-zinc-500">{kpi.label}</div>
                <Icon className={`h-5 w-5 ${kpi.color}`} />
              </div>
              <div className="mt-2 text-3xl font-semibold">{kpi.value}</div>
              <div className="text-xs text-zinc-500 mt-1">{kpi.sub}</div>
            </div>
          );
        })}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/analytics"
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
        >
          <TrendingUp className="h-8 w-8 text-blue-600 dark:text-blue-400 mb-3" />
          <h3 className="font-semibold mb-1">Analytics</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            View detailed performance metrics
          </p>
        </Link>

        <Link
          href="/royalties"
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
        >
          <FileText className="h-8 w-8 text-green-600 dark:text-green-400 mb-3" />
          <h3 className="font-semibold mb-1">Royalties</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            View your royalty statements
          </p>
        </Link>

        <Link
          href="/catalog"
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
        >
          <Music className="h-8 w-8 text-purple-600 dark:text-purple-400 mb-3" />
          <h3 className="font-semibold mb-1">Catalog</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Browse your track catalog
          </p>
        </Link>
      </section>

      {stats.pendingRevenue > 0 && (
        <section className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 p-6">
          <h2 className="text-lg font-semibold mb-2 text-orange-900 dark:text-orange-100">
            Pending Payment Request
          </h2>
          <p className="text-sm text-orange-700 dark:text-orange-300">
            You have a pending payment request of ${stats.pendingRevenue.toFixed(2)}. 
            Your admin will review and process it soon.
          </p>
        </section>
      )}
    </div>
  );
}




