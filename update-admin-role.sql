-- Update admin@test.com to admin role
-- Run this in Supabase SQL Editor

-- Update the role for admin@test.com
UPDATE user_profiles 
SET role = 'admin' 
WHERE email = 'admin@test.com';

-- Verify the update
SELECT id, email, role, created_at 
FROM user_profiles 
WHERE email = 'admin@test.com';

