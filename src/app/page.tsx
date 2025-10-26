"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight, Music2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalStreams: 0,
    activeTracks: 0,
    pendingPayouts: 0,
    pendingCount: 0
  });

  const fetchStats = async () => {
    try {
      // Get total revenue and streams
      const { data: royalties, error: royaltiesError } = await supabase
        .from('royalty_statements')
        .select('revenue_usd, streams');
      
      console.log('Royalties data:', royalties);
      
      if (royaltiesError) {
        console.error('Error fetching royalties:', royaltiesError);
      }
      
      const totalRevenue = royalties?.reduce((sum, r) => sum + Number(r.revenue_usd || 0), 0) || 0;
      const totalStreams = royalties?.reduce((sum, r) => sum + Number(r.streams || 0), 0) || 0;

      console.log('Total Revenue:', totalRevenue);
      console.log('Total Streams:', totalStreams);

      // Get active tracks count
      const { count: tracksCount } = await supabase
        .from('tracks')
        .select('*', { count: 'exact', head: true });

      // Get pending payouts
      const { data: pending } = await supabase
        .from('royalty_statements')
        .select('revenue_usd')
        .eq('status', 'pending');
      
      const pendingPayouts = pending?.reduce((sum, r) => sum + Number(r.revenue_usd || 0), 0) || 0;

      setStats({
        totalRevenue,
        totalStreams,
        activeTracks: tracksCount || 0,
        pendingPayouts,
        pendingCount: pending?.length || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const kpis = [
    { label: "Total Revenue", value: `$${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: "All time" },
    { label: "Total Streams", value: stats.totalStreams.toLocaleString(), sub: "All platforms" },
    { label: "Active Tracks", value: stats.activeTracks.toString(), sub: "In catalog" },
    { label: "Pending Payouts", value: `$${stats.pendingPayouts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: `${stats.pendingCount} requests` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Overview</h1>
        <button 
          onClick={fetchStats}
          className="px-3 py-2 text-sm rounded border hover:bg-zinc-100 dark:hover:bg-zinc-900"
        >
          Refresh Stats
        </button>
      </div>
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-950">
            <div className="text-sm text-zinc-500">{kpi.label}</div>
            <div className="mt-2 text-2xl font-semibold">{kpi.value}</div>
            <div className="text-xs text-zinc-500 mt-1">{kpi.sub}</div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-950 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Revenue Overview</h2>
            <button className="text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 inline-flex items-center gap-1">
              View details <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
          <div className="h-64 grid place-items-center text-zinc-400">
            Chart placeholder
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-950">
          <h2 className="text-sm font-medium">Recent Activity</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {[
              "Uploaded: Sunrise (feat. Ella)",
              "Payout processed: $1,240 to Indie Label Co.",
              "Catalog edit: Ocean Drive metadata updated",
              "New manager invited: alex@groove.agency",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
