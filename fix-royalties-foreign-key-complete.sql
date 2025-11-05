-- Fix royalties table foreign key constraint - COMPLETE VERSION
-- The artist_id should reference artists(id), not auth.users(id)
-- Run this in Supabase SQL Editor

-- First, check ALL current foreign key constraints on royalties.artist_id
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'royalties'
  AND kcu.column_name = 'artist_id'
  AND tc.table_schema = 'public';

-- Drop ALL foreign key constraints on royalties.artist_id
-- (There might be multiple with different names)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tc.constraint_name
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_name = 'royalties'
          AND kcu.column_name = 'artist_id'
          AND tc.table_schema = 'public'
    ) LOOP
        EXECUTE 'ALTER TABLE royalties DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
        RAISE NOTICE 'Dropped constraint: %', r.constraint_name;
    END LOOP;
END $$;

-- Now create the correct foreign key constraint
ALTER TABLE royalties 
ADD CONSTRAINT royalties_artist_id_fkey 
FOREIGN KEY (artist_id) 
REFERENCES artists(id) 
ON DELETE CASCADE;

-- Verify the fix
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'royalties'
  AND kcu.column_name = 'artist_id'
  AND tc.table_schema = 'public';

