-- Fix payment_requests table foreign key constraint
-- The artist_id should reference artists(id), not auth.users(id)
-- Run this in Supabase SQL Editor

-- Drop the wrong constraint
ALTER TABLE payment_requests DROP CONSTRAINT IF EXISTS payment_requests_artist_id_fkey;

-- Create the correct constraint pointing to artists table
ALTER TABLE payment_requests 
ADD CONSTRAINT payment_requests_artist_id_fkey 
FOREIGN KEY (artist_id) 
REFERENCES artists(id) 
ON DELETE CASCADE;

-- Verify the fix
SELECT 
    tc.constraint_name,
    ccu.table_name AS references_table
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu 
    ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'payment_requests' 
    AND tc.constraint_type = 'FOREIGN KEY'
    AND tc.constraint_name = 'payment_requests_artist_id_fkey';

