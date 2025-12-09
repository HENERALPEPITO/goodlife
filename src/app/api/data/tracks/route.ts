import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logRouteStart, logRouteEnd, logSupabaseQuery } from "@/lib/performanceLogger";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const { start, requestId } = logRouteStart("/api/data/tracks GET");
  
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");
    const role = searchParams.get("role");

    if (!userId) {
      logRouteEnd("/api/data/tracks GET", start, requestId);
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    let query = supabase.from("tracks").select("*").order("created_at", { ascending: false });

    // Artists only see their own tracks
    if (role === "artist") {
      query = query.eq("artist_id", userId);
    }

    const q1 = performance.now();
    const { data, error } = await query;
    logSupabaseQuery("tracks", "SELECT *", q1, requestId);

    if (error) {
      console.error("Error fetching tracks:", error);
      logRouteEnd("/api/data/tracks GET", start, requestId);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    logRouteEnd("/api/data/tracks GET", start, requestId);
    return NextResponse.json({ data: data || [], _perf: { requestId } });
  } catch (error: any) {
    console.error("API Error:", error);
    logRouteEnd("/api/data/tracks GET", start, requestId);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { artist_id, title, iswc, isrc, composers, release_date, platform, territory, split } = body;

    const { data, error } = await supabase.from("tracks").insert({
      artist_id,
      title,
      iswc: iswc || null,
      isrc: isrc || null,
      composers: composers || null,
      release_date: release_date || null,
      platform: platform || null,
      territory: territory || null,
      split: split || null,
    }).select().single();

    if (error) {
      console.error("Error adding track:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      id, 
      title, 
      iswc, 
      isrc, 
      composers, 
      release_date, 
      platform, 
      territory, 
      split,
      spotify_image_url,
      spotify_track_id,
      spotify_artist_name,
      spotify_track_name,
      spotify_fetched_at,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Build update object dynamically to only include provided fields
    const updateData: Record<string, any> = {};
    if (title !== undefined) updateData.title = title;
    if (iswc !== undefined) updateData.iswc = iswc || null;
    if (isrc !== undefined) updateData.isrc = isrc || null;
    if (composers !== undefined) updateData.composers = composers || null;
    if (release_date !== undefined) updateData.release_date = release_date || null;
    if (platform !== undefined) updateData.platform = platform || null;
    if (territory !== undefined) updateData.territory = territory || null;
    if (split !== undefined) updateData.split = split || null;
    if (spotify_image_url !== undefined) updateData.spotify_image_url = spotify_image_url;
    if (spotify_track_id !== undefined) updateData.spotify_track_id = spotify_track_id;
    if (spotify_artist_name !== undefined) updateData.spotify_artist_name = spotify_artist_name;
    if (spotify_track_name !== undefined) updateData.spotify_track_name = spotify_track_name;
    if (spotify_fetched_at !== undefined) updateData.spotify_fetched_at = spotify_fetched_at;

    const { data, error } = await supabase
      .from("tracks")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating track:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const deleteAll = searchParams.get("delete_all");

    if (deleteAll === "true") {
      const { error } = await supabase.from("tracks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      
      if (error) {
        console.error("Error deleting all tracks:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { error } = await supabase.from("tracks").delete().eq("id", id);

    if (error) {
      console.error("Error deleting track:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
