-- Fix payment_requests foreign key constraint - FINAL VERSION
-- This script finds and drops ALL foreign key constraints on artist_id, then creates the correct one
-- Run this in Supabase SQL Editor

-- Step 1: Find ALL foreign key constraints on payment_requests.artist_id
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_schema || '.' || ccu.table_name AS foreign_table,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'payment_requests'
  AND kcu.column_name = 'artist_id'
  AND tc.table_schema = 'public';

-- Step 2: Drop ALL foreign key constraints on payment_requests.artist_id
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
          AND tc.table_name = 'payment_requests'
          AND kcu.column_name = 'artist_id'
          AND tc.table_schema = 'public'
    ) LOOP
        EXECUTE 'ALTER TABLE payment_requests DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE';
        RAISE NOTICE 'Dropped constraint: %', r.constraint_name;
    END LOOP;
END $$;

-- Step 3: Create the correct foreign key constraint pointing to artists(id)
ALTER TABLE payment_requests 
ADD CONSTRAINT payment_requests_artist_id_fkey 
FOREIGN KEY (artist_id) 
REFERENCES artists(id) 
ON DELETE CASCADE;

-- Step 4: Verify the fix
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_schema || '.' || ccu.table_name AS foreign_table,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'payment_requests'
  AND kcu.column_name = 'artist_id'
  AND tc.table_schema = 'public';

-- The result should show: foreign_table = 'public.artists', foreign_column_name = 'id'


