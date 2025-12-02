-- ============================================
-- COMPLETE PERFORMANCE OPTIMIZATION
-- ============================================
-- This migration provides comprehensive indexes and functions
-- to make Artist dashboard as fast as Admin dashboard.
--
-- Run this AFTER the previous migrations or as a standalone fix.
-- ============================================

-- ============================================
-- SECTION 1: MISSING INDEXES
-- ============================================

-- Critical: artists.user_id (if not exists from previous migration)
CREATE INDEX IF NOT EXISTS idx_artists_user_id
ON artists(user_id);

-- Critical: invoices.artist_id (MISSING from schema)
CREATE INDEX IF NOT EXISTS idx_invoices_artist_id
ON invoices(artist_id);

-- Critical: payment_requests.artist_id (MISSING from schema)
CREATE INDEX IF NOT EXISTS idx_payment_requests_artist_id
ON payment_requests(artist_id);

-- Covering index for unpaid royalties lookup
CREATE INDEX IF NOT EXISTS idx_royalties_artist_unpaid
ON royalties(artist_id, is_paid)
WHERE is_paid = false;

-- Covering index for invoice status lookups
CREATE INDEX IF NOT EXISTS idx_invoices_artist_status
ON invoices(artist_id, status);

-- Covering index for payment request status lookups
CREATE INDEX IF NOT EXISTS idx_payment_requests_artist_status
ON payment_requests(artist_id, status);

-- ============================================
-- SECTION 2: OPTIMIZED RPC FUNCTIONS
-- ============================================

-- Function: Get artist session data (login cache)
CREATE OR REPLACE FUNCTION get_artist_session_data(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_artist_id uuid;
  v_result jsonb;
BEGIN
  -- Fast lookup with index
  SELECT id INTO v_artist_id
  FROM artists
  WHERE user_id = p_user_id;
  
  IF v_artist_id IS NULL THEN
    RETURN jsonb_build_object('found', false, 'artist_id', null);
  END IF;
  
  -- Single query builds all stats
  SELECT jsonb_build_object(
    'found', true,
    'artist_id', a.id,
    'artist_name', a.name,
    'artist_email', a.email,
    'stats', jsonb_build_object(
      'total_tracks', COALESCE((SELECT COUNT(*)::int FROM tracks WHERE artist_id = a.id), 0),
      'total_revenue', COALESCE((SELECT SUM(net_amount)::numeric FROM royalties WHERE artist_id = a.id), 0),
      'total_streams', COALESCE((SELECT SUM(usage_count)::bigint FROM royalties WHERE artist_id = a.id), 0),
      'unpaid_amount', COALESCE((SELECT SUM(net_amount)::numeric FROM royalties WHERE artist_id = a.id AND is_paid = false), 0),
      'pending_invoices', COALESCE((SELECT COUNT(*)::int FROM invoices WHERE artist_id = a.id AND status = 'pending'), 0),
      'pending_payments', COALESCE((SELECT COUNT(*)::int FROM payment_requests WHERE artist_id = a.id AND status = 'pending'), 0)
    )
  )
  INTO v_result
  FROM artists a
  WHERE a.id = v_artist_id;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function: Get full dashboard data
CREATE OR REPLACE FUNCTION get_artist_dashboard_data(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_artist_id uuid;
  v_stats jsonb;
  v_top_tracks jsonb;
  v_recent_activity jsonb;
BEGIN
  -- Fast lookup
  SELECT id INTO v_artist_id FROM artists WHERE user_id = p_user_id;
  
  IF v_artist_id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;
  
  -- Aggregate stats in single query
  SELECT jsonb_build_object(
    'total_tracks', COALESCE((SELECT COUNT(*)::int FROM tracks WHERE artist_id = v_artist_id), 0),
    'total_revenue', COALESCE((SELECT SUM(net_amount)::numeric FROM royalties WHERE artist_id = v_artist_id), 0),
    'total_streams', COALESCE((SELECT SUM(usage_count)::bigint FROM royalties WHERE artist_id = v_artist_id), 0)
  ) INTO v_stats;
  
  -- Top 5 tracks with limited scan
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
  
  -- Recent 5 activities only
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
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function: Get artist royalties with pagination
CREATE OR REPLACE FUNCTION get_artist_royalties_paginated(
  p_user_id uuid,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS jsonb AS $$
DECLARE
  v_artist_id uuid;
  v_total_count int;
  v_royalties jsonb;
BEGIN
  SELECT id INTO v_artist_id FROM artists WHERE user_id = p_user_id;
  
  IF v_artist_id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;
  
  -- Get total count for pagination
  SELECT COUNT(*)::int INTO v_total_count
  FROM royalties WHERE artist_id = v_artist_id;
  
  -- Get paginated royalties
  SELECT COALESCE(jsonb_agg(r), '[]'::jsonb)
  INTO v_royalties
  FROM (
    SELECT jsonb_build_object(
      'id', r.id,
      'track_title', COALESCE(t.title, r.track_title),
      'gross_amount', r.gross_amount,
      'net_amount', r.net_amount,
      'usage_count', r.usage_count,
      'territory', r.territory,
      'platform', r.exploitation_source_name,
      'broadcast_date', r.broadcast_date,
      'is_paid', r.is_paid
    ) as r
    FROM royalties r
    LEFT JOIN tracks t ON t.id = r.track_id
    WHERE r.artist_id = v_artist_id
    ORDER BY r.broadcast_date DESC NULLS LAST
    LIMIT p_limit OFFSET p_offset
  ) sub;
  
  RETURN jsonb_build_object(
    'found', true,
    'total_count', v_total_count,
    'limit', p_limit,
    'offset', p_offset,
    'royalties', v_royalties
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- SECTION 3: GRANT PERMISSIONS
-- ============================================
GRANT EXECUTE ON FUNCTION get_artist_session_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_artist_dashboard_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_artist_royalties_paginated(uuid, int, int) TO authenticated;

-- ============================================
-- SECTION 4: UPDATE STATISTICS
-- ============================================
ANALYZE artists;
ANALYZE tracks;
ANALYZE royalties;
ANALYZE invoices;
ANALYZE payment_requests;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify indexes exist:
--
-- SELECT indexname, tablename 
-- FROM pg_indexes 
-- WHERE schemaname = 'public' 
-- AND indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;
--
-- Test RPC performance:
-- EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
-- SELECT get_artist_dashboard_data('your-user-uuid');
