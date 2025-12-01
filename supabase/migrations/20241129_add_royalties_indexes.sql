-- ============================================
-- PERFORMANCE INDEXES FOR SLOW ROYALTIES QUERIES
-- ============================================
-- Run this in Supabase SQL Editor to fix slow queries
-- 
-- Affected queries:
--   1. royalties filtered by artist_id, ordered by broadcast_date DESC
--   2. royalties joined with tracks table on track_id
--   3. Full table scans on royalties
--
-- Expected improvement: 80-95% reduction in query time

-- ============================================
-- PRIMARY FIX: Composite index for the most common query pattern
-- Covers: WHERE artist_id = X ORDER BY broadcast_date DESC
-- This is the most important index - covers queries #2, #4, #5, #6
-- ============================================
CREATE INDEX IF NOT EXISTS idx_royalties_artist_date 
ON royalties(artist_id, broadcast_date DESC NULLS LAST);

-- ============================================
-- SECONDARY INDEXES
-- ============================================

-- Index for JOIN with tracks table (queries #2, #3, #4, #5, #6)
CREATE INDEX IF NOT EXISTS idx_royalties_track_id 
ON royalties(track_id);

-- Index for broadcast_date ordering without artist filter (query #3)
CREATE INDEX IF NOT EXISTS idx_royalties_broadcast_date 
ON royalties(broadcast_date DESC NULLS LAST);

-- Index for filtering by artist_id without ordering
CREATE INDEX IF NOT EXISTS idx_royalties_artist_id 
ON royalties(artist_id);

-- Index for artist_id IS NOT NULL filter (query #10)
CREATE INDEX IF NOT EXISTS idx_royalties_artist_id_not_null 
ON royalties(artist_id) WHERE artist_id IS NOT NULL;

-- ============================================
-- TRACKS TABLE INDEXES (for JOIN performance)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_tracks_artist_id 
ON tracks(artist_id);

-- ============================================
-- COVERING INDEX for aggregation queries (query #1, #11)
-- Includes only the columns needed for SUM/COUNT
-- ============================================
CREATE INDEX IF NOT EXISTS idx_royalties_net_usage 
ON royalties(net_amount, usage_count);

-- ============================================
-- ANALYZE TABLES to update query planner statistics
-- ============================================
ANALYZE royalties;
ANALYZE tracks;

-- ============================================
-- DATABASE FUNCTION: Get royalty totals efficiently
-- This replaces the slow full table scan in AdminDashboard
-- ============================================
CREATE OR REPLACE FUNCTION get_royalty_totals()
RETURNS TABLE(total_revenue NUMERIC, total_usage BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(net_amount), 0)::NUMERIC as total_revenue,
    COALESCE(SUM(usage_count), 0)::BIGINT as total_usage
  FROM royalties;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_royalty_totals() TO authenticated;
GRANT EXECUTE ON FUNCTION get_royalty_totals() TO anon;
GRANT EXECUTE ON FUNCTION get_royalty_totals() TO service_role;

-- ============================================
-- DATABASE FUNCTION: Get artists with royalty counts efficiently
-- This replaces the slow full table scan in admin royalties artists endpoint
-- ============================================
CREATE OR REPLACE FUNCTION get_artists_with_royalty_counts()
RETURNS TABLE(
  artist_id UUID,
  record_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.artist_id,
    COUNT(*)::BIGINT as record_count
  FROM royalties r
  WHERE r.artist_id IS NOT NULL
  GROUP BY r.artist_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_artists_with_royalty_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION get_artists_with_royalty_counts() TO service_role;
