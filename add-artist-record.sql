-- Add Artist Record for artist@test.com
-- Run this in Supabase SQL Editor

-- Insert artist record
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

-- Verify the artist was added
SELECT id, user_id, name, email, phone, address, address_locked, created_at
FROM artists
WHERE email = 'artist@test.com';

