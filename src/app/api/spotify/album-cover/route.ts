import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase with service role for cache operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Spotify token cache (in-memory, refreshed when expired)
let spotifyAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string; height: number; width: number }[];
  };
}

interface SpotifySearchResponse {
  tracks: {
    items: SpotifyTrack[];
  };
}

interface AlbumCoverResponse {
  image: string | null;
  trackName: string | null;
  artistName: string | null;
  albumName: string | null;
  spotifyTrackId: string | null;
  cached: boolean;
  error?: string;
}

/**
 * Get Spotify access token using Client Credentials Flow
 */
async function getSpotifyAccessToken(): Promise<string | null> {
  // Return cached token if still valid
  if (spotifyAccessToken && Date.now() < tokenExpiresAt) {
    return spotifyAccessToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("[Spotify] Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET");
    return null;
  }

  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      console.error("[Spotify] Failed to get access token:", response.status);
      return null;
    }

    const data = await response.json();
    spotifyAccessToken = data.access_token;
    // Set expiry 5 minutes before actual expiry for safety
    tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;

    console.log("[Spotify] Access token refreshed, expires in", data.expires_in, "seconds");
    return spotifyAccessToken;
  } catch (error) {
    console.error("[Spotify] Error getting access token:", error);
    return null;
  }
}

/**
 * Search Spotify by ISRC
 */
async function searchSpotifyByISRC(isrc: string, accessToken: string): Promise<SpotifyTrack | null> {
  try {
    const searchUrl = `https://api.spotify.com/v1/search?q=isrc:${encodeURIComponent(isrc)}&type=track&limit=1`;
    
    const response = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.status === 429) {
      console.warn("[Spotify] Rate limited, returning null");
      return null;
    }

    if (!response.ok) {
      console.error("[Spotify] Search failed:", response.status);
      return null;
    }

    const data: SpotifySearchResponse = await response.json();
    
    if (data.tracks.items.length === 0) {
      console.log("[Spotify] No results found for ISRC:", isrc);
      return null;
    }

    return data.tracks.items[0];
  } catch (error) {
    console.error("[Spotify] Search error:", error);
    return null;
  }
}

/**
 * Check cache for existing Spotify data
 */
async function getCachedData(isrc: string): Promise<AlbumCoverResponse | null> {
  try {
    const { data, error } = await supabase
      .from("spotify_cache")
      .select("image_url, track_name, artist_name, album_name, spotify_track_id, expires_at")
      .eq("isrc", isrc)
      .single();

    if (error || !data) {
      return null;
    }

    // Check if cache is expired
    const isExpired = new Date(data.expires_at) < new Date();
    
    if (!isExpired) {
      return {
        image: data.image_url,
        trackName: data.track_name,
        artistName: data.artist_name,
        albumName: data.album_name,
        spotifyTrackId: data.spotify_track_id,
        cached: true,
      };
    }

    // Return stale data but mark for refresh
    return null;
  } catch (error) {
    console.error("[Spotify Cache] Error reading cache:", error);
    return null;
  }
}

/**
 * Save data to cache
 */
async function saveToCache(
  isrc: string,
  imageUrl: string | null,
  trackName: string | null,
  artistName: string | null,
  albumName: string | null,
  spotifyTrackId: string | null
): Promise<void> {
  try {
    await supabase.rpc("upsert_spotify_cache", {
      p_isrc: isrc,
      p_image_url: imageUrl,
      p_track_name: trackName,
      p_artist_name: artistName,
      p_spotify_track_id: spotifyTrackId,
      p_album_name: albumName,
    });
  } catch (error) {
    console.error("[Spotify Cache] Error saving to cache:", error);
  }
}

/**
 * POST /api/spotify/album-cover
 * Fetch album cover from Spotify using ISRC
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { isrc } = body;

    if (!isrc || typeof isrc !== "string") {
      return NextResponse.json(
        { error: "ISRC is required", image: null, trackName: null, artistName: null, cached: false } as AlbumCoverResponse,
        { status: 400 }
      );
    }

    // Normalize ISRC (remove dashes, spaces, uppercase)
    const normalizedISRC = isrc.replace(/[-\s]/g, "").toUpperCase();

    // Check cache first
    const cachedData = await getCachedData(normalizedISRC);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // Get Spotify access token
    const accessToken = await getSpotifyAccessToken();
    if (!accessToken) {
      return NextResponse.json(
        { 
          error: "Spotify API not configured", 
          image: null, 
          trackName: null, 
          artistName: null,
          albumName: null,
          spotifyTrackId: null,
          cached: false 
        } as AlbumCoverResponse,
        { status: 503 }
      );
    }

    // Search Spotify by ISRC
    const track = await searchSpotifyByISRC(normalizedISRC, accessToken);

    if (!track) {
      // Cache the "not found" result to avoid repeated lookups
      await saveToCache(normalizedISRC, null, null, null, null, null);
      
      return NextResponse.json({
        image: null,
        trackName: null,
        artistName: null,
        albumName: null,
        spotifyTrackId: null,
        cached: false,
      } as AlbumCoverResponse);
    }

    // Extract data from Spotify response
    const imageUrl = track.album.images[0]?.url || null;
    const trackName = track.name;
    const artistName = track.artists[0]?.name || null;
    const albumName = track.album.name;
    const spotifyTrackId = track.id;

    // Save to cache
    await saveToCache(normalizedISRC, imageUrl, trackName, artistName, albumName, spotifyTrackId);

    return NextResponse.json({
      image: imageUrl,
      trackName,
      artistName,
      albumName,
      spotifyTrackId,
      cached: false,
    } as AlbumCoverResponse);
  } catch (error: any) {
    console.error("[Spotify API] Error:", error);
    return NextResponse.json(
      { 
        error: error.message || "Internal server error", 
        image: null, 
        trackName: null, 
        artistName: null,
        albumName: null,
        spotifyTrackId: null,
        cached: false 
      } as AlbumCoverResponse,
      { status: 500 }
    );
  }
}

/**
 * GET /api/spotify/album-cover
 * Batch fetch album covers for multiple ISRCs
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const isrcsParam = searchParams.get("isrcs");

    if (!isrcsParam) {
      return NextResponse.json({ error: "isrcs query parameter required" }, { status: 400 });
    }

    const isrcs = isrcsParam.split(",").map(i => i.trim().replace(/[-\s]/g, "").toUpperCase());
    
    // Batch fetch from cache
    const { data: cachedItems } = await supabase
      .from("spotify_cache")
      .select("isrc, image_url, track_name, artist_name, album_name, spotify_track_id, expires_at")
      .in("isrc", isrcs);

    const results: Record<string, AlbumCoverResponse> = {};
    const cachedMap = new Map(cachedItems?.map(item => [item.isrc, item]) || []);

    for (const isrc of isrcs) {
      const cached = cachedMap.get(isrc);
      if (cached && new Date(cached.expires_at) > new Date()) {
        results[isrc] = {
          image: cached.image_url,
          trackName: cached.track_name,
          artistName: cached.artist_name,
          albumName: cached.album_name,
          spotifyTrackId: cached.spotify_track_id,
          cached: true,
        };
      } else {
        // Return null for uncached items - client should fetch individually
        results[isrc] = {
          image: null,
          trackName: null,
          artistName: null,
          albumName: null,
          spotifyTrackId: null,
          cached: false,
        };
      }
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error("[Spotify API] Batch error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
