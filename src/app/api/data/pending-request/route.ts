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
      return NextResponse.json({ hasPendingRequest: false, artistId: null });
    }

    // Check if there's a pending or approved request
    const { data, error } = await supabase
      .from("payment_requests")
      .select("id")
      .eq("artist_id", artist.id)
      .in("status", ["pending", "approved"])
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error checking pending request:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ hasPendingRequest: !!data, artistId: artist.id });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
