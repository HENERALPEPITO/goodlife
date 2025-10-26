-- Goodlife Database Schema for Supabase
-- Run this SQL in your Supabase SQL Editor

-- Create user profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('artist', 'label', 'manager')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tracks table
CREATE TABLE IF NOT EXISTS tracks (   
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  isrc TEXT NOT NULL,
  composers TEXT NOT NULL,
  release_date DATE NOT NULL,
  platform TEXT NOT NULL,
  territory TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create royalty_statements table
CREATE TABLE IF NOT EXISTS royalty_statements (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  track_title TEXT NOT NULL,
  platform TEXT NOT NULL,
  period TEXT NOT NULL,
  streams INTEGER NOT NULL,
  revenue_usd DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('paid', 'pending')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tracks_created_at ON tracks(created_at);
CREATE INDEX IF NOT EXISTS idx_royalty_statements_track_id ON royalty_statements(track_id);
CREATE INDEX IF NOT EXISTS idx_royalty_statements_status ON royalty_statements(status);
CREATE INDEX IF NOT EXISTS idx_royalty_statements_period ON royalty_statements(period);

-- Insert sample data
INSERT INTO tracks (id, title, isrc, composers, release_date, platform, territory, created_at) VALUES
('t1', 'Sunrise', 'US-ABC-25-00001', 'C. Elipan, A. Reyes', '2025-07-12', 'Spotify', 'Global', NOW()),
('t2', 'Ocean Drive', 'US-ABC-25-00002', 'C. Elipan', '2025-05-03', 'Apple Music', 'US', NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert sample royalty data
INSERT INTO royalty_statements (id, track_id, track_title, platform, period, streams, revenue_usd, status, created_at) VALUES
('r1', 't1', 'Sunrise', 'Spotify', '2025-Q1', 15000, 750.50, 'paid', NOW()),
('r2', 't1', 'Sunrise', 'Apple Music', '2025-Q1', 8500, 425.25, 'paid', NOW()),
('r3', 't2', 'Ocean Drive', 'Spotify', '2025-Q1', 22000, 1100.00, 'pending', NOW()),
('r4', 't2', 'Ocean Drive', 'YouTube', '2025-Q1', 12000, 600.00, 'paid', NOW())
ON CONFLICT (id) DO NOTHING;

-- Create a test user account (you'll need to create this user in Supabase Auth first)
-- This is just the profile - the actual user needs to be created through Supabase Auth
-- For testing, you can use: test@test.com / password: testpassword123

-- Enable Row Level Security (RLS)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE royalty_statements ENABLE ROW LEVEL SECURITY;

-- Create policies for user_profiles
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Create policies for public access (you may want to restrict this based on your auth requirements)
CREATE POLICY "Allow public read access on tracks" ON tracks FOR SELECT USING (true);
CREATE POLICY "Allow public insert on tracks" ON tracks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on tracks" ON tracks FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on tracks" ON tracks FOR DELETE USING (true);

CREATE POLICY "Allow public read access on royalty_statements" ON royalty_statements FOR SELECT USING (true);
CREATE POLICY "Allow public insert on royalty_statements" ON royalty_statements FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on royalty_statements" ON royalty_statements FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on royalty_statements" ON royalty_statements FOR DELETE USING (true);
