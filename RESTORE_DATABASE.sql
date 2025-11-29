-- ============================================
-- COMPLETE DATABASE RESTORE SCRIPT
-- Run this ENTIRE file in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
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

-- ============================================
-- 2. ARTISTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS artists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  address_locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. TRACKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id UUID REFERENCES artists(id) ON DELETE CASCADE,
  title TEXT,
  song_title TEXT,
  artist_name TEXT,
  composer_name TEXT,
  isrc TEXT,
  iswc TEXT,
  split TEXT DEFAULT '100%',
  release_date DATE,
  platform TEXT,
  territory TEXT,
  uploaded_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. ROYALTIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS royalties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
  artist_id UUID REFERENCES artists(id) ON DELETE CASCADE,
  usage_count INTEGER,
  gross_amount NUMERIC(12,2),
  admin_percent NUMERIC(5,2),
  net_amount NUMERIC(12,2),
  broadcast_date DATE,
  exploitation_source_name TEXT,
  territory TEXT,
  is_paid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 5. PAYMENT REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payment_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id UUID REFERENCES artists(id) ON DELETE CASCADE,
  amount NUMERIC(12,2),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 6. INVOICES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id UUID REFERENCES artists(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  mode_of_payment TEXT NOT NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 7. CREATE INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_artists_user_id ON artists(user_id);
CREATE INDEX IF NOT EXISTS idx_artists_email ON artists(email);
CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name);

CREATE INDEX IF NOT EXISTS idx_tracks_artist_id ON tracks(artist_id);
CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title);
CREATE INDEX IF NOT EXISTS idx_tracks_song_title ON tracks(song_title);
CREATE INDEX IF NOT EXISTS idx_tracks_isrc ON tracks(isrc);
CREATE INDEX IF NOT EXISTS idx_tracks_created_at ON tracks(created_at);

CREATE INDEX IF NOT EXISTS idx_royalties_track_id ON royalties(track_id);
CREATE INDEX IF NOT EXISTS idx_royalties_artist_id ON royalties(artist_id);
CREATE INDEX IF NOT EXISTS idx_royalties_broadcast_date ON royalties(broadcast_date);
CREATE INDEX IF NOT EXISTS idx_royalties_artist_date ON royalties(artist_id, broadcast_date DESC);
CREATE INDEX IF NOT EXISTS idx_royalties_is_paid ON royalties(is_paid);

CREATE INDEX IF NOT EXISTS idx_payment_requests_artist_id ON payment_requests(artist_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);

CREATE INDEX IF NOT EXISTS idx_invoices_artist_id ON invoices(artist_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);

-- ============================================
-- 8. DISABLE ROW LEVEL SECURITY (FOR DEVELOPMENT)
-- ============================================
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE artists DISABLE ROW LEVEL SECURITY;
ALTER TABLE tracks DISABLE ROW LEVEL SECURITY;
ALTER TABLE royalties DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 9. ADD MISSING COLUMNS TO INVOICES
-- ============================================
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_request_id UUID REFERENCES payment_requests(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS file_url TEXT;

-- ============================================
-- 10. DATABASE FUNCTIONS
-- ============================================

-- Function to get total unpaid royalties for an artist
CREATE OR REPLACE FUNCTION get_unpaid_royalties_total(artist_uuid UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(net_amount), 0)
  INTO total
  FROM royalties
  WHERE artist_id = artist_uuid
    AND (is_paid = false OR is_paid IS NULL);
  
  RETURN total;
END;
$$;

-- Function to mark royalties as paid for an artist
CREATE OR REPLACE FUNCTION mark_royalties_as_paid(artist_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE royalties
  SET is_paid = true
  WHERE artist_id = artist_uuid
    AND (is_paid = false OR is_paid IS NULL);
END;
$$;

-- Function to restore royalties when a payment request is rejected
CREATE OR REPLACE FUNCTION restore_royalties_on_rejection(request_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_artist_id UUID;
BEGIN
  -- Get the artist_id from the payment request
  SELECT artist_id INTO v_artist_id
  FROM payment_requests
  WHERE id = request_uuid;
  
  -- Restore all paid royalties for this artist back to unpaid
  -- This assumes only one pending/approved payment request at a time per artist
  UPDATE royalties
  SET is_paid = false
  WHERE artist_id = v_artist_id
    AND is_paid = true;
END;
$$;

-- ============================================
-- 11. GRANT PERMISSIONS
-- ============================================
GRANT ALL ON user_profiles TO postgres, authenticated, service_role;
GRANT ALL ON artists TO postgres, authenticated, service_role;
GRANT ALL ON tracks TO postgres, authenticated, service_role;
GRANT ALL ON royalties TO postgres, authenticated, service_role;
GRANT ALL ON payment_requests TO postgres, authenticated, service_role;
GRANT ALL ON invoices TO postgres, authenticated, service_role;

GRANT SELECT ON user_profiles TO anon;
GRANT SELECT ON artists TO anon;
GRANT SELECT ON tracks TO anon;
GRANT SELECT ON royalties TO anon;

GRANT EXECUTE ON FUNCTION get_unpaid_royalties_total(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION mark_royalties_as_paid(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION restore_royalties_on_rejection(UUID) TO authenticated, service_role;

-- ============================================
-- 12. CREATE STORAGE BUCKETS (Run separately in Storage settings)
-- ============================================
-- In Supabase Dashboard > Storage, create these buckets:
-- 1. "royalties" - for CSV uploads
-- 2. "invoices" - for PDF invoices
-- Set both to public or configure appropriate policies

-- ============================================
-- 13. VERIFICATION
-- ============================================
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
