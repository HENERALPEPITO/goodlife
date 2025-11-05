-- Check Tracks for Artist
-- Run this in Supabase SQL Editor

-- Step 1: Check what tracks exist and their artist_id
SELECT 
  t.id,
  t.artist_id,
  t.song_title,
  t.artist_name,
  t.created_at,
  a.id AS artist_table_id,
  a.name AS artist_name_from_table,
  a.user_id AS artist_user_id
FROM tracks t
LEFT JOIN artists a ON t.artist_id = a.id
ORDER BY t.created_at DESC
LIMIT 20;

-- Step 2: Check tracks for the specific artist
SELECT 
  t.id,
  t.song_title,
  t.composer_name,
  t.isrc,
  t.artist_name,
  t.split,
  t.created_at
FROM tracks t
WHERE t.artist_id = '76918893-560c-4921-8ebc-0d33cb4fee49'
ORDER BY t.created_at DESC;

-- Step 3: Verify the artist record
SELECT 
  a.id,
  a.name,
  a.email,
  a.user_id,
  up.email AS user_email
FROM artists a
LEFT JOIN user_profiles up ON a.user_id = up.id
WHERE a.user_id = '920946a9-1d77-45c9-bb72-aaf80aa2769e';

