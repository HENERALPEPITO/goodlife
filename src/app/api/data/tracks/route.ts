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
    const { artist_id, title, iswc, composers, release_date, platform, territory } = body;

    const { data, error } = await supabase.from("tracks").insert({
      artist_id,
      title,
      iswc: iswc || null,
      composers: composers || null,
      release_date: release_date || null,
      platform: platform || null,
      territory: territory || null,
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
    const { id, title, iswc, composers, release_date, platform, territory } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("tracks")
      .update({
        title,
        iswc: iswc || null,
        composers: composers || null,
        release_date: release_date || null,
        platform: platform || null,
        territory: territory || null,
      })
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
