-- Migration: Sync user role from user_profiles to auth.users.raw_user_meta_data
-- This enables instant role access without database queries
-- 
-- Run this in Supabase SQL Editor to sync existing users

-- 1. Create a function to sync role to user_metadata
CREATE OR REPLACE FUNCTION sync_role_to_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Update user_metadata when user_profiles role changes
  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create trigger to auto-sync role changes
DROP TRIGGER IF EXISTS sync_role_trigger ON user_profiles;
CREATE TRIGGER sync_role_trigger
  AFTER INSERT OR UPDATE OF role ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_role_to_metadata();

-- 3. Sync existing users' roles to user_metadata (one-time migration)
-- This updates all existing users to have their role in user_metadata
UPDATE auth.users u
SET raw_user_meta_data = 
  COALESCE(u.raw_user_meta_data, '{}'::jsonb) || 
  jsonb_build_object('role', p.role)
FROM user_profiles p
WHERE u.id = p.id;

-- 4. Verify the sync worked
-- Run this query to check if roles are synced:
-- SELECT 
--   u.id,
--   u.email,
--   u.raw_user_meta_data->>'role' as metadata_role,
--   p.role as profile_role
-- FROM auth.users u
-- LEFT JOIN user_profiles p ON u.id = p.id
-- ORDER BY u.created_at DESC;

-- Note: This migration is safe to run multiple times.
-- The trigger ensures future role changes in user_profiles are automatically synced.
