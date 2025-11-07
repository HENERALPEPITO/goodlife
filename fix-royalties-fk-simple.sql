-- SIMPLE FIX: Fix royalties.artist_id foreign key
-- Copy and paste this entire script into Supabase SQL Editor

-- Step 1: Drop the wrong constraint
ALTER TABLE royalties DROP CONSTRAINT IF EXISTS royalties_artist_id_fkey;

-- Step 2: Create the correct constraint pointing to artists table
ALTER TABLE royalties 
ADD CONSTRAINT royalties_artist_id_fkey 
FOREIGN KEY (artist_id) 
REFERENCES artists(id) 
ON DELETE CASCADE;

-- Step 3: Verify it worked (should show 'artists' not 'users')
SELECT 
    tc.constraint_name,
    ccu.table_name AS references_table
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu 
    ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'royalties' 
    AND tc.constraint_type = 'FOREIGN KEY'
    AND tc.constraint_name = 'royalties_artist_id_fkey';

