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

    if (!userId) {
      logRouteEnd("/api/data/royalties", start, requestId);
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    // Build query - select all fields from royalties and join with tracks
    let query = supabase.from("royalties").select(`
      *,
      tracks:track_id (
        title,
        composer_name,
        isrc
      )
    `);

    // If artist, filter by their artist_id
    if (role === "artist") {
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
        return NextResponse.json({ data: [] });
      }

      // Filter by artist_id
      query = query.eq("artist_id", artistRecord.id);
    }

    // Order by broadcast_date descending (most recent first)
    query = query.order("broadcast_date", { ascending: false, nullsFirst: false });

    // Execute query
    const q2 = performance.now();
    const { data: royalties, error } = await query;
    logSupabaseQuery("royalties", "SELECT * with tracks join", q2, requestId);

    if (error) {
      console.error("Error fetching royalties:", error);
      logRouteEnd("/api/data/royalties", start, requestId);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    logRouteEnd("/api/data/royalties", start, requestId);
    return NextResponse.json({ data: royalties || [], _perf: { requestId } });
  } catch (error: any) {
    console.error("API Error:", error);
    logRouteEnd("/api/data/royalties", start, requestId);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
