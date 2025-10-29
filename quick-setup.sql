-- ============================================
-- QUICK SETUP SCRIPT FOR GOODLIFE
-- ============================================
-- Copy and run this entire script in your Supabase SQL Editor
-- This is a condensed version of complete-database-schema.sql

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create all tables
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'artist')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS payment_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  mode_of_payment TEXT NOT NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_tracks_artist_id ON tracks(artist_id);
CREATE INDEX IF NOT EXISTS idx_royalties_artist_id ON royalties(artist_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_artist_id ON payment_requests(artist_id);
CREATE INDEX IF NOT EXISTS idx_invoices_artist_id ON invoices(artist_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- 4. Disable RLS for development (enable before production)
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE tracks DISABLE ROW LEVEL SECURITY;
ALTER TABLE royalties DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;

-- 5. RLS policies (commented out for development)
/*
-- User Profiles
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON user_profiles
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Tracks
CREATE POLICY "Artist can view own tracks" ON tracks
  FOR SELECT USING (artist_id = auth.uid());

CREATE POLICY "Admins can view all tracks" ON tracks
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins can manage tracks" ON tracks
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Royalties
CREATE POLICY "Artist can view own royalties" ON royalties
  FOR SELECT USING (artist_id = auth.uid());

CREATE POLICY "Admins can view all royalties" ON royalties
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins can manage royalties" ON royalties
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Payment Requests
CREATE POLICY "Artist can view own payment requests" ON payment_requests
  FOR SELECT USING (artist_id = auth.uid());

CREATE POLICY "Artist can create payment requests" ON payment_requests
  FOR INSERT WITH CHECK (artist_id = auth.uid());

CREATE POLICY "Admins can view all payment requests" ON payment_requests
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins can manage payment requests" ON payment_requests
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Invoices
CREATE POLICY "Artist can view own invoices" ON invoices
  FOR SELECT USING (artist_id = auth.uid());

CREATE POLICY "Artist can create invoices" ON invoices
  FOR INSERT WITH CHECK (artist_id = auth.uid());

CREATE POLICY "Admins can view all invoices" ON invoices
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins can manage invoices" ON invoices
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
  ));
*/

-- 6. Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Database setup complete! All tables created successfully.';
  RAISE NOTICE '⚠️  RLS is DISABLED for development (enable before production)';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Create a user in Authentication → Users';
  RAISE NOTICE '2. Add their profile to user_profiles table';
  RAISE NOTICE '3. Restart your Next.js dev server';
END $$;

