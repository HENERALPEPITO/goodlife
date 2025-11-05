-- Fix RLS Infinite Recursion Issue
-- Run this ENTIRE script in Supabase SQL Editor to fix the recursion problem

-- Step 1: Drop ALL existing policies (including the recursive ones)
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON user_profiles;

-- Step 2: Drop any functions that might cause recursion
DROP FUNCTION IF EXISTS is_admin();
DROP FUNCTION IF EXISTS check_is_admin(UUID);

-- Step 3: Ensure the table exists
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'artist')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- Step 5: Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Step 6: Create simple, non-recursive policies
-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Step 7: Verify - list all policies (should show 3 policies, no admin policies)
SELECT 
  policyname, 
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'user_profiles'
ORDER BY policyname;

-- Done! The recursion should be fixed now.
-- Users can only access their own profiles.
-- Admin operations should use service role key in API routes.

