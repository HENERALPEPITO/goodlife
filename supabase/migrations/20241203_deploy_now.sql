-- ============================================
-- DEPLOY THIS NOW IN SUPABASE SQL EDITOR
-- ============================================
-- Copy and paste this entire file into:
-- Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================

-- STEP 1: Create missing indexes
CREATE INDEX IF NOT EXISTS idx_artists_user_id ON artists(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_artist_id ON invoices(artist_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_artist_id ON payment_requests(artist_id);
CREATE INDEX IF NOT EXISTS idx_royalties_artist_unpaid ON royalties(artist_id, is_paid) WHERE is_paid = false;

-- STEP 2: Create the Artist Dashboard RPC function
CREATE OR REPLACE FUNCTION get_artist_dashboard_data(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_artist_id uuid;
  v_stats jsonb;
  v_top_tracks jsonb;
  v_recent_activity jsonb;
BEGIN
  -- Validate input
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('found', false, 'error', 'user_id is null');
  END IF;

  -- Fast lookup with index
  SELECT id INTO v_artist_id FROM artists WHERE user_id = p_user_id;
  
  IF v_artist_id IS NULL THEN
    RETURN jsonb_build_object('found', false, 'error', 'no artist for user');
  END IF;
  
  -- Aggregate stats in single query (uses indexes)
  -- NOTE: total_revenue now returns UNPAID balance (is_paid = false) to match Royalties page
  SELECT jsonb_build_object(
    'total_tracks', COALESCE((SELECT COUNT(*)::int FROM tracks WHERE artist_id = v_artist_id), 0),
    'total_revenue', COALESCE((SELECT SUM(net_amount)::numeric FROM royalties WHERE artist_id = v_artist_id AND is_paid = false), 0),
    'total_streams', COALESCE((SELECT SUM(usage_count)::bigint FROM royalties WHERE artist_id = v_artist_id), 0),
    'total_net', COALESCE((SELECT SUM(net_amount)::numeric FROM royalties WHERE artist_id = v_artist_id), 0)
  ) INTO v_stats;
  
  -- Top 5 tracks (limited scan, no full table fetch)
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb)
  INTO v_top_tracks
  FROM (
    SELECT jsonb_build_object(
      'track_id', r.track_id,
      'title', COALESCE(t.title, r.track_title, 'Unknown'),
      'platform', COALESCE(MODE() WITHIN GROUP (ORDER BY r.exploitation_source_name), 'Various'),
      'streams', SUM(r.usage_count)::bigint,
      'revenue', SUM(r.net_amount)::numeric
    ) as t
    FROM royalties r
    LEFT JOIN tracks t ON t.id = r.track_id
    WHERE r.artist_id = v_artist_id
    GROUP BY r.track_id, t.title, r.track_title
    ORDER BY SUM(r.usage_count) DESC NULLS LAST
    LIMIT 5
  ) sub;
  
  -- Recent 5 activities (limited scan)
  SELECT COALESCE(jsonb_agg(a), '[]'::jsonb)
  INTO v_recent_activity
  FROM (
    SELECT jsonb_build_object(
      'id', r.id,
      'type', 'stream',
      'track_title', COALESCE(t.title, r.track_title, 'Track'),
      'streams', r.usage_count,
      'platform', r.exploitation_source_name,
      'date', COALESCE(r.broadcast_date, r.created_at)
    ) as a
    FROM royalties r
    LEFT JOIN tracks t ON t.id = r.track_id
    WHERE r.artist_id = v_artist_id
    ORDER BY COALESCE(r.broadcast_date, r.created_at) DESC NULLS LAST
    LIMIT 5
  ) sub;
  
  RETURN jsonb_build_object(
    'found', true,
    'artist_id', v_artist_id,
    'stats', v_stats,
    'top_tracks', v_top_tracks,
    'recent_activity', v_recent_activity
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Return error details instead of empty object
  RETURN jsonb_build_object(
    'found', false,
    'error', SQLERRM,
    'error_detail', SQLSTATE
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public;

-- STEP 3: Create the Artist Session RPC function (for login caching)
CREATE OR REPLACE FUNCTION get_artist_session_data(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_artist_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('found', false, 'error', 'user_id is null');
  END IF;

  SELECT id INTO v_artist_id FROM artists WHERE user_id = p_user_id;
  
  IF v_artist_id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;
  
  -- NOTE: total_revenue returns UNPAID balance to match Available Balance display
  RETURN (
    SELECT jsonb_build_object(
      'found', true,
      'artist_id', a.id,
      'artist_name', a.name,
      'artist_email', a.email,
      'stats', jsonb_build_object(
        'total_tracks', COALESCE((SELECT COUNT(*)::int FROM tracks WHERE artist_id = a.id), 0),
        'total_revenue', COALESCE((SELECT SUM(net_amount)::numeric FROM royalties WHERE artist_id = a.id AND is_paid = false), 0),
        'total_streams', COALESCE((SELECT SUM(usage_count)::bigint FROM royalties WHERE artist_id = a.id), 0),
        'total_net', COALESCE((SELECT SUM(net_amount)::numeric FROM royalties WHERE artist_id = a.id), 0)
      )
    )
    FROM artists a
    WHERE a.id = v_artist_id
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('found', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public;

-- STEP 4: Grant permissions
GRANT EXECUTE ON FUNCTION get_artist_dashboard_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_artist_session_data(uuid) TO authenticated;

-- STEP 5: Update statistics
ANALYZE artists;
ANALYZE tracks;
ANALYZE royalties;

-- STEP 6: Verify deployment
SELECT 'SUCCESS: RPC functions deployed!' as status;

-- Test (replace with a real user_id):
-- SELECT get_artist_dashboard_data('your-user-uuid-here');
