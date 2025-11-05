-- Temporarily Disable RLS on user_profiles
-- This allows login to work without RLS restrictions
-- Run this in Supabase SQL Editor

-- Disable RLS on user_profiles table
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'user_profiles';

-- Note: RLS is now disabled. This is temporary for testing.
-- Re-enable later with: ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

