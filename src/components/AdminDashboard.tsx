"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Users, DollarSign, Music, FileUp, Upload } from "lucide-react";
import Link from "next/link";

interface AdminStats {
  totalArtists: number;
  totalRevenue: number;
  totalTracks: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats>({
    totalArtists: 0,
    totalRevenue: 0,
    totalTracks: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminStats();
  }, []);

  const fetchAdminStats = async () => {
    try {
      const { count: artistCount } = await supabase
        .from("user_profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "artist");

      const { count: trackCount } = await supabase
        .from("tracks")
        .select("*", { count: "exact", head: true });

      const { data: royalties } = await supabase
        .from("royalties")
        .select("net_amount");

      const totalRevenue = royalties?.reduce(
        (sum, r) => sum + Number(r.net_amount || 0),
        0
      ) || 0;

      setStats({
        totalArtists: artistCount || 0,
        totalRevenue,
        totalTracks: trackCount || 0,
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
      value: `€${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: "All time earnings",
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
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="transition-colors" style={{ color: 'var(--text-secondary)' }}>Loading admin dashboard...</div>
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
