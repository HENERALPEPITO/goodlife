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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nyxedsuflhvxzijjiktj.supabase.co";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55eGVkc3VmbGh2eHppamppa3RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDAzMjUsImV4cCI6MjA3NzkxNjMyNX0.Fm4MVU2rIO4IqMRUMAE_qUJQXqWn0WWZUMS0RuMKmDo";
    
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

    // Fetch ALL records for this artist (no pagination limit)
    // This ensures accurate totals calculation on the frontend
    const { data: royalties, error, count } = await adminClient
      .from("royalties")
      .select(`
        *,
        tracks:track_id (
          title,
          composer_name,
          isrc
        )
      `, { count: "exact" })
      .eq("artist_id", artistId)
      .order("broadcast_date", { ascending: false, nullsFirst: false });

    if (error) {
      console.error("Error fetching royalties for artist", artistId, ":");
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      console.error("Full error:", JSON.stringify(error, null, 2));
      return NextResponse.json(
        { error: "Failed to fetch royalties", details: error.message, code: error.code },
        { status: 500 }
      );
    }

    // Debug: Log first royalty record to see structure
    if (royalties && royalties.length > 0) {
      console.log("📊 Sample royalty record:", JSON.stringify(royalties[0], null, 2));
    }

    // Transform the response to flatten track title and composer
    const transformedRoyalties = (royalties || []).map((royalty: any) => ({
      ...royalty,
      track_title: royalty.tracks?.title || null,
      composer_name: royalty.tracks?.composer_name || null,
      isrc: royalty.tracks?.isrc || null,
      tracks: undefined, // Remove the nested object
    }));

    // Return all records - frontend handles display limiting
    return NextResponse.json({
      data: transformedRoyalties,
      total: count || 0
    }, { status: 200 });
  } catch (error) {
    console.error("Error in admin royalties artist endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
