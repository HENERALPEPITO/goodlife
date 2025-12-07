import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");

    if (!userId) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    // First, get the artist ID from the artists table
    const { data: artist, error: artistError } = await supabase
      .from("artists")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (artistError || !artist) {
      return NextResponse.json({ data: [] });
    }

    const { data, error } = await supabase
      .from("payment_requests")
      .select("*")
      .eq("artist_id", artist.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching payment requests:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Recalculate amounts from royalties_summary for requests with 0 amount
    const enrichedData = await Promise.all(
      (data || []).map(async (req) => {
        let amount = parseFloat(req.amount || "0");
        
        // If amount is 0, recalculate from royalties_summary
        if (amount === 0) {
          // Get total earnings from royalties_summary
          const { data: summaryData } = await supabase
            .from("royalties_summary")
            .select("total_net")
            .eq("artist_id", artist.id);

          const totalEarnings = (summaryData || []).reduce(
            (sum: number, row: any) => sum + parseFloat(row.total_net || "0"), 0
          );

          // Get already paid amounts from other payment requests
          const { data: paidRequests } = await supabase
            .from("payment_requests")
            .select("amount")
            .eq("artist_id", artist.id)
            .eq("status", "paid")
            .neq("id", req.id);

          const paidAmount = (paidRequests || []).reduce(
            (sum: number, pr: any) => sum + parseFloat(pr.amount || "0"), 0
          );

          amount = totalEarnings - paidAmount;

          // Update the payment request with the correct amount
          if (amount > 0) {
            await supabase
              .from("payment_requests")
              .update({ amount: amount })
              .eq("id", req.id);

            // Also update the invoice if it exists
            await supabase
              .from("invoices")
              .update({ amount: amount })
              .eq("payment_request_id", req.id);
          }
        }

        return { ...req, amount };
      })
    );

    return NextResponse.json({ data: enrichedData });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
