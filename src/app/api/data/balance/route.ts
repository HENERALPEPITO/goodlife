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

    // First, get the artist ID and advance_payment from the artists table
    const q1 = performance.now();
    const { data: artist, error: artistError } = await supabase
      .from("artists")
      .select("id, advance_payment")
      .eq("user_id", userId)
      .maybeSingle();
    logSupabaseQuery("artists", "SELECT id, advance_payment", q1, requestId);

    if (artistError || !artist) {
      logRouteEnd("/api/data/balance", start, requestId);
      return NextResponse.json({ balance: 0, artistId: null, _perf: { requestId } });
    }

    // Fetch totals from royalties_summary table
    const q2 = performance.now();
    const { data: summaryData, error: summaryError } = await supabase
      .from("royalties_summary")
      .select("total_net, total_gross")
      .eq("artist_id", artist.id);
    logSupabaseQuery("royalties_summary", "SELECT total_net, total_gross", q2, requestId);

    if (summaryError) {
      console.error("Error fetching balance from royalties_summary:", summaryError);
      logRouteEnd("/api/data/balance", start, requestId);
      return NextResponse.json({ error: summaryError.message }, { status: 500 });
    }

    // Sum up all totals from royalties_summary
    const totals = (summaryData || []).reduce(
      (acc, row) => ({
        total_net: acc.total_net + parseFloat(row.total_net || "0"),
        total_gross: acc.total_gross + parseFloat(row.total_gross || "0"),
      }),
      { total_net: 0, total_gross: 0 }
    );

    // Get paid amounts from payment_requests to calculate available balance
    const q3 = performance.now();
    const { data: paidRequests } = await supabase
      .from("payment_requests")
      .select("amount")
      .eq("artist_id", artist.id)
      .eq("status", "paid");
    logSupabaseQuery("payment_requests", "SELECT amount WHERE paid", q3, requestId);

    const paidAmount = (paidRequests || []).reduce(
      (sum, req) => sum + parseFloat(req.amount || "0"),
      0
    );

    // Available balance = total net earnings - paid amounts
    const availableBalance = totals.total_net - paidAmount;

    logRouteEnd("/api/data/balance", start, requestId);
    return NextResponse.json({
      balance: availableBalance, // Allow negative balances for advance payments
      totalGross: totals.total_gross,
      totalNet: totals.total_net,
      paidAmount: paidAmount,
      artistId: artist.id,
      advancePayment: artist.advance_payment || 0,
      _perf: { requestId }
    });
  } catch (error: any) {
    console.error("API Error:", error);
    logRouteEnd("/api/data/balance", start, requestId);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
