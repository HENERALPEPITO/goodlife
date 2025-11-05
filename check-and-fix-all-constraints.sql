-- Check and Fix ALL Foreign Key Constraints on Tracks Table
-- Run this in Supabase SQL Editor

-- Step 1: List ALL foreign key constraints on tracks table
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'tracks' 
  AND tc.constraint_type = 'FOREIGN KEY';

-- Step 2: Drop ALL possible foreign key constraints on tracks.artist_id
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'tracks'
          AND constraint_type = 'FOREIGN KEY'
          AND constraint_name IN (
            SELECT tc.constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_schema = 'public'
              AND tc.table_name = 'tracks'
              AND kcu.column_name = 'artist_id'
              AND tc.constraint_type = 'FOREIGN KEY'
          )
    ) LOOP
        EXECUTE 'ALTER TABLE tracks DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE';
    END LOOP;
END $$;

-- Step 3: Add the correct foreign key constraint
ALTER TABLE tracks
ADD CONSTRAINT tracks_artist_id_fkey 
FOREIGN KEY (artist_id) 
REFERENCES artists(id) 
ON DELETE CASCADE;

-- Step 4: Verify it was created correctly
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
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'tracks' 
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'artist_id';

