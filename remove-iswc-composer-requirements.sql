-- Remove NOT NULL constraints from iswc and composer_name
-- This makes them optional for uploads
-- Run this in Supabase SQL Editor

-- Make composer_name nullable
ALTER TABLE tracks 
ALTER COLUMN composer_name DROP NOT NULL;

-- Make isrc nullable (isrc is the column name, iswc is the CSV field name)
ALTER TABLE tracks 
ALTER COLUMN isrc DROP NOT NULL;

-- Verify the changes
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'tracks' 
  AND column_name IN ('composer_name', 'isrc')
ORDER BY column_name;

