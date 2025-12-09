-- ============================================
-- SPOTIFY INTEGRATION MIGRATION
-- Adds Spotify album cover caching and ISRC support
-- ============================================

-- 1. Add spotify_image_url column to tracks table
ALTER TABLE public.tracks
ADD COLUMN IF NOT EXISTS spotify_image_url text,
ADD COLUMN IF NOT EXISTS spotify_track_id text,
ADD COLUMN IF NOT EXISTS spotify_artist_name text,
ADD COLUMN IF NOT EXISTS spotify_track_name text,
ADD COLUMN IF NOT EXISTS spotify_fetched_at timestamp with time zone;

-- 2. Add isrc and split columns if they don't exist
ALTER TABLE public.tracks
ADD COLUMN IF NOT EXISTS isrc text,
ADD COLUMN IF NOT EXISTS split text;

-- 3. Create spotify_cache table for caching API responses
CREATE TABLE IF NOT EXISTS public.spotify_cache (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    isrc text NOT NULL UNIQUE,
    image_url text,
    track_name text,
    artist_name text,
    spotify_track_id text,
    album_name text,
    fetched_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + interval '24 hours'),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT spotify_cache_pkey PRIMARY KEY (id)
);

-- 4. Create index on isrc for fast lookups
CREATE INDEX IF NOT EXISTS idx_spotify_cache_isrc ON public.spotify_cache(isrc);
CREATE INDEX IF NOT EXISTS idx_spotify_cache_expires_at ON public.spotify_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_tracks_isrc ON public.tracks(isrc);

-- 5. Create function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_spotify_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.spotify_cache
    WHERE expires_at < now();
END;
$$;

-- 6. Create function to get or refresh Spotify cache
CREATE OR REPLACE FUNCTION get_spotify_cache(p_isrc text)
RETURNS TABLE(
    image_url text,
    track_name text,
    artist_name text,
    spotify_track_id text,
    album_name text,
    is_expired boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sc.image_url,
        sc.track_name,
        sc.artist_name,
        sc.spotify_track_id,
        sc.album_name,
        (sc.expires_at < now()) as is_expired
    FROM public.spotify_cache sc
    WHERE sc.isrc = p_isrc;
END;
$$;

-- 7. Create function to upsert Spotify cache
CREATE OR REPLACE FUNCTION upsert_spotify_cache(
    p_isrc text,
    p_image_url text,
    p_track_name text,
    p_artist_name text,
    p_spotify_track_id text,
    p_album_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id uuid;
BEGIN
    INSERT INTO public.spotify_cache (
        isrc,
        image_url,
        track_name,
        artist_name,
        spotify_track_id,
        album_name,
        fetched_at,
        expires_at,
        updated_at
    )
    VALUES (
        p_isrc,
        p_image_url,
        p_track_name,
        p_artist_name,
        p_spotify_track_id,
        p_album_name,
        now(),
        now() + interval '24 hours',
        now()
    )
    ON CONFLICT (isrc) DO UPDATE SET
        image_url = EXCLUDED.image_url,
        track_name = EXCLUDED.track_name,
        artist_name = EXCLUDED.artist_name,
        spotify_track_id = EXCLUDED.spotify_track_id,
        album_name = EXCLUDED.album_name,
        fetched_at = now(),
        expires_at = now() + interval '24 hours',
        updated_at = now()
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

-- 8. Grant permissions
GRANT SELECT ON public.spotify_cache TO authenticated;
GRANT SELECT ON public.spotify_cache TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.spotify_cache TO service_role;

GRANT EXECUTE ON FUNCTION get_spotify_cache(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_spotify_cache(text) TO service_role;
GRANT EXECUTE ON FUNCTION upsert_spotify_cache(text, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_spotify_cache() TO service_role;

-- 9. Enable RLS on spotify_cache
ALTER TABLE public.spotify_cache ENABLE ROW LEVEL SECURITY;

-- 10. Create RLS policies for spotify_cache (read-only for all authenticated users)
CREATE POLICY "Allow read access for all authenticated users" 
ON public.spotify_cache FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow full access for service role" 
ON public.spotify_cache FOR ALL 
TO service_role 
USING (true);

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
