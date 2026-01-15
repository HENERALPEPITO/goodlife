"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Users, DollarSign, Music, FileUp, Upload } from "lucide-react";
import Link from "next/link";

interface AdminStats {
  totalArtists: number;
  totalRevenue: number;
  totalTracks: number;
  totalStreams: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats>({
    totalArtists: 0,
    totalRevenue: 0,
    totalTracks: 0,
    totalStreams: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminStats();
  }, []);

  const fetchAdminStats = async () => {
    try {
      // First try the new summary-based RPC (from royalties_summary table)
      const [artistResult, trackResult, summaryTotals] = await Promise.all([
        supabase
          .from("user_profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "artist"),
        supabase
          .from("tracks")
          .select("*", { count: "exact", head: true }),
        // Use new RPC from royalties_summary table for fast aggregation
        supabase.rpc("get_admin_royalties_totals")
      ]);

      // Check if summary RPC succeeded (table exists and has data)
      let totals = { total_net: 0, total_streams: 0, total_revenue: 0 };
      
      if (summaryTotals.error) {
        // Fall back to old RPC if summary table doesn't exist yet
        console.warn("Summary table not available, falling back to old RPC:", summaryTotals.error.message);
        const oldTotals = await supabase.rpc("get_royalty_totals");
        if (oldTotals.data?.[0]) {
          totals = {
            total_net: oldTotals.data[0].total_revenue || 0,
            total_streams: oldTotals.data[0].total_usage || 0,
            total_revenue: oldTotals.data[0].total_revenue || 0,
          };
        }
      } else if (summaryTotals.data?.[0]) {
        // Use summary table data
        totals = summaryTotals.data[0];
        console.log('[Admin Dashboard] Using royalties_summary table:', totals);
      }

      const parsedNet = parseFloat(String(totals.total_net || totals.total_revenue || 0));
      const parsedStreams = parseInt(String(totals.total_streams || 0), 10);

      setStats({
        totalArtists: artistResult.count || 0,
        totalRevenue: parsedNet,
        totalTracks: trackResult.count || 0,
        totalStreams: parsedStreams,
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
      color: "#60A5FA",
    },
    {
      label: "Total Revenue",
      value: `$${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: "Total Earnings",
      icon: DollarSign,
      color: "#4ADE80",
    },
    {
      label: "Total Tracks",
      value: stats.totalTracks.toString(),
      sub: "In catalog",
      icon: Music,
      color: "#A78BFA",
    },
    {
      label: "Total Streams",
      value: stats.totalStreams.toLocaleString(),
      sub: "All platforms",
      icon: Music,
      color: "#FB923C",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="mb-8">
        <h2 className="text-2xl font-semibold mb-2 transition-colors" style={{ color: 'var(--text-primary)' }}>Admin Dashboard</h2>
        <p className="transition-colors" style={{ color: 'var(--text-secondary)' }}>Welcome back! Manage your artists and royalties.</p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="backdrop-blur-md rounded-2xl p-6 transition-all duration-200 hover:scale-[1.02] cursor-default"
              style={{
                backgroundColor: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                boxShadow: '0 8px 32px 0 var(--shadow)',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-medium transition-colors" style={{ color: 'var(--text-secondary)' }}>{kpi.label}</div>
                <Icon className="h-5 w-5" style={{ color: kpi.color }} />
              </div>
              <div className="text-3xl font-semibold mb-1 transition-colors" style={{ color: 'var(--text-primary)' }}>{kpi.value}</div>
              <div className="text-xs transition-colors" style={{ color: 'var(--text-muted)' }}>{kpi.sub}</div>
            </div>
          );
        })}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Link
          href="/artists"
          className="backdrop-blur-md rounded-2xl p-6 transition-all duration-200 hover:scale-[1.02] block"
          style={{
            backgroundColor: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            boxShadow: '0 8px 32px 0 var(--shadow)',
          }}
        >
          <Users className="h-8 w-8 mb-3" style={{ color: 'var(--accent-blue)' }} />
          <h3 className="font-semibold mb-1 transition-colors" style={{ color: 'var(--text-primary)' }}>Manage Artists</h3>
          <p className="text-sm transition-colors" style={{ color: 'var(--text-secondary)' }}>
            View and manage artist accounts
          </p>
        </Link>

        <Link
          href="/admin/artist-tracks"
          className="backdrop-blur-md rounded-2xl p-6 transition-all duration-200 hover:scale-[1.02] block"
          style={{
            backgroundColor: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            boxShadow: '0 8px 32px 0 var(--shadow)',
          }}
        >
          <Upload className="h-8 w-8 mb-3" style={{ color: 'var(--accent-blue)' }} />
          <h3 className="font-semibold mb-1 transition-colors" style={{ color: 'var(--text-primary)' }}>Upload Track Catalog</h3>
          <p className="text-sm transition-colors" style={{ color: 'var(--text-secondary)' }}>
            Upload artist track catalogs (Song Title, ISRC, etc.)
          </p>
        </Link>

        <Link
          href="/royalty-uploader"
          className="backdrop-blur-md rounded-2xl p-6 transition-all duration-200 hover:scale-[1.02] block"
          style={{
            backgroundColor: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            boxShadow: '0 8px 32px 0 var(--shadow)',
          }}
        >
          <FileUp className="h-8 w-8 mb-3" style={{ color: 'var(--accent-blue)' }} />
          <h3 className="font-semibold mb-1 transition-colors" style={{ color: 'var(--text-primary)' }}>Upload Royalties</h3>
          <p className="text-sm transition-colors" style={{ color: 'var(--text-secondary)' }}>
            Import royalty payment data from CSV files
          </p>
        </Link>

        <Link
          href="/royalties"
          className="backdrop-blur-md rounded-2xl p-6 transition-all duration-200 hover:scale-[1.02] block"
          style={{
            backgroundColor: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            boxShadow: '0 8px 32px 0 var(--shadow)',
          }}
        >
          <DollarSign className="h-8 w-8 mb-3" style={{ color: 'var(--accent-blue)' }} />
          <h3 className="font-semibold mb-1 transition-colors" style={{ color: 'var(--text-primary)' }}>Manage Royalties</h3>
          <p className="text-sm transition-colors" style={{ color: 'var(--text-secondary)' }}>
            View and edit royalty records
          </p>
        </Link>
      </section>

      <section 
        className="backdrop-blur-md rounded-2xl p-6 transition-all duration-200"
        style={{
          backgroundColor: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 8px 32px 0 var(--shadow)',
        }}
      >
        <h2 className="text-lg font-semibold mb-4 transition-colors" style={{ color: 'var(--text-primary)' }}>Recent Activity</h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3 transition-colors" style={{ color: 'var(--text-secondary)' }}>
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span>System ready for CSV uploads</span>
          </div>
          <div className="flex items-center gap-3 transition-colors" style={{ color: 'var(--text-secondary)' }}>
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            <span>{stats.totalArtists} artists registered</span>
          </div>
        </div>
      </section>
    </div>
  );
}
