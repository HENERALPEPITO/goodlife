-- ============================================
-- ADMIN FEATURES MIGRATION
-- User Management & Bulk Royalty Operations
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. USER PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'artist')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- ============================================
-- 2. ROYALTIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS royalties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_title TEXT,
  artist_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  artist_email TEXT,
  platform TEXT,
  territory TEXT,
  usage_count INTEGER,
  gross_amount NUMERIC(10, 2),
  net_amount NUMERIC(10, 2),
  admin_percent NUMERIC(5, 2),
  broadcast_date DATE,
  exploitation_source_name TEXT,
  track_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. SEARCH INDEXES FOR ROYALTIES
-- ============================================
-- Full-text search on track_title
CREATE INDEX IF NOT EXISTS idx_royalties_track_title_fts 
  ON royalties USING gin (to_tsvector('simple', coalesce(track_title, '')));

-- B-tree indexes for exact matches and filtering
CREATE INDEX IF NOT EXISTS idx_royalties_artist_email ON royalties(artist_email);
CREATE INDEX IF NOT EXISTS idx_royalties_artist_id ON royalties(artist_id);
CREATE INDEX IF NOT EXISTS idx_royalties_platform ON royalties(platform);
CREATE INDEX IF NOT EXISTS idx_royalties_territory ON royalties(territory);
CREATE INDEX IF NOT EXISTS idx_royalties_broadcast_date ON royalties(broadcast_date);
CREATE INDEX IF NOT EXISTS idx_royalties_created_at ON royalties(created_at DESC);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_royalties_artist_date 
  ON royalties(artist_id, broadcast_date DESC);

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can see all profiles
CREATE POLICY IF NOT EXISTS "Admins can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Policy: Users can view their own profile
CREATE POLICY IF NOT EXISTS "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Policy: Admins can insert profiles (will be handled via service role in API)
CREATE POLICY IF NOT EXISTS "Admins can insert profiles"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Enable RLS on royalties
ALTER TABLE royalties ENABLE ROW LEVEL SECURITY;

-- Policy: Artists can view their own royalties
CREATE POLICY IF NOT EXISTS "Artists can view own royalties"
  ON royalties FOR SELECT
  TO authenticated
  USING (artist_id = auth.uid());

-- Policy: Admins can view all royalties
CREATE POLICY IF NOT EXISTS "Admins can view all royalties"
  ON royalties FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Policy: Admins can delete royalties
CREATE POLICY IF NOT EXISTS "Admins can delete royalties"
  ON royalties FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Policy: Admins can update royalties
CREATE POLICY IF NOT EXISTS "Admins can update royalties"
  ON royalties FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Policy: Admins can insert royalties
CREATE POLICY IF NOT EXISTS "Admins can insert royalties"
  ON royalties FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- ============================================
-- 5. HELPER FUNCTIONS
-- ============================================

-- Function to check if a user is an admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for bulk delete with admin check
CREATE OR REPLACE FUNCTION delete_royalties_bulk(royalty_ids UUID[])
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Check if the caller is an admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can bulk delete royalties';
  END IF;

  -- Perform the delete
  DELETE FROM royalties
  WHERE id = ANY(royalty_ids);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Run this migration with: psql -U postgres -d your_database -f admin-features-migration.sql
-- Or apply via Supabase dashboard SQL editor



