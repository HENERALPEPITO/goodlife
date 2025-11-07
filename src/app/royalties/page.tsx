"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { RoyaltyStatement } from "@/types";
import jsPDF from "jspdf";

export default function RoyaltiesPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<string>("");

  async function load() {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Build query based on role - select all fields from royalties
      // Note: ISWC and composer may be in royalties table or need to join with tracks
      let query = supabase.from("royalties").select("*", { count: "exact" });

      // If artist, filter by their artist_id
      if (user.role === "artist") {
        // First, get the artist record from the artists table
        const { data: artistRecord, error: artistError } = await supabase
          .from("artists")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (artistError || !artistRecord) {
          setData([]);
          setTotal(0);
          setLoading(false);
          return;
        }

        // Filter by artist_id
        query = query.eq("artist_id", artistRecord.id);
      }

      // Filter by status (paid_status field)
      if (status === "paid") {
        query = query.eq("paid_status", "paid");
      } else if (status === "pending") {
        query = query.in("paid_status", ["unpaid", "pending"]);
      }

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      // Order by created_at descending
      query = query.order("created_at", { ascending: false });

      // Execute query
      const { data: royalties, error, count } = await query;

      if (error) {
        console.error("Error fetching royalties:", error);
        setData([]);
        setTotal(0);
        return;
      }

      // Transform data to match the table format
      const statements = (royalties || []).map((royalty) => {
        // Format date
        let dateStr = "N/A";
        if (royalty.broadcast_date) {
          const date = new Date(royalty.broadcast_date);
          dateStr = date.toLocaleDateString();
        }

        return {
          id: royalty.id,
          songTitle: royalty.track_title || royalty.song_title || "Unknown",
          source: royalty.exploitation_source_name || royalty.platform || "Unknown",
          territory: royalty.territory || "Unknown",
          usageCount: royalty.usage_count || 0,
          gross: Number(royalty.gross_amount || 0),
          adminPercent: Number(royalty.admin_percent || royalty.administration_percent || 0),
          net: Number(royalty.net_amount || 0),
          date: dateStr,
          iswc: royalty.iswc || royalty.tracks?.isrc || "—",
          composer: royalty.song_composers || royalty.composers || royalty.tracks?.composers || "—",
        };
      });

      setData(statements);
      setTotal(count || 0);
    } catch (error) {
      console.error("Error loading royalties:", error);
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) {
      load();
    }
  }, [user, page, status]);

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
              <th className="p-3">Song Title</th>
              <th className="p-3">Source</th>
              <th className="p-3">Territory</th>
              <th className="p-3">Usage Count</th>
              <th className="p-3">Gross</th>
              <th className="p-3">Admin %</th>
              <th className="p-3">Net</th>
              <th className="p-3">Date</th>
              <th className="p-3">ISWC</th>
              <th className="p-3">Composer</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-3" colSpan={10}>Loading...</td></tr>
            ) : data.length === 0 ? (
              <tr><td className="p-3" colSpan={10}>No data</td></tr>
            ) : (
              data.map((r: any) => (
                <tr key={r.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="p-3">{r.songTitle}</td>
                  <td className="p-3">{r.source}</td>
                  <td className="p-3">{r.territory}</td>
                  <td className="p-3">{r.usageCount.toLocaleString()}</td>
                  <td className="p-3">${r.gross.toFixed(2)}</td>
                  <td className="p-3">{r.adminPercent.toFixed(1)}%</td>
                  <td className="p-3">${r.net.toFixed(2)}</td>
                  <td className="p-3">{r.date}</td>
                  <td className="p-3">{r.iswc}</td>
                  <td className="p-3">{r.composer}</td>
                </tr>
              ))
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


