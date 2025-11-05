-- Fix Tracks Table Foreign Key
-- The artist_id should reference the artists table, not users table
-- Run this in Supabase SQL Editor

-- Step 1: Drop the existing foreign key constraint if it exists
ALTER TABLE tracks 
DROP CONSTRAINT IF EXISTS tracks_artist_id_fkey;

-- Step 2: Add the correct foreign key constraint to reference artists table
ALTER TABLE tracks
ADD CONSTRAINT tracks_artist_id_fkey 
FOREIGN KEY (artist_id) 
REFERENCES artists(id) 
ON DELETE CASCADE;

-- Step 3: Verify the constraint was created correctly
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'tracks' 
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'artist_id';

