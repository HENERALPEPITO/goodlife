-- ============================================
-- Quick Add Artist Script
-- Email: artist@test.com
-- UUID: 920946a9-1d77-45c9-bb72-aaf80aa2769e
-- ============================================
--
-- IMPORTANT: You must create the auth user first!
-- The easiest way is via Supabase Dashboard or Admin API.
--
-- Since Supabase Admin API doesn't allow setting custom UUIDs,
-- you have two options:
--
-- OPTION 1: Create user via Dashboard (if you need the specific UUID)
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Click "Add User" 
-- 3. Email: artist@test.com
-- 4. Password: (set password)
-- 5. Auto Confirm: ON
-- 6. Note the generated UUID (it may be different)
--
-- OPTION 2: Use existing user (recommended)
-- The user already exists with UUID: 2e1df7aa-59c0-4488-9db3-d7bba553d3ee
-- You can use this UUID instead, or create a new one.

-- This script assumes the auth user exists with the target UUID
-- If it doesn't exist, you'll get a foreign key constraint error

-- Delete old profile if exists with different UUID
DELETE FROM user_profiles 
WHERE email = 'artist@test.com' 
  AND id != '920946a9-1d77-45c9-bb72-aaf80aa2769e';

-- Create/update profile
INSERT INTO user_profiles (id, email, role, created_at)
VALUES (
  '920946a9-1d77-45c9-bb72-aaf80aa2769e',
  'artist@test.com',
  'artist',
  NOW()
)
ON CONFLICT (id) 
DO UPDATE SET
  email = EXCLUDED.email,
  role = EXCLUDED.role;

-- Verify
SELECT 
  '✅ Profile' as status,
  id,
  email,
  role
FROM user_profiles
WHERE id = '920946a9-1d77-45c9-bb72-aaf80aa2769e';


