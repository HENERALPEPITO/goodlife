-- Make tracks table columns nullable for composer_name and isrc
-- This allows uploads even when CSV has empty values
-- Run this in Supabase SQL Editor

-- Make composer_name nullable
ALTER TABLE tracks 
ALTER COLUMN composer_name DROP NOT NULL;

-- Make isrc nullable
ALTER TABLE tracks 
ALTER COLUMN isrc DROP NOT NULL;

-- Make artist_name nullable (if it's not already)
ALTER TABLE tracks 
ALTER COLUMN artist_name DROP NOT NULL;

-- Verify the changes
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'tracks' 
  AND column_name IN ('composer_name', 'isrc', 'artist_name', 'song_title')
ORDER BY column_name;

