-- ============================================================================
-- Supabase Storage Setup for Royalty CSV Processing (Public - No RLS)
-- ============================================================================
-- This migration sets up:
-- 1. The royalty-uploads storage bucket (public)
-- 2. Full public access policies (no restrictions)
-- ============================================================================

-- Step 1: Create the royalty-uploads bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('royalty-uploads', 'royalty-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Drop any existing restrictive policies
DROP POLICY IF EXISTS "Admins can upload royalty CSVs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update their royalty CSVs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete their royalty CSVs" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for royalty CSVs" ON storage.objects;
DROP POLICY IF EXISTS "Public full access for royalty uploads" ON storage.objects;
DROP POLICY IF EXISTS "Public insert for royalty uploads" ON storage.objects;
DROP POLICY IF EXISTS "Public update for royalty uploads" ON storage.objects;
DROP POLICY IF EXISTS "Public delete for royalty uploads" ON storage.objects;

-- ============================================================================
-- Full Public Access Policies (No RLS Restrictions)
-- ============================================================================

-- Allow anyone to read files from this bucket
CREATE POLICY "Public read access for royalty uploads"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'royalty-uploads');

-- Allow anyone to upload files to this bucket
CREATE POLICY "Public insert for royalty uploads"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'royalty-uploads');

-- Allow anyone to update files in this bucket
CREATE POLICY "Public update for royalty uploads"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'royalty-uploads')
WITH CHECK (bucket_id = 'royalty-uploads');

-- Allow anyone to delete files from this bucket
CREATE POLICY "Public delete for royalty uploads"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'royalty-uploads');

-- ============================================================================
-- Optional: Cleanup Function for Old Files
-- ============================================================================
CREATE OR REPLACE FUNCTION delete_old_royalty_uploads()
RETURNS void AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'royalty-uploads'
    AND created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION delete_old_royalty_uploads() TO authenticated;
GRANT EXECUTE ON FUNCTION delete_old_royalty_uploads() TO anon;
