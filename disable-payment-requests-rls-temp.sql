-- Temporarily disable RLS on payment_requests to allow inserts
-- This is a temporary fix - you should set up proper RLS policies later
-- Run this in Supabase SQL Editor

ALTER TABLE payment_requests DISABLE ROW LEVEL SECURITY;

-- Verify it's disabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'payment_requests';

