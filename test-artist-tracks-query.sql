-- Test Query - This is what the frontend should be running
-- Run this to verify the query works

-- Simulate what the frontend does:
-- 1. Get user_id for artist@test.com
SELECT id as user_id FROM user_profiles WHERE email = 'artist@test.com';

-- 2. Get artist_id for that user
SELECT id as artist_id FROM artists WHERE user_id = '920946a9-1d77-45c9-bb72-aaf80aa2769e';

-- 3. Get tracks for that artist
SELECT 
  id,
  song_title,
  composer_name,
  isrc,
  artist_name,
  split,
  created_at
FROM tracks
WHERE artist_id = '76918893-560c-4921-8ebc-0d33cb4fee49'
ORDER BY created_at DESC;

-- 4. Check if RLS is enabled on tracks (should be disabled)
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'tracks';

