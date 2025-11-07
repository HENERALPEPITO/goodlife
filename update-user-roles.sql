-- Update User Roles in user_profiles table
-- Run this SQL in your Supabase SQL Editor

-- Update artist@test.com to 'artist' role
UPDATE user_profiles 
SET role = 'artist' 
WHERE id = '920946a9-1d77-45c9-bb72-aaf80aa2769e' 
  AND email = 'artist@test.com';

-- Update admin@test.com to 'admin' role
UPDATE user_profiles 
SET role = 'admin' 
WHERE id = '17f0111b-138a-4217-9c46-a9a513411368' 
  AND email = 'admin@test.com';

-- Update sydney@example.com to 'artist' role
UPDATE user_profiles 
SET role = 'artist' 
WHERE id = 'bf4e61ab-be16-422e-be8e-21725828bfe0' 
  AND email = 'sydney@example.com';

-- Verify the updates
SELECT id, email, role 
FROM user_profiles 
WHERE id IN (
  '920946a9-1d77-45c9-bb72-aaf80aa2769e',
  '17f0111b-138a-4217-9c46-a9a513411368',
  'bf4e61ab-be16-422e-be8e-21725828bfe0'
)
ORDER BY email;

