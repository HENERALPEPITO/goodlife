-- Optimize royalties table indexes for slow queries
-- Run this in Supabase SQL Editor
-- 
-- These indexes address the top slow queries:
-- 1. Queries filtering by artist_id + ordering by broadcast_date DESC
-- 2. Joins to tracks table on track_id
-- 3. Queries on net_amount

-- ===========================================
-- DROP EXISTING INDEXES (optional - uncomment if needed to recreate)
-- ===========================================
-- DROP INDEX IF EXISTS idx_royalties_artist_broadcast;
-- DROP INDEX IF EXISTS idx_royalties_artist_is_paid;

-- ===========================================
-- COMPOSITE INDEX: artist_id + broadcast_date
-- This is the most important one - covers 60%+ of slow queries
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_royalties_artist_broadcast 
  ON public.royalties(artist_id, broadcast_date DESC);

-- ===========================================
-- COMPOSITE INDEX: artist_id + is_paid (for unpaid balance queries)
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_royalties_artist_is_paid 
  ON public.royalties(artist_id, is_paid);

-- ===========================================
-- SINGLE COLUMN INDEXES
-- ===========================================

-- net_amount (suggested by Supabase index advisor)
CREATE INDEX IF NOT EXISTS idx_royalties_net_amount 
  ON public.royalties(net_amount);

-- track_id for JOIN performance
CREATE INDEX IF NOT EXISTS idx_royalties_track_id 
  ON public.royalties(track_id);

-- artist_id standalone (may already exist)
CREATE INDEX IF NOT EXISTS idx_royalties_artist_id 
  ON public.royalties(artist_id);

-- broadcast_date standalone for ordering
CREATE INDEX IF NOT EXISTS idx_royalties_broadcast_date 
  ON public.royalties(broadcast_date DESC);

-- ===========================================
-- TRACKS TABLE - ensure id is properly indexed
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_tracks_id 
  ON public.tracks(id);

-- ===========================================
-- UPDATE PLANNER STATISTICS
-- ===========================================
ANALYZE public.royalties;
ANALYZE public.tracks;

-- ===========================================
-- VERIFY INDEXES WERE CREATED
-- ===========================================
SELECT 
  indexname, 
  indexdef 
FROM pg_indexes 
WHERE tablename = 'royalties' 
ORDER BY indexname;
