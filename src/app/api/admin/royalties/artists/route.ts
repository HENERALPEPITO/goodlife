/**
 * GET /api/admin/royalties/artists
 * 
 * Fetch all artists who have royalty records
 * Admin-only endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

interface Artist {
  id: string;
  email: string;
  record_count: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Get admin client for auth verification
    let adminClient;
    try {
      adminClient = getSupabaseAdmin();
    } catch (adminError) {
      console.error("Failed to initialize admin client:", adminError);
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Get user from Authorization header (primary method)
    let user = null;
    const authHeader = request.headers.get('Authorization');
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user: authUser }, error: authError } = await adminClient.auth.getUser(token);
      
      if (!authError && authUser) {
        // Get role from user_metadata first (fast), then fallback to profile
        let role = authUser.user_metadata?.role as string | undefined;
        
        if (!role) {
          const { data: profile } = await adminClient
            .from("user_profiles")
            .select("role")
            .eq("id", authUser.id)
            .single();
          role = profile?.role;
        }
        
        if (role) {
          user = {
            id: authUser.id,
            email: authUser.email,
            role: role,
          };
        }
      }
    }
    
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - Please sign in again" },
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
