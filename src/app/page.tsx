import { Suspense } from "react";
import { ArrowUpRight, Music2 } from "lucide-react";

export default function Home() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Overview</h1>
      </div>
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "Total Revenue", value: "$124,320", sub: "+8.2% QoQ" },
          { label: "Active Tracks", value: "238", sub: "+12 this month" },
          { label: "Quarterly Growth", value: "18.4%", sub: "vs last quarter" },
          { label: "Pending Payouts", value: "$6,730", sub: "12 requests" },
        ].map((kpi) => (
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
