-- Fix ALL Foreign Key Constraints on Tracks Table
-- Run this in Supabase SQL Editor

-- Step 1: Check all current foreign key constraints on tracks table
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
  AND tc.constraint_type = 'FOREIGN KEY';

-- Step 2: Drop ALL foreign key constraints on tracks table
ALTER TABLE tracks DROP CONSTRAINT IF EXISTS tracks_artist_id_fkey;
ALTER TABLE tracks DROP CONSTRAINT IF EXISTS tracks_artist_id_fkey1;
ALTER TABLE tracks DROP CONSTRAINT IF EXISTS tracks_artist_id_fkey2;
ALTER TABLE tracks DROP CONSTRAINT IF EXISTS tracks_artist_id_fkey3;

-- Step 3: Make sure artist_id column exists and can reference artists
-- First, check if artist_id column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tracks' AND column_name = 'artist_id'
    ) THEN
        ALTER TABLE tracks ADD COLUMN artist_id UUID;
    END IF;
END $$;

-- Step 4: Add the correct foreign key constraint
ALTER TABLE tracks
ADD CONSTRAINT tracks_artist_id_fkey 
FOREIGN KEY (artist_id) 
REFERENCES artists(id) 
ON DELETE CASCADE;

-- Step 5: Verify the constraint was created correctly
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

-- Step 6: Check what artists exist (to verify the artist_id you're trying to use exists)
SELECT id, name, email FROM artists;

