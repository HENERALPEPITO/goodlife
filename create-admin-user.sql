-- Create/Update Admin User Profile
-- Run this in your Supabase SQL Editor

-- First, ensure the user_profiles table exists (if not already created)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'artist')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- Insert or update the admin user profile
-- This uses ON CONFLICT to update if the profile already exists
INSERT INTO user_profiles (id, email, role, created_at)
VALUES (
  '17f0111b-138a-4217-9c46-a9a513411368',
  'admin@test.com',
  'admin',
  NOW()
)
ON CONFLICT (id) 
DO UPDATE SET 
  email = EXCLUDED.email,
  role = EXCLUDED.role;

-- Verify the admin user was created/updated
SELECT id, email, role, created_at 
FROM user_profiles 
WHERE id = '17f0111b-138a-4217-9c46-a9a513411368';

-- Also create/update the other users if needed
INSERT INTO user_profiles (id, email, role, created_at)
VALUES 
  ('920946a9-1d77-45c9-bb72-aaf80aa2769e', 'artist@test.com', 'artist', NOW()),
  ('bf4e61ab-be16-422e-be8e-21725828bfe0', 'sydney@example.com', 'artist', NOW())
ON CONFLICT (id) 
DO UPDATE SET 
  email = EXCLUDED.email,
  role = EXCLUDED.role;

-- Show all user profiles
SELECT id, email, role, created_at 
FROM user_profiles 
ORDER BY email;

