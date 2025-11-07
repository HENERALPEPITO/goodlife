-- Fix title column NOT NULL constraint
-- Run this in Supabase SQL Editor

-- Option 1: Remove NOT NULL constraint from title column
ALTER TABLE tracks 
ALTER COLUMN title DROP NOT NULL;

-- Option 2: If you want to keep title and song_title in sync, update existing rows
UPDATE tracks 
SET title = song_title 
WHERE (title IS NULL OR title = '') AND song_title IS NOT NULL;

-- Option 3: If title column is not needed, drop it
-- ALTER TABLE tracks DROP COLUMN IF EXISTS title;

-- Verify the fix
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'tracks' 
  AND column_name IN ('title', 'song_title')
ORDER BY column_name;

