-- Verify artist exists and check foreign key constraint
-- Run this in Supabase SQL Editor

-- 1. Check if the artist_id exists in artists table
SELECT 
    id, 
    name, 
    email, 
    user_id,
    created_at
FROM artists 
WHERE id = '76918893-560c-4921-8ebc-0d33cb4fee49';

-- 2. Check current foreign key constraints on royalties.artist_id
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
  AND tc.table_name = 'royalties'
  AND kcu.column_name = 'artist_id'
  AND tc.table_schema = 'public';

-- 3. List all artists to verify the structure
SELECT id, name, email, user_id FROM artists LIMIT 10;

