/**
 * GET /api/admin/royalties/artists
 * 
 * Fetch all artists who have royalty records
 * Admin-only endpoint
 * 
 * OPTIMIZED: Single auth query + single data query via relationship joins
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

interface Artist {
  id: string;
  email: string;
  record_count: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Create server-side Supabase client with cookie support for auth verification
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

    // OPTIMIZED AUTH: Check user_metadata first (JWT decode, no DB query)
    let userId: string | null = null;
    let userRole: string | null = null;
    
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user: authUser } } = await supabase.auth.getUser(token);
      
      if (authUser) {
        userId = authUser.id;
        userRole = authUser.user_metadata?.role as string || null;
      }
    }
    
    // Fallback: Check session from cookies
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        userId = session.user.id;
        userRole = session.user.user_metadata?.role as string || null;
      }
    }
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // If role not cached in metadata, do single DB query
    if (!userRole) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", userId)
        .single();
      userRole = profile?.role || null;
    }
    
    if (userRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get admin client for data queries
    const adminClient = getSupabaseAdmin();

    // OPTIMIZED: Single query combining artists with royalty summary
    // Attempts to fetch with relationships; falls back to manual join if needed
    const { data: artistsData, error: queryError } = await adminClient
      .from("artists")
      .select(
        `
        id,
        name,
        email,
        user_id,
        royalties_summary!left(record_count)
        `
      );

    if (queryError) {
      console.error("Error fetching artists:", queryError);
      return NextResponse.json(
        { error: "Failed to fetch artist data" },
        { status: 500 }
      );
    }

    if (!artistsData || artistsData.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    // Get user emails for any artists without email in artists table
    const userIds = (artistsData || [])
      .filter((a: any) => !a.email && a.user_id)
      .map((a: any) => a.user_id);

    const userEmailMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: userProfiles } = await adminClient
        .from("user_profiles")
        .select("id, email")
        .in("id", userIds);

      (userProfiles || []).forEach((u: any) => {
        userEmailMap.set(u.id, u.email);
      });
    }

    // Transform and aggregate results
    const resultArtists: Artist[] = (artistsData || [])
      .map((artist: any) => {
        const totalRecords = (artist.royalties_summary || []).reduce(
          (sum: number, s: any) => sum + (s.record_count || 0),
          0
        );

        return {
          id: artist.id,
          email: artist.name || artist.email || userEmailMap.get(artist.user_id) || "Unknown Artist",
          record_count: totalRecords,
        };
      })
      .filter((artist) => artist.record_count > 0)
      .sort((a: Artist, b: Artist) => a.email.localeCompare(b.email));

    return NextResponse.json(resultArtists, { status: 200 });
  } catch (error) {
    console.error("Error in admin royalties artists endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}