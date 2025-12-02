-- ============================================
-- ARTIST SESSION OPTIMIZATION
-- ============================================
-- This migration adds:
-- 1. Index on artists.user_id for fast user->artist lookup
-- 2. get_artist_session_data() - Single query for all artist login data
-- 3. get_artist_dashboard_data() - Batched dashboard data query
--
-- Expected improvement: Login 2-3s → <500ms, Dashboard render 3-5s → <500ms

-- ============================================
-- CRITICAL INDEX: artists.user_id lookup
-- This is called on EVERY artist login/page load
-- ============================================
-- Note: Using regular CREATE INDEX (not CONCURRENTLY) for Supabase SQL Editor compatibility
-- For production with large tables, run CONCURRENTLY via psql or during low-traffic periods
CREATE INDEX IF NOT EXISTS idx_artists_user_id
ON artists(user_id);

-- ============================================
-- FUNCTION: Get artist session data on login
-- Returns artist profile + stats in a single query
-- Call once on login, cache in client localStorage
-- ============================================
CREATE OR REPLACE FUNCTION get_artist_session_data(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  v_artist_id uuid;
BEGIN
  -- Get artist ID first
  SELECT id INTO v_artist_id
  FROM artists
  WHERE user_id = p_user_id;
  
  IF v_artist_id IS NULL THEN
    RETURN jsonb_build_object(
      'artist_id', null,
      'found', false
    );
  END IF;
  
  -- Build complete session data in one query
  SELECT jsonb_build_object(
    'artist_id', a.id,
    'artist_name', a.name,
    'artist_email', a.email,
    'found', true,
    'stats', jsonb_build_object(
      'total_tracks', (
        SELECT COUNT(*)::int 
        FROM tracks 
        WHERE artist_id = a.id
      ),
      'total_revenue', (
        SELECT COALESCE(SUM(net_amount), 0)::numeric 
        FROM royalties 
        WHERE artist_id = a.id
      ),
      'total_streams', (
        SELECT COALESCE(SUM(usage_count), 0)::bigint 
        FROM royalties 
        WHERE artist_id = a.id
      ),
      'unpaid_amount', (
        SELECT COALESCE(SUM(net_amount), 0)::numeric 
        FROM royalties 
        WHERE artist_id = a.id AND is_paid = false
      )
    )
  )
  INTO result
  FROM artists a
  WHERE a.id = v_artist_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_artist_session_data(uuid) TO authenticated;

-- ============================================
-- FUNCTION: Get full dashboard data for artist
-- Returns stats, top tracks, and recent activity in one call
-- ============================================
CREATE OR REPLACE FUNCTION get_artist_dashboard_data(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  v_artist_id uuid;
  v_stats jsonb;
  v_top_tracks jsonb;
  v_recent_activity jsonb;
BEGIN
  -- Get artist ID
  SELECT id INTO v_artist_id
  FROM artists
  WHERE user_id = p_user_id;
  
  IF v_artist_id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;
  
  -- Get aggregate stats
  SELECT jsonb_build_object(
    'total_tracks', (SELECT COUNT(*)::int FROM tracks WHERE artist_id = v_artist_id),
    'total_revenue', (SELECT COALESCE(SUM(net_amount), 0)::numeric FROM royalties WHERE artist_id = v_artist_id),
    'total_streams', (SELECT COALESCE(SUM(usage_count), 0)::bigint FROM royalties WHERE artist_id = v_artist_id)
  ) INTO v_stats;
  
  -- Get top 5 tracks by streams (aggregated from royalties)
  SELECT COALESCE(jsonb_agg(track_data), '[]'::jsonb)
  INTO v_top_tracks
  FROM (
    SELECT jsonb_build_object(
      'track_id', r.track_id,
      'title', COALESCE(t.title, r.track_title, 'Unknown'),
      'platform', COALESCE(MODE() WITHIN GROUP (ORDER BY r.exploitation_source_name), 'Various'),
      'streams', SUM(r.usage_count)::bigint,
      'revenue', SUM(r.net_amount)::numeric
    ) as track_data
    FROM royalties r
    LEFT JOIN tracks t ON t.id = r.track_id
    WHERE r.artist_id = v_artist_id
    GROUP BY r.track_id, t.title, r.track_title
    ORDER BY SUM(r.usage_count) DESC
    LIMIT 5
  ) sub;
  
  -- Get recent 5 activities (royalty entries)
  SELECT COALESCE(jsonb_agg(activity_data), '[]'::jsonb)
  INTO v_recent_activity
  FROM (
    SELECT jsonb_build_object(
      'id', r.id,
      'type', 'stream',
      'track_title', COALESCE(t.title, r.track_title, 'Track'),
      'streams', r.usage_count,
      'platform', r.exploitation_source_name,
      'date', COALESCE(r.broadcast_date, r.created_at)
    ) as activity_data
    FROM royalties r
    LEFT JOIN tracks t ON t.id = r.track_id
    WHERE r.artist_id = v_artist_id
    ORDER BY COALESCE(r.broadcast_date, r.created_at) DESC
    LIMIT 5
  ) sub;
  
  RETURN jsonb_build_object(
    'found', true,
    'artist_id', v_artist_id,
    'stats', v_stats,
    'top_tracks', v_top_tracks,
    'recent_activity', v_recent_activity
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_artist_dashboard_data(uuid) TO authenticated;

-- ============================================
-- Add app_metadata for RLS optimization (optional)
-- This allows RLS policies to use artist_id directly from JWT
-- ============================================
-- Note: To enable optimized RLS, run this after login:
-- UPDATE auth.users 
-- SET raw_app_meta_data = raw_app_meta_data || 
--   jsonb_build_object('artist_id', (SELECT id FROM artists WHERE user_id = auth.uid()))
-- WHERE id = auth.uid();

-- ============================================
-- ANALYZE tables to update query planner
-- ============================================
ANALYZE artists;
ANALYZE tracks;
ANALYZE royalties;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Test the functions in Supabase SQL Editor:
--
-- SELECT get_artist_session_data('your-user-uuid');
-- SELECT get_artist_dashboard_data('your-user-uuid');
--
-- Check index usage:
-- EXPLAIN (ANALYZE, BUFFERS) 
-- SELECT id FROM artists WHERE user_id = 'your-user-uuid';
