"use client";
import { useEffect, useState } from "react";
import { RoyaltyStatement } from "@/types";
import jsPDF from "jspdf";

export default function RoyaltiesPage() {
  const [data, setData] = useState<RoyaltyStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<string>("");

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (status) params.set("status", status);
    const res = await fetch(`/api/royalties?${params.toString()}`);
    const json = await res.json();
    setData(json.data);
    setTotal(json.total);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [page, status]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Royalties</h1>
        <div className="flex gap-2">
          <a className="px-3 py-2 text-sm rounded border hover:bg-zinc-100 dark:hover:bg-zinc-900" href={`/api/royalties/export?status=${status}`} target="_blank">Export CSV</a>
          <button className="px-3 py-2 text-sm rounded border hover:bg-zinc-100 dark:hover:bg-zinc-900" onClick={() => {
            const pdf = new jsPDF();
            pdf.text("Royalties Report", 14, 16);
            let y = 26;
            data.slice(0, 20).forEach((r) => {
              pdf.text(`${r.trackTitle} | ${r.platform} | ${r.period} | $${r.revenueUsd}`, 14, y);
              y += 8;
              if (y > 280) { pdf.addPage(); y = 20; }
            });
            pdf.save("royalties_report.pdf");
          }}>Export PDF</button>
        </div>
      </div>

      <div className="flex gap-3">
        <select className="px-3 py-2 rounded border bg-transparent" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">All</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-500">
            <tr>
              <th className="p-3">Track</th>
              <th className="p-3">Platform</th>
              <th className="p-3">Period</th>
              <th className="p-3">Streams</th>
              <th className="p-3">Revenue (USD)</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-3" colSpan={6}>Loading...</td></tr>
            ) : data.length === 0 ? (
              <tr><td className="p-3" colSpan={6}>No data</td></tr>
            ) : (
              <>
                {data.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="p-3">{r.trackTitle}</td>
                    <td className="p-3">{r.platform}</td>
                    <td className="p-3">{r.period}</td>
                    <td className="p-3">{r.streams.toLocaleString()}</td>
                    <td className="p-3">${r.revenueUsd.toLocaleString()}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs ${r.status === "paid" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"}`}>{r.status}</span>
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-zinc-300 dark:border-zinc-700 font-semibold bg-zinc-50 dark:bg-zinc-900">
                  <td className="p-3" colSpan={3}>Total</td>
                  <td className="p-3">{data.reduce((sum, r) => sum + r.streams, 0).toLocaleString()}</td>
                  <td className="p-3">${data.reduce((sum, r) => sum + r.revenueUsd, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="p-3"></td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-500">Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</span>
        <div className="flex gap-2">
          <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-2 text-sm rounded border disabled:opacity-50">Prev</button>
          <button disabled={page >= Math.ceil(total / pageSize)} onClick={() => setPage((p) => p + 1)} className="px-3 py-2 text-sm rounded border disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>
  );
}


