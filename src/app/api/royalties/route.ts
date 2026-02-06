/**
 * Royalties API Route
 * GET /api/royalties
 * 
 * Returns royalty statements with pagination and filtering
 * - Artists see only their own royalties
 * - Admins see all royalties
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { RoyaltyStatement } from "@/types";

interface RoyaltiesResponse {
  data: RoyaltyStatement[];
  total: number;
  page: number;
  pageSize: number;
}

export async function GET(request: NextRequest): Promise<NextResponse<RoyaltiesResponse>> {
  try {
    // Create Supabase client using request cookies
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

    // Try to get user from session - use getSession() which works better with cookies
    await supabase.auth.getUser(); // Refresh session first
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      console.log("No session found in royalties API - cookies:", request.cookies.getAll().map(c => c.name));
      return NextResponse.json(
        { data: [], total: 0, page: 1, pageSize: 10 },
        { status: 401 }
      );
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, role, email")
      .eq("id", session.user.id)
      .single();

    if (profileError || !profile) {
      console.log("No profile found for user:", session.user.id);
      return NextResponse.json(
        { data: [], total: 0, page: 1, pageSize: 10 },
        { status: 401 }
      );
    }

    const user = {
      id: profile.id,
      role: profile.role,
      email: profile.email,
    };

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);
    const status = searchParams.get("status") || "";

    // Get admin client for querying royalties
    const adminClient = getSupabaseAdmin();

    // Build query
    let query = adminClient.from("royalties").select("*", { count: "exact" });

    // If artist, filter by their artist_id
    if (user.role === "artist") {
      // First, get the artist record from the artists table
      const { data: artistRecord, error: artistError } = await adminClient
        .from("artists")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (artistError || !artistRecord) {
        // No artist record found, return empty results
        return NextResponse.json({
          data: [],
          total: 0,
          page,
          pageSize,
        });
      }

      // Filter by artist_id
      query = query.eq("artist_id", artistRecord.id);
    }

    // Filter by status (paid_status field)
    if (status === "paid") {
      query = query.eq("paid_status", "paid");
    } else if (status === "pending") {
      query = query.in("paid_status", ["unpaid", "pending"]);
    }

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    // Order by created_at descending
    query = query.order("created_at", { ascending: false });

    // Execute query
    const { data: royalties, error, count } = await query;

    if (error) {
      console.error("Error fetching royalties:", error);
      return NextResponse.json(
        { data: [], total: 0, page, pageSize },
        { status: 500 }
      );
    }

    console.log("Royalties fetched:", {
      count: royalties?.length || 0,
      totalCount: count,
      userRole: user.role,
      userId: user.id,
    });

    // Transform data to RoyaltyStatement format
    const statements: RoyaltyStatement[] = (royalties || []).map((royalty) => {
      // Determine period from broadcast_date
      let period = "N/A";
      if (royalty.broadcast_date) {
        const date = new Date(royalty.broadcast_date);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const quarter = Math.ceil(month / 3);
        period = `${year}-Q${quarter}`;
      }

      // Determine status
      const royaltyStatus: "paid" | "pending" =
        royalty.paid_status === "paid" ? "paid" : "pending";

      return {
        id: royalty.id,
        trackTitle: royalty.track_title || "Unknown",
        platform: royalty.platform || "Unknown",
        period,
        streams: royalty.usage_count || 0,
        revenueUsd: Number(royalty.net_amount || 0),
        status: royaltyStatus,
      };
    });

    console.log("Returning statements:", {
      statementsCount: statements.length,
      total: count || 0,
      page,
      pageSize,
    });

    // Return response with data
    return NextResponse.json(
      {
        data: statements,
        total: count || 0,
        page,
        pageSize,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in royalties API:", error);
    return NextResponse.json(
      { data: [], total: 0, page: 1, pageSize: 10 },
      { status: 500 }
    );
  }
}

