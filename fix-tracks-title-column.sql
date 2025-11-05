-- Fix Tracks Table - Handle title column
-- Run this in Supabase SQL Editor

-- Check current columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'tracks'
ORDER BY ordinal_position;

-- Option 1: Remove NOT NULL constraint from title column (if it exists)
ALTER TABLE tracks 
ALTER COLUMN title DROP NOT NULL;

-- Option 2: If title column exists but we're using song_title, we can either:
-- A) Copy data from song_title to title for existing rows
UPDATE tracks 
SET title = song_title 
WHERE title IS NULL AND song_title IS NOT NULL;

-- B) Or drop the title column if it's not needed
-- ALTER TABLE tracks DROP COLUMN IF EXISTS title;

-- Verify the fix
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'tracks' 
  AND column_name IN ('title', 'song_title');

