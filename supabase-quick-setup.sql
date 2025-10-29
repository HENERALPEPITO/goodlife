-- Quick Setup for Royalty Uploader
-- Run this in your Supabase SQL Editor

-- Create royalties table
CREATE TABLE IF NOT EXISTS royalties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  song_title TEXT,
  iswc TEXT,
  song_composers TEXT,
  broadcast_date DATE,
  territory TEXT,
  exploitation_source_name TEXT,
  usage_count INTEGER,
  gross_amount NUMERIC,
  administration_percent NUMERIC,
  net_amount NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable RLS for now (for testing)
ALTER TABLE royalties DISABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own data" ON royalties;
DROP POLICY IF EXISTS "Users can insert their own data" ON royalties;
DROP POLICY IF EXISTS "Users can update their own data" ON royalties;
DROP POLICY IF EXISTS "Users can delete their own data" ON royalties;

-- Create a simple policy that allows all operations (for testing)
ALTER TABLE royalties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations" ON royalties FOR ALL USING (true) WITH CHECK (true);






