-- Complete GoodLife Database Schema for Supabase
-- Run this SQL in your Supabase SQL Editor

-- ============================================
-- 1. USER PROFILES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'artist')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. TRACKS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  iswc TEXT,
  composers TEXT,
  release_date DATE,
  platform TEXT,
  territory TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. ROYALTIES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS royalties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
  artist_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_count INTEGER,
  gross_amount NUMERIC(12,2),
  admin_percent NUMERIC(5,2),
  net_amount NUMERIC(12,2),
  broadcast_date DATE,
  exploitation_source_name TEXT,
  territory TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. PAYMENT REQUESTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS payment_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 5. CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_tracks_artist_id ON tracks(artist_id);
CREATE INDEX IF NOT EXISTS idx_tracks_created_at ON tracks(created_at);
CREATE INDEX IF NOT EXISTS idx_royalties_track_id ON royalties(track_id);
CREATE INDEX IF NOT EXISTS idx_royalties_artist_id ON royalties(artist_id);
CREATE INDEX IF NOT EXISTS idx_royalties_broadcast_date ON royalties(broadcast_date);
CREATE INDEX IF NOT EXISTS idx_payment_requests_artist_id ON payment_requests(artist_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);

-- ============================================
-- 6. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE royalties ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. DROP EXISTING POLICIES (if re-running)
-- ============================================

DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;

DROP POLICY IF EXISTS "Artist can view own tracks" ON tracks;
DROP POLICY IF EXISTS "Admins can view all tracks" ON tracks;
DROP POLICY IF EXISTS "Admins can manage tracks" ON tracks;

DROP POLICY IF EXISTS "Artist can view own royalties" ON royalties;
DROP POLICY IF EXISTS "Admins can view all royalties" ON royalties;
DROP POLICY IF EXISTS "Admins can manage royalties" ON royalties;

DROP POLICY IF EXISTS "Artist can view own payment requests" ON payment_requests;
DROP POLICY IF EXISTS "Artist can create payment requests" ON payment_requests;
DROP POLICY IF EXISTS "Admins can view all payment requests" ON payment_requests;
DROP POLICY IF EXISTS "Admins can manage payment requests" ON payment_requests;

-- ============================================
-- 8. ROW LEVEL SECURITY POLICIES
-- ============================================

-- USER PROFILES POLICIES
CREATE POLICY "Users can view own profile" 
  ON user_profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON user_profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
  ON user_profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" 
  ON user_profiles FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- TRACKS POLICIES
CREATE POLICY "Artist can view own tracks" 
  ON tracks FOR SELECT 
  USING (artist_id = auth.uid());

CREATE POLICY "Admins can view all tracks" 
  ON tracks FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can manage tracks" 
  ON tracks FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ROYALTIES POLICIES
CREATE POLICY "Artist can view own royalties" 
  ON royalties FOR SELECT 
  USING (artist_id = auth.uid());

CREATE POLICY "Admins can view all royalties" 
  ON royalties FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can manage royalties" 
  ON royalties FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- PAYMENT REQUESTS POLICIES
CREATE POLICY "Artist can view own payment requests" 
  ON payment_requests FOR SELECT 
  USING (artist_id = auth.uid());

CREATE POLICY "Artist can create payment requests" 
  ON payment_requests FOR INSERT 
  WITH CHECK (artist_id = auth.uid());

CREATE POLICY "Admins can view all payment requests" 
  ON payment_requests FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can manage payment requests" 
  ON payment_requests FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 9. SAMPLE DATA FOR TESTING
-- ============================================

-- Note: You need to create users first through Supabase Auth Dashboard
-- Then add their profiles here. Example for testing:

-- If you create a test admin: admin@test.com
-- If you create a test artist: artist@test.com

-- Sample tracks (replace UUIDs with actual artist IDs after creating users)
-- INSERT INTO tracks (artist_id, title, iswc, composers, release_date, platform, territory)
-- VALUES 
--   ('artist-uuid-here', 'Sunset Dreams', 'T-123.456.789-0', 'John Doe, Jane Smith', '2024-01-15', 'Spotify', 'Global'),
--   ('artist-uuid-here', 'Morning Light', 'T-987.654.321-0', 'Jane Smith', '2024-03-20', 'Apple Music', 'US');

-- Sample royalties (replace UUIDs with actual track and artist IDs)
-- INSERT INTO royalties (track_id, artist_id, usage_count, gross_amount, admin_percent, net_amount, broadcast_date, exploitation_source_name, territory)
-- VALUES
--   ('track-uuid-here', 'artist-uuid-here', 15000, 750.00, 15.00, 637.50, '2024-10-01', 'Spotify', 'US'),
--   ('track-uuid-here', 'artist-uuid-here', 8500, 425.00, 15.00, 361.25, '2024-10-01', 'Apple Music', 'Global');

-- ============================================
-- 10. HELPFUL QUERIES FOR ADMINS
-- ============================================

-- View all artists with their total revenue
-- CREATE OR REPLACE VIEW artist_revenue_summary AS
-- SELECT 
--   up.id,
--   up.email,
--   COUNT(DISTINCT t.id) as total_tracks,
--   COUNT(r.id) as total_royalty_entries,
--   COALESCE(SUM(r.net_amount), 0) as total_revenue,
--   COALESCE(SUM(CASE WHEN pr.status = 'pending' THEN pr.amount ELSE 0 END), 0) as pending_payments
-- FROM user_profiles up
-- LEFT JOIN tracks t ON t.artist_id = up.id
-- LEFT JOIN royalties r ON r.artist_id = up.id
-- LEFT JOIN payment_requests pr ON pr.artist_id = up.id
-- WHERE up.role = 'artist'
-- GROUP BY up.id, up.email;

