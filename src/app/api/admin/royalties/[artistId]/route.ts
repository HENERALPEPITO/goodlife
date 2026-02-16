/**
 * GET /api/admin/royalties/:artistId
 * 
 * Fetch all royalty records for a specific artist
 * Admin-only endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ artistId: string }> }
): Promise<NextResponse> {
  try {
    const artistId = (await params).artistId;

    // Create Supabase client for auth check
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const response = NextResponse.next();

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    // Get user session and check role
    let user = null;
    const authHeader = request.headers.get('Authorization');

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

      if (!authError && authUser) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", authUser.id)
          .single();

        if (profile) {
          user = {
            id: authUser.id,
            email: authUser.email || profile.email,
            role: profile.role as string,
          };
        }
      }
    }

    // If no user from token, try to get session from cookies
    if (!user) {
      await supabase.auth.getUser();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (!sessionError && session?.user) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (profile) {
          user = {
            id: session.user.id,
            email: session.user.email || profile.email,
            role: profile.role as string,
          };
        }
      }
    }

    if (!user) {
      console.log("No user found in GET /api/admin/royalties/:artistId - cookies:", request.cookies.getAll().map(c => c.name));
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin
    if (user.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    // Use admin client to fetch royalties for the artist
    let adminClient;
    try {
      adminClient = getSupabaseAdmin();
    } catch (adminError) {
      console.error("Failed to initialize admin client:", adminError);
      return NextResponse.json(
        { error: "Server configuration error - admin client unavailable" },
        { status: 500 }
      );
    }

    // Fetch artist's advance_payment
    const { data: artistData, error: artistError } = await adminClient
      .from("artists")
      .select("advance_payment")
      .eq("id", artistId)
      .single();

    if (artistError) {
      console.error("Error fetching artist data:", artistError);
    }

    const advancePayment = artistData?.advance_payment || 0;

    // Fetch from royalties_summary with track info
    const { data: summaries, error, count } = await adminClient
      .from("royalties_summary")
      .select(`
        *,
        tracks:track_id (
          title,
          composer_name,
          isrc
        )
      `, { count: "exact" })
      .eq("artist_id", artistId)
      .order("year", { ascending: false })
      .order("quarter", { ascending: false });

    if (error) {
      console.error("Error fetching royalties_summary for artist", artistId, ":");
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      return NextResponse.json(
        { error: "Failed to fetch royalties summary", details: error.message, code: error.code },
        { status: 500 }
      );
    }

    // Calculate totals from summary data
    let totalGross = 0;
    let totalNet = 0;
    let totalRecords = 0;

    (summaries || []).forEach((s: any) => {
      totalGross += parseFloat(s.total_gross || 0);
      totalNet += parseFloat(s.total_net || 0);
      totalRecords += s.record_count || 0;
    });

    // Transform summary data to display format
    // Group by quarter for display
    const transformedData = (summaries || []).map((summary: any) => ({
      id: summary.id,
      track_id: summary.track_id,
      artist_id: summary.artist_id,
      year: summary.year,
      quarter: summary.quarter,
      track_title: summary.tracks?.title || null,
      composer_name: summary.tracks?.composer_name || null,
      isrc: summary.tracks?.isrc || null,
      total_streams: summary.total_streams,
      total_revenue: summary.total_revenue,
      total_gross: summary.total_gross,
      total_net: summary.total_net,
      avg_per_stream: summary.avg_per_stream,
      top_platform: summary.top_platform,
      top_territory: summary.top_territory,
      record_count: summary.record_count,
      platform_distribution: summary.platform_distribution,
      territory_distribution: summary.territory_distribution,
      // Create a synthetic broadcast_date for quarter grouping in frontend
      broadcast_date: `${summary.year}-${String((summary.quarter - 1) * 3 + 1).padStart(2, '0')}-01`,
      // Map to old field names for compatibility
      gross_amount: summary.total_gross,
      net_amount: summary.total_net,
      usage_count: summary.total_streams,
      exploitation_source_name: summary.top_platform,
      territory: summary.top_territory,
      admin_percent: 0, // Not tracked in summary
    }));

    // Return summary data + totals
    return NextResponse.json({
      data: transformedData,
      total: count || 0,
      totals: {
        totalGross: String(totalGross.toFixed(2)),
        totalNet: String(totalNet.toFixed(2)),
        recordCount: totalRecords
      },
      advancePayment: String(advancePayment)
    }, { status: 200 });
  } catch (error) {
    console.error("Error in admin royalties artist endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
