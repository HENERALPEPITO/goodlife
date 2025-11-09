-- Fix ALL foreign key constraints to point to artists table instead of users
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. Fix ROYALTIES table
-- ============================================
ALTER TABLE royalties DROP CONSTRAINT IF EXISTS royalties_artist_id_fkey;

ALTER TABLE royalties 
ADD CONSTRAINT royalties_artist_id_fkey 
FOREIGN KEY (artist_id) 
REFERENCES artists(id) 
ON DELETE CASCADE;

-- ============================================
-- 2. Fix PAYMENT_REQUESTS table
-- ============================================
ALTER TABLE payment_requests DROP CONSTRAINT IF EXISTS payment_requests_artist_id_fkey;

ALTER TABLE payment_requests 
ADD CONSTRAINT payment_requests_artist_id_fkey 
FOREIGN KEY (artist_id) 
REFERENCES artists(id) 
ON DELETE CASCADE;

-- ============================================
-- 3. Fix INVOICES table (if it has artist_id)
-- ============================================
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_artist_id_fkey;

ALTER TABLE invoices 
ADD CONSTRAINT invoices_artist_id_fkey 
FOREIGN KEY (artist_id) 
REFERENCES artists(id) 
ON DELETE CASCADE;

-- ============================================
-- 4. Verify all constraints
-- ============================================
SELECT 
    tc.table_name,
    tc.constraint_name,
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
  AND tc.table_schema = 'public'
  AND kcu.column_name = 'artist_id'
  AND ccu.table_name = 'artists'
ORDER BY tc.table_name;


