-- Direct fix for payment_requests foreign key constraint
-- This uses pg_constraint to find and drop the constraint directly
-- Run this in Supabase SQL Editor

-- Method 1: Try dropping by the exact constraint name we know exists
ALTER TABLE payment_requests DROP CONSTRAINT IF EXISTS payment_requests_artist_id_fkey CASCADE;

-- Method 2: Find and drop ALL foreign key constraints on payment_requests.artist_id using pg_constraint
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'payment_requests'::regclass
        AND contype = 'f'
        AND conkey = (
            SELECT array_agg(attnum)
            FROM pg_attribute
            WHERE attrelid = 'payment_requests'::regclass
            AND attname = 'artist_id'
        )
    LOOP
        EXECUTE 'ALTER TABLE payment_requests DROP CONSTRAINT ' || quote_ident(constraint_record.conname) || ' CASCADE';
        RAISE NOTICE 'Dropped constraint: %', constraint_record.conname;
    END LOOP;
END $$;

-- Method 3: Also try dropping by finding constraints that reference auth.users
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN
        SELECT conname
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_class ft ON c.confrelid = ft.oid
        WHERE t.relname = 'payment_requests'
        AND ft.relname = 'users'
        AND c.contype = 'f'
    LOOP
        EXECUTE 'ALTER TABLE payment_requests DROP CONSTRAINT ' || quote_ident(constraint_record.conname) || ' CASCADE';
        RAISE NOTICE 'Dropped constraint referencing users: %', constraint_record.conname;
    END LOOP;
END $$;

-- Now create the correct constraint pointing to artists(id)
ALTER TABLE payment_requests 
ADD CONSTRAINT payment_requests_artist_id_fkey 
FOREIGN KEY (artist_id) 
REFERENCES artists(id) 
ON DELETE CASCADE;

-- Verify the constraint now points to artists
SELECT 
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    confrelid::regclass AS foreign_table_name
FROM pg_constraint
WHERE conrelid = 'payment_requests'::regclass
AND contype = 'f'
AND conname = 'payment_requests_artist_id_fkey';

-- The foreign_table_name should be 'artists', not 'users'

