-- ============================================
-- OPTIMIZED INDEXES FOR ADMIN ROYALTY QUERIES
-- ============================================
-- Based on slow query analysis showing 1-2+ second queries
-- These covering indexes eliminate table lookups

-- ============================================
-- COVERING INDEX for admin royalties queries
-- Includes all columns selected in: SELECT *, tracks:track_id(...)
-- WHERE artist_id = X ORDER BY broadcast_date DESC
-- ============================================
CREATE INDEX IF NOT EXISTS idx_royalties_artist_date_covering
ON royalties(artist_id, broadcast_date DESC NULLS LAST)
INCLUDE (
  id, track_id, gross_amount, net_amount, admin_percent,
  usage_count, territory, exploitation_source_name, is_paid
);

-- ============================================
-- COVERING INDEX for analytics queries
-- SELECT net_amount, usage_count, territory, exploitation_source_name, broadcast_date
-- WHERE artist_id = X ORDER BY broadcast_date DESC
-- ============================================
CREATE INDEX IF NOT EXISTS idx_royalties_analytics_covering
ON royalties(artist_id, broadcast_date DESC)
INCLUDE (net_amount, usage_count, territory, exploitation_source_name);

-- ============================================
-- COVERING INDEX for global analytics (no artist filter)
-- SELECT net_amount, usage_count, territory, exploitation_source_name, broadcast_date
-- ORDER BY broadcast_date DESC
-- ============================================
CREATE INDEX IF NOT EXISTS idx_royalties_global_analytics
ON royalties(broadcast_date DESC)
INCLUDE (net_amount, usage_count, territory, exploitation_source_name, artist_id, track_id);

-- ============================================
-- PARTIAL INDEX for unpaid royalties (faster balance calculations)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_royalties_unpaid
ON royalties(artist_id, net_amount)
WHERE is_paid = false;

-- ============================================
-- Index for tracks table JOIN performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_tracks_id_covering
ON tracks(id)
INCLUDE (title, composer_name, isrc);

-- ============================================
-- UPDATE STATISTICS for query planner
-- ============================================
ANALYZE royalties;
ANALYZE tracks;

-- ============================================
-- COMMENT: How to verify index usage
-- ============================================
-- Run in Supabase SQL Editor:
-- EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM royalties 
--   WHERE artist_id = 'your-artist-id' 
--   ORDER BY broadcast_date DESC NULLS LAST;
-- 
-- Look for "Index Scan" instead of "Seq Scan"
