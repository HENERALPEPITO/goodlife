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

    // Use RPC function for efficient aggregation instead of fetching all records
    const { data: royaltyCountsData, error: royaltiesError } = await adminClient
      .rpc("get_artists_with_royalty_counts");

    if (royaltiesError) {
      console.error("Error fetching royalty counts:", royaltiesError);
      // Fallback to old method if RPC function doesn't exist yet
      const { data: fallbackData, error: fallbackError } = await adminClient
        .from("royalties")
        .select("artist_id")
        .not("artist_id", "is", null);
      
      if (fallbackError) {
        return NextResponse.json(
          { error: "Failed to fetch royalties" },
          { status: 500 }
        );
      }
      
      // Process fallback data the old way
      const artistRecordCounts = new Map<string, number>();
      (fallbackData || []).forEach((record: { artist_id: string }) => {
        const count = artistRecordCounts.get(record.artist_id) || 0;
        artistRecordCounts.set(record.artist_id, count + 1);
      });
      
      const artistIds = Array.from(artistRecordCounts.keys());
      if (artistIds.length === 0) {
        return NextResponse.json([], { status: 200 });
      }
      
      const { data: artists, error: artistsError } = await adminClient
        .from("artists")
        .select("id, name, email")
        .in("id", artistIds);
      
      if (artistsError) {
        return NextResponse.json(
          { error: "Failed to fetch artist data" },
          { status: 500 }
        );
      }
      
      const resultArtists: Artist[] = (artists || [])
        .map((artist: { id: string; name: string; email: string }) => ({
          id: artist.id,
          name: artist.name,
          email: artist.email,
          record_count: artistRecordCounts.get(artist.id) || 0,
        }))
        .sort((a: Artist, b: Artist) => b.record_count - a.record_count);
      
      return NextResponse.json(resultArtists, { status: 200 });
    }

    // Process data from RPC function
    const artistRecordCounts = new Map<string, number>();
    const artistIds: string[] = [];
    (royaltyCountsData || []).forEach((record: { artist_id: string; record_count: number }) => {
      artistRecordCounts.set(record.artist_id, record.record_count);
      artistIds.push(record.artist_id);
    });

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
