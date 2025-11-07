-- ============================================
-- Add Artist: artist@test.com
-- UUID: 920946a9-1d77-45c9-bb72-aaf80aa2769e
-- Password: artist123456 (default)
-- ============================================
--
-- STATUS: ✅ COMPLETED
-- The artist has been successfully created:
-- - Auth user: ✅ Created with UUID 920946a9-1d77-45c9-bb72-aaf80aa2769e
-- - User Profile: ✅ Created with role 'artist'
-- - Artists Table: ✅ Entry created (artist ID: c5e680a3-e47b-4729-8361-ae34c3c340bc)
-- - Sample Data: ✅ Track and royalties created
--
-- IMPORTANT SCHEMA RELATIONSHIPS:
-- - tracks.artist_id → artists.id (NOT auth.users.id)
-- - royalties.artist_id → auth.users.id
-- - payment_requests.artist_id → auth.users.id
-- - invoices.artist_id → auth.users.id
--
-- For this artist:
-- - User UUID (auth.users.id): 920946a9-1d77-45c9-bb72-aaf80aa2769e
-- - Artist UUID (artists.id): c5e680a3-e47b-4729-8361-ae34c3c340bc
--
-- Use User UUID for: royalties, payment_requests, invoices
-- Use Artist UUID for: tracks
--
-- ============================================
-- Verification Queries
-- ============================================

-- Verify user profile
SELECT 
  'User Profile' as type,
  id,
  email,
  role,
  created_at
FROM user_profiles
WHERE id = '920946a9-1d77-45c9-bb72-aaf80aa2769e';

-- Verify auth user
SELECT 
  'Auth User' as type,
  id,
  email,
  created_at,
  email_confirmed_at
FROM auth.users
WHERE id = '920946a9-1d77-45c9-bb72-aaf80aa2769e';

-- Verify artists table entry
SELECT 
  'Artists Table' as type,
  id as artist_id,
  user_id,
  name,
  email,
  created_at
FROM artists
WHERE user_id = '920946a9-1d77-45c9-bb72-aaf80aa2769e';

-- Verify tracks (uses artists.id)
SELECT 
  'Tracks' as type,
  COUNT(*) as count
FROM tracks
WHERE artist_id = 'c5e680a3-e47b-4729-8361-ae34c3c340bc';

-- Verify royalties (uses user_id)
SELECT 
  'Royalties' as type,
  COUNT(*) as count,
  COALESCE(SUM(net_amount), 0) as total_revenue,
  COALESCE(SUM(usage_count), 0) as total_streams
FROM royalties
WHERE artist_id = '920946a9-1d77-45c9-bb72-aaf80aa2769e';
