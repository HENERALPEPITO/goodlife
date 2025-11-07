-- Add Artist Record for artist@test.com
-- This creates the user profile first, then the artist record
-- Run this in Supabase SQL Editor

-- Step 1: Create user profile if it doesn't exist
INSERT INTO user_profiles (id, email, role, created_at)
VALUES (
  '920946a9-1d77-45c9-bb72-aaf80aa2769e',
  'artist@test.com',
  'artist',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  role = EXCLUDED.role;

-- Step 2: Verify user profile was created
SELECT id, email, role FROM user_profiles WHERE id = '920946a9-1d77-45c9-bb72-aaf80aa2769e';

-- Step 3: Insert artist record
INSERT INTO artists (user_id, name, email, address, address_locked, created_at)
VALUES (
  '920946a9-1d77-45c9-bb72-aaf80aa2769e',
  'Artist',
  'artist@test.com',
  'Profesor Hermida 6, 3-3C, 36960 Sanxenxo, Spain',
  false,
  NOW()
)
ON CONFLICT DO NOTHING;

-- Step 4: Verify the artist was added
SELECT id, user_id, name, email, phone, address, address_locked, created_at
FROM artists
WHERE email = 'artist@test.com';

