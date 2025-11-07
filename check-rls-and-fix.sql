-- Check RLS Status and Fix
-- Run this in Supabase SQL Editor

-- Step 1: Check if RLS is enabled on artists table
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('artists', 'tracks');

-- Step 2: Disable RLS on artists table (temporarily)
ALTER TABLE artists DISABLE ROW LEVEL SECURITY;

-- Step 3: Verify the artist record can be queried by user_id
SELECT 
  a.id,
  a.name,
  a.email,
  a.user_id,
  up.email AS user_email
FROM artists a
LEFT JOIN user_profiles up ON a.user_id = up.id
WHERE a.user_id = '920946a9-1d77-45c9-bb72-aaf80aa2769e';

-- Step 4: Test the full query chain (what frontend does)
WITH user_artist AS (
  SELECT id as artist_id 
  FROM artists 
  WHERE user_id = '920946a9-1d77-45c9-bb72-aaf80aa2769e'
)
SELECT 
  t.id,
  t.song_title,
  t.composer_name,
  t.isrc,
  t.artist_name,
  t.split,
  t.created_at
FROM tracks t
CROSS JOIN user_artist ua
WHERE t.artist_id = ua.artist_id
ORDER BY t.created_at DESC;

