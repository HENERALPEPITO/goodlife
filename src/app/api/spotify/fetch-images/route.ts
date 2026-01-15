import { NextRequest, NextResponse } from 'next/server';
import { searchTrackByISRC } from '@/lib/spotify';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { trackIds } = await request.json();

    if (!Array.isArray(trackIds) || trackIds.length === 0) {
      return NextResponse.json({ error: 'Invalid track IDs' }, { status: 400 });
    }

    // Fetch tracks from database
    const { data: tracks, error: fetchError } = await supabase
      .from('tracks')
      .select('id, isrc, spotify_image_url, spotify_fetched_at')
      .in('id', trackIds);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const updates = [];
    const now = new Date().toISOString();

    for (const track of tracks || []) {
      // Skip if already has image fetched within last 7 days
      if (track.spotify_image_url && track.spotify_fetched_at) {
        const fetchedDate = new Date(track.spotify_fetched_at);
        const daysSinceFetch = (Date.now() - fetchedDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceFetch < 7) {
          continue;
        }
      }
      
      if (!track.isrc) continue;

      // Check cache first
      const { data: cached } = await supabase
        .from('spotify_cache')
        .select('*')
        .eq('isrc', track.isrc)
        .gt('expires_at', now)
        .maybeSingle();

      let spotifyData;

      if (cached && cached.image_url) {
        // Use cached data
        spotifyData = {
          imageUrl: cached.image_url,
          trackId: cached.spotify_track_id,
          trackName: cached.track_name,
          artistName: cached.artist_name,
          albumName: cached.album_name,
        };
      } else {
        // Fetch from Spotify
        spotifyData = await searchTrackByISRC(track.isrc);
        
        if (spotifyData) {
          // Update cache
          await supabase
            .from('spotify_cache')
            .upsert({
              isrc: track.isrc,
              image_url: spotifyData.imageUrl,
              spotify_track_id: spotifyData.trackId,
              track_name: spotifyData.trackName,
              artist_name: spotifyData.artistName,
              album_name: spotifyData.albumName,
              fetched_at: now,
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
              updated_at: now,
            }, {
              onConflict: 'isrc'
            });

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      if (spotifyData) {
        updates.push({ id: track.id, ...spotifyData });
        
        // Update track in database
        await supabase
          .from('tracks')
          .update({
            spotify_image_url: spotifyData.imageUrl,
            spotify_track_id: spotifyData.trackId,
            spotify_track_name: spotifyData.trackName,
            spotify_artist_name: spotifyData.artistName,
            spotify_fetched_at: now,
          })
          .eq('id', track.id);
      }
    }

    return NextResponse.json({ 
      success: true, 
      updated: updates.length,
      results: updates 
    });
  } catch (error) {
    console.error('Error in fetch-images API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}