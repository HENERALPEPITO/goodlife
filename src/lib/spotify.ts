interface SpotifyAccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: {
    id: string;
    name: string;
    release_date: string;
    images: Array<{
      url: string;
      height: number;
      width: number;
    }>;
  };
  external_ids: {
    isrc?: string;
  };
  duration_ms: number;
}

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

async function getSpotifyAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Spotify credentials not configured');
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error('Failed to get Spotify access token');
  }

  const data: SpotifyAccessTokenResponse = await response.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Refresh 1 min early

  return cachedToken;
}

export interface SpotifyTrackData {
  imageUrl: string;
  trackId: string;
  trackName: string;
  artistName: string;
  albumName: string;
}

export async function searchTrackByISRC(isrc: string): Promise<SpotifyTrackData | null> {
  try {
    const token = await getSpotifyAccessToken();

    const response = await fetch(
      `https://api.spotify.com/v1/search?q=isrc:${isrc}&type=track&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      console.error(`Spotify API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const track: SpotifyTrack | undefined = data.tracks?.items?.[0];

    if (!track || !track.album?.images?.[0]?.url) {
      return null;
    }

    // Return complete track data
    return {
      imageUrl: track.album.images[0].url,
      trackId: track.id,
      trackName: track.name,
      artistName: track.artists.map(a => a.name).join(', '),
      albumName: track.album.name,
    };
  } catch (error) {
    console.error('Error fetching from Spotify:', error);
    return null;
  }
}