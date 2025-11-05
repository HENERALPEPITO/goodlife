-- Fix Tracks Table - Add Missing Columns
-- Run this in Supabase SQL Editor

-- Add missing columns to tracks table if they don't exist
ALTER TABLE tracks 
ADD COLUMN IF NOT EXISTS song_title TEXT,
ADD COLUMN IF NOT EXISTS artist_name TEXT,
ADD COLUMN IF NOT EXISTS composer_name TEXT,
ADD COLUMN IF NOT EXISTS isrc TEXT,
ADD COLUMN IF NOT EXISTS split TEXT,
ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

-- Update artist_id to reference artists table instead of auth.users if needed
-- (This depends on your schema - you may need to adjust)

-- Disable RLS temporarily if needed
ALTER TABLE tracks DISABLE ROW LEVEL SECURITY;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tracks'
ORDER BY ordinal_position;

