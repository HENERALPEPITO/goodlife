-- Optimize royalties table indexes for slow queries
-- Run this in Supabase SQL Editor

-- ===========================================
-- COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
-- ===========================================

-- Most critical: artist_id filter + broadcast_date ordering
-- This covers the majority of slow queries (32-45% of total time)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_royalties_artist_broadcast 
  ON public.royalties(artist_id, broadcast_date DESC);

-- For queries filtering by artist_id and is_paid
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_royalties_artist_is_paid 
  ON public.royalties(artist_id, is_paid) 
  WHERE is_paid = false;

-- ===========================================
-- SINGLE COLUMN INDEXES (IF MISSING)
-- ===========================================

-- Index on net_amount (suggested by index advisor)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_royalties_net_amount 
  ON public.royalties(net_amount);

-- Ensure track_id is indexed for joins
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_royalties_track_id 
  ON public.royalties(track_id);

-- Ensure artist_id is indexed
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_royalties_artist_id 
  ON public.royalties(artist_id);

-- Index on broadcast_date for ordering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_royalties_broadcast_date 
  ON public.royalties(broadcast_date DESC);

-- ===========================================
-- TRACKS TABLE INDEX FOR JOINS
-- ===========================================

-- Ensure tracks.id has proper index (should exist as PK, but add for safety)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tracks_id 
  ON public.tracks(id);

-- ===========================================
-- ANALYZE TABLES TO UPDATE STATISTICS
-- ===========================================

ANALYZE public.royalties;
ANALYZE public.tracks;
