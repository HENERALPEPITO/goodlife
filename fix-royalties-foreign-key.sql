-- Fix royalties table foreign key constraint
-- The artist_id should reference artists(id), not auth.users(id)
-- Run this in Supabase SQL Editor

-- First, check current foreign key constraints
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
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'royalties'
  AND kcu.column_name = 'artist_id';

-- Drop the incorrect foreign key constraint
ALTER TABLE royalties 
DROP CONSTRAINT IF EXISTS royalties_artist_id_fkey;

-- Recreate the foreign key to reference artists(id) instead of auth.users(id)
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
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'royalties'
  AND kcu.column_name = 'artist_id';

