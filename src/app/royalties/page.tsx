"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { RoyaltyStatement } from "@/types";
import jsPDF from "jspdf";
import { Download, FileText, ChevronLeft, ChevronRight } from "lucide-react";

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
    <div className="space-y-6 p-6" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Royalties</h1>
          <p className="text-sm text-gray-600 mt-1">View and manage your royalty statements</p>
        </div>
        <div className="flex gap-3">
          {user?.role === "artist" && (
            <a 
              href="/artist/payment-request" 
              className="px-4 py-2 text-sm font-medium rounded-lg border border-green-600 bg-green-600 text-white hover:bg-green-700 transition-all duration-200 ease-in-out"
            >
              Request Payment
            </a>
          )}
          <a 
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200 ease-in-out flex items-center gap-2" 
            href={`/api/royalties/export?status=${status}`} 
            target="_blank"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </a>
          <button 
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200 ease-in-out flex items-center gap-2" 
            onClick={() => {
              const pdf = new jsPDF();
              pdf.text("Royalties Report", 14, 16);
              let y = 26;
              data.slice(0, 20).forEach((r) => {
                pdf.text(`${r.songTitle} | ${r.source} | ${r.date} | $${r.net.toFixed(2)}`, 14, y);
                y += 8;
                if (y > 280) { pdf.addPage(); y = 20; }
              });
              pdf.save("royalties_report.pdf");
            }}
          >
            <FileText className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="flex gap-3">
        <select 
          className="px-4 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" 
          value={status} 
          onChange={(e) => { setPage(1); setStatus(e.target.value); }}
        >
          <option value="">All Status</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Song Title</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Territory</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Usage Count</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Gross</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Admin %</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Net</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">ISWC</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Composer</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-gray-600" colSpan={10}>
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
                        <span className="ml-2">Loading...</span>
                      </div>
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-gray-600" colSpan={10}>No royalties found</td>
                  </tr>
                ) : (
                  data.map((r: any, index: number) => (
                    <tr 
                      key={r.id} 
                      className={`transition-all duration-200 ease-in-out hover:bg-blue-50 ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-3 text-gray-800">{r.songTitle}</td>
                      <td className="px-4 py-3 text-gray-800">{r.source}</td>
                      <td className="px-4 py-3 text-gray-800">{r.territory}</td>
                      <td className="px-4 py-3 text-gray-800">{r.usageCount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-gray-800 font-medium">€{r.gross.toFixed(2)}</td>
                      <td className="px-4 py-3 text-gray-600">{r.adminPercent.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right text-gray-800 font-semibold">€{r.net.toFixed(2)}</td>
                      <td className="px-4 py-3 text-gray-600">{r.date}</td>
                      <td className="px-4 py-3 text-gray-600">{r.iswc}</td>
                      <td className="px-4 py-3 text-gray-600">{r.composer}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <span className="text-sm text-gray-600">Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</span>
        <div className="flex gap-2">
          <button 
            disabled={page === 1} 
            onClick={() => setPage((p) => Math.max(1, p - 1))} 
            className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ease-in-out flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </button>
          <button 
            disabled={page >= Math.ceil(total / pageSize)} 
            onClick={() => setPage((p) => p + 1)} 
            className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ease-in-out flex items-center gap-1"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}


