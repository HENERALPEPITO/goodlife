-- Check RLS status and policies on payment_requests table
-- Run this in Supabase SQL Editor

-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'payment_requests';

-- Check existing policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'payment_requests';

-- If RLS is blocking inserts, you can temporarily disable it:
-- ALTER TABLE payment_requests DISABLE ROW LEVEL SECURITY;

-- Or update the policies to allow inserts with artist_id from artists table:
-- (This is more complex and might require a function to check if user owns the artist record)


