import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logRouteStart, logRouteEnd, logSupabaseQuery } from "@/lib/performanceLogger";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const { start, requestId } = logRouteStart("/api/data/royalties");
  
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");
    const role = searchParams.get("role");
    const year = searchParams.get("year");
    const quarter = searchParams.get("quarter");

    if (!userId) {
      logRouteEnd("/api/data/royalties", start, requestId);
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    // First, get the artist record from the artists table
    const q1 = performance.now();
    const { data: artistRecord, error: artistError } = await supabase
      .from("artists")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    logSupabaseQuery("artists", "SELECT id", q1, requestId);

    if (artistError || !artistRecord) {
      logRouteEnd("/api/data/royalties", start, requestId);
      return NextResponse.json({ data: [], quarters: [] });
    }

    const artistId = artistRecord.id;

    // If year and quarter are provided, get detailed track data for that quarter
    if (year && quarter) {
      const q2 = performance.now();
      const { data: summaryData, error: summaryError } = await supabase.rpc(
        "get_artist_royalties_summary",
        {
          _artist_id: artistId,
          _year: parseInt(year),
          _quarter: parseInt(quarter),
        }
      );
      logSupabaseQuery("royalties_summary", "RPC get_artist_royalties_summary", q2, requestId);

      if (summaryError) {
        console.error("Error fetching royalties summary:", summaryError);
        logRouteEnd("/api/data/royalties", start, requestId);
        return NextResponse.json({ error: summaryError.message }, { status: 500 });
      }

      // Transform summary data to match the expected frontend format
      const transformedData = (summaryData || []).map((item: any) => ({
        id: item.track_id,
        track_id: item.track_id,
        tracks: {
          title: item.track_title,
          composer_name: null, // Not available in summary
          isrc: null, // Not available in summary
        },
        broadcast_date: `${year}-${String((parseInt(quarter) - 1) * 3 + 2).padStart(2, "0")}-15`, // Mid-quarter date
        territory: item.top_territory || "Various",
        exploitation_source_name: item.top_platform || "Various",
        usage_count: item.total_streams,
        gross_amount: item.total_gross,
        admin_percent: item.total_gross && item.total_net 
          ? ((Number(item.total_gross) - Number(item.total_net)) / Number(item.total_gross) * 100).toFixed(2)
          : "0",
        net_amount: item.total_net,
        platform_distribution: item.platform_distribution,
        territory_distribution: item.territory_distribution,
        monthly_breakdown: item.monthly_breakdown,
        record_count: item.record_count,
      }));

      logRouteEnd("/api/data/royalties", start, requestId);
      return NextResponse.json({ 
        data: transformedData, 
        source: "royalties_summary",
        _perf: { requestId } 
      });
    }

    // Otherwise, get all available quarters with totals
    const q3 = performance.now();
    const { data: quartersData, error: quartersError } = await supabase.rpc(
      "get_artist_available_quarters",
      { _artist_id: artistId }
    );
    logSupabaseQuery("royalties_summary", "RPC get_artist_available_quarters", q3, requestId);

    if (quartersError) {
      console.error("Error fetching quarters:", quartersError);
      logRouteEnd("/api/data/royalties", start, requestId);
      return NextResponse.json({ error: quartersError.message }, { status: 500 });
    }

    // Transform quarters data to match frontend expectations
    const transformedQuarters = (quartersData || []).map((q: any) => ({
      year: q.year,
      quarter: q.quarter,
      total_tracks: q.total_tracks,
      total_streams: q.total_streams,
      total_revenue: q.total_revenue,
      total_net: q.total_net,
    }));

    logRouteEnd("/api/data/royalties", start, requestId);
    return NextResponse.json({ 
      data: [], 
      quarters: transformedQuarters,
      source: "royalties_summary",
      _perf: { requestId } 
    });
  } catch (error: any) {
    console.error("API Error:", error);
    logRouteEnd("/api/data/royalties", start, requestId);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
