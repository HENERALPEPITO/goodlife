-- Verify Artist Exists and Check Tracks Table
-- Run this in Supabase SQL Editor

-- Step 1: Verify the artist exists with that exact ID
SELECT id, name, email, user_id, created_at
FROM artists
WHERE id = '76918893-560c-4921-8ebc-0d33cb4fee49';

-- Step 2: List all artists
SELECT id, name, email FROM artists;

-- Step 3: Check the tracks table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tracks'
ORDER BY ordinal_position;

-- Step 4: Verify the foreign key constraint is correct
SELECT
    tc.constraint_name,
    kcu.column_name,
    ccu.table_schema || '.' || ccu.table_name AS foreign_table,
    ccu.column_name AS foreign_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'tracks' 
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'artist_id';

