import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logRouteStart, logRouteEnd, logSupabaseQuery } from "@/lib/performanceLogger";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const { start, requestId } = logRouteStart("/api/data/artists-stats");
  
  try {
    // Fetch all artists
    const q1 = performance.now();
    const { data: artistProfiles, error: artistError } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("role", "artist")
      .order("created_at", { ascending: false });
    logSupabaseQuery("user_profiles", "SELECT * WHERE role=artist", q1, requestId);

    if (artistError) {
      console.error("Error fetching artist profiles:", artistError);
      logRouteEnd("/api/data/artists-stats", start, requestId);
      return NextResponse.json({ error: artistError.message }, { status: 500 });
    }

    // Fetch stats for each artist
    const artistsWithStats = await Promise.all(
      (artistProfiles || []).map(async (artist) => {
        // First, get the artist record from the artists table
        const q2 = performance.now();
        const { data: artistRecord, error: artistRecordError } = await supabase
          .from("artists")
          .select("id")
          .eq("user_id", artist.id)
          .maybeSingle();
        logSupabaseQuery("artists", `SELECT id for ${artist.email}`, q2, requestId);

        // If no artist record exists, return zeros
        if (artistRecordError || !artistRecord) {
          return {
            ...artist,
            totalTracks: 0,
            totalRevenue: 0,
            totalStreams: 0,
          };
        }

        const artistId = artistRecord.id;

        // Get track count using artists.id
        const q3 = performance.now();
        const { count: trackCount } = await supabase
          .from("tracks")
          .select("*", { count: "exact", head: true })
          .eq("artist_id", artistId);
        logSupabaseQuery("tracks", `COUNT for artist ${artistId}`, q3, requestId);

        // Get royalties using artists.id
        const q4 = performance.now();
        const { data: royalties } = await supabase
          .from("royalties")
          .select("net_amount, usage_count")
          .eq("artist_id", artistId);
        logSupabaseQuery("royalties", `SELECT for artist ${artistId}`, q4, requestId);

        const totalRevenue = royalties?.reduce(
          (sum, r) => sum + Number(r.net_amount || 0),
          0
        ) || 0;

        const totalStreams = royalties?.reduce(
          (sum, r) => sum + Number(r.usage_count || 0),
          0
        ) || 0;

        return {
          ...artist,
          totalTracks: trackCount || 0,
          totalRevenue,
          totalStreams,
        };
      })
    );

    logRouteEnd("/api/data/artists-stats", start, requestId);
    return NextResponse.json({ data: artistsWithStats, _perf: { requestId } });
  } catch (error: any) {
    console.error("API Error:", error);
    logRouteEnd("/api/data/artists-stats", start, requestId);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
