import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logRouteStart, logRouteEnd, logSupabaseQuery } from "@/lib/performanceLogger";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const { start, requestId } = logRouteStart("/api/data/balance");
  
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");

    if (!userId) {
      logRouteEnd("/api/data/balance", start, requestId);
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    // First, get the artist ID from the artists table
    const q1 = performance.now();
    const { data: artist, error: artistError } = await supabase
      .from("artists")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    logSupabaseQuery("artists", "SELECT id", q1, requestId);

    if (artistError || !artist) {
      logRouteEnd("/api/data/balance", start, requestId);
      return NextResponse.json({ balance: 0, artistId: null, _perf: { requestId } });
    }

    // Use database function for precise calculation
    const q2 = performance.now();
    const { data: totalsData, error } = await supabase
      .rpc("get_artist_royalty_totals", { p_artist_id: artist.id });
    logSupabaseQuery("royalties", "RPC get_artist_royalty_totals", q2, requestId);

    if (error) {
      console.error("Error fetching balance:", error);
      // Fallback to manual calculation if function doesn't exist
      const { data: royaltiesData, error: fallbackError } = await supabase
        .from("royalties")
        .select("net_amount")
        .eq("artist_id", artist.id)
        .eq("is_paid", false);
      
      if (fallbackError) {
        logRouteEnd("/api/data/balance", start, requestId);
        return NextResponse.json({ error: fallbackError.message }, { status: 500 });
      }
      
      const total = (royaltiesData || []).reduce((sum, royalty) => {
        return sum + parseFloat(royalty.net_amount || "0");
      }, 0);
      
      logRouteEnd("/api/data/balance", start, requestId);
      return NextResponse.json({ balance: total, artistId: artist.id, _perf: { requestId } });
    }

    // Use the precise calculation from database
    const result = totalsData?.[0] || { unpaid_balance: 0, total_gross: 0, total_net: 0 };

    logRouteEnd("/api/data/balance", start, requestId);
    return NextResponse.json({ 
      balance: parseFloat(result.unpaid_balance) || 0,
      totalGross: parseFloat(result.total_gross) || 0,
      totalNet: parseFloat(result.total_net) || 0,
      artistId: artist.id, 
      _perf: { requestId } 
    });
  } catch (error: any) {
    console.error("API Error:", error);
    logRouteEnd("/api/data/balance", start, requestId);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
