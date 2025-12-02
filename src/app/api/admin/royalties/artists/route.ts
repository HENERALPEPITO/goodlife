/**
 * GET /api/admin/royalties/artists
 * 
 * Fetch all artists who have royalty records
 * Admin-only endpoint
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

    // Try to get user from Authorization header first
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
      console.log("No user found in GET /api/admin/royalties/artists - cookies:", request.cookies.getAll().map(c => c.name));
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

    // Use admin client to fetch all artists with royalty records
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

    // First, get all unique artist_ids from royalties
    const { data: royaltiesData, error: royaltiesError } = await adminClient
      .from("royalties")
      .select("artist_id")
      .not("artist_id", "is", null);

    if (royaltiesError) {
      console.error("Error fetching royalties:", royaltiesError);
      return NextResponse.json(
        { error: "Failed to fetch royalties" },
        { status: 500 }
      );
    }

    // Get unique artist IDs
    const artistIds = Array.from(
      new Set((royaltiesData || []).map((r: { artist_id: string }) => r.artist_id))
    );

    if (artistIds.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    // Get artists for these artist IDs (from artists table, not user_profiles)
    const { data: artists, error: artistsError } = await adminClient
      .from("artists")
      .select("id, email")
      .in("id", artistIds);

    if (artistsError) {
      console.error("Error fetching artists:", artistsError);
      return NextResponse.json(
        { error: "Failed to fetch artist data" },
        { status: 500 }
      );
    }

    // Count records per artist
    const artistRecordCounts = new Map<string, number>();
    (royaltiesData || []).forEach((record: { artist_id: string }) => {
      const count = artistRecordCounts.get(record.artist_id) || 0;
      artistRecordCounts.set(record.artist_id, count + 1);
    });

    // Combine data
    const resultArtists: Artist[] = (artists || [])
      .map((artist: { id: string; email: string }) => ({
        id: artist.id,
        email: artist.email,
        record_count: artistRecordCounts.get(artist.id) || 0,
      }))
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