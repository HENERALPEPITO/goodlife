"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Users, DollarSign, Music, FileUp } from "lucide-react";
import Link from "next/link";

interface AdminStats {
  totalArtists: number;
  totalRevenue: number;
  totalTracks: number;
  pendingPayments: number;
  pendingPaymentsCount: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats>({
    totalArtists: 0,
    totalRevenue: 0,
    totalTracks: 0,
    pendingPayments: 0,
    pendingPaymentsCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminStats();
  }, []);

  const fetchAdminStats = async () => {
    try {
      // Get total artists
      const { count: artistCount } = await supabase
        .from("user_profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "artist");

      // Get total tracks
      const { count: trackCount } = await supabase
        .from("tracks")
        .select("*", { count: "exact", head: true });

      // Get total revenue from royalties
      const { data: royalties } = await supabase
        .from("royalties")
        .select("net_amount");

      const totalRevenue = royalties?.reduce(
        (sum, r) => sum + Number(r.net_amount || 0),
        0
      ) || 0;

      // Get pending payment requests
      const { data: pendingRequests } = await supabase
        .from("payment_requests")
        .select("amount")
        .eq("status", "pending");

      const pendingPayments = pendingRequests?.reduce(
        (sum, r) => sum + Number(r.amount || 0),
        0
      ) || 0;

      setStats({
        totalArtists: artistCount || 0,
        totalRevenue,
        totalTracks: trackCount || 0,
        pendingPayments,
        pendingPaymentsCount: pendingRequests?.length || 0,
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const kpis = [
    {
      label: "Total Artists",
      value: stats.totalArtists.toString(),
      sub: "Active users",
      icon: Users,
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Total Revenue",
      value: `$${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: "All time earnings",
      icon: DollarSign,
      color: "text-green-600 dark:text-green-400",
    },
    {
      label: "Total Tracks",
      value: stats.totalTracks.toString(),
      sub: "In catalog",
      icon: Music,
      color: "text-purple-600 dark:text-purple-400",
    },
    {
      label: "Pending Payments",
      value: `$${stats.pendingPayments.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: `${stats.pendingPaymentsCount} requests`,
      icon: FileUp,
      color: "text-orange-600 dark:text-orange-400",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-500">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Welcome back! Manage your artists and royalties.
          </p>
        </div>
        <button
          onClick={fetchAdminStats}
          className="px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900"
        >
          Refresh
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

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href="/artists"
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
        >
          <Users className="h-8 w-8 text-blue-600 dark:text-blue-400 mb-3" />
          <h3 className="font-semibold mb-1">Manage Artists</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            View and manage artist accounts
          </p>
        </Link>

        <Link
          href="/royalty-uploader"
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
        >
          <FileUp className="h-8 w-8 text-green-600 dark:text-green-400 mb-3" />
          <h3 className="font-semibold mb-1">Upload CSV</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Import royalty data from CSV files
          </p>
        </Link>

        <Link
          href="/royalties"
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
        >
          <DollarSign className="h-8 w-8 text-purple-600 dark:text-purple-400 mb-3" />
          <h3 className="font-semibold mb-1">Manage Royalties</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            View and edit royalty records
          </p>
        </Link>
      </section>

      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 bg-white dark:bg-zinc-950">
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span>System ready for CSV uploads</span>
          </div>
          <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            <span>{stats.totalArtists} artists registered</span>
          </div>
          <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400">
            <span className="h-2 w-2 rounded-full bg-orange-500" />
            <span>{stats.pendingPaymentsCount} pending payment requests</span>
          </div>
        </div>
      </section>
    </div>
  );
}




