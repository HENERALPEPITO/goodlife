-- Fix RLS on Royalties Table
-- Run this in Supabase SQL Editor

-- Step 1: Check current RLS status
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'royalties';

-- Step 2: Disable RLS on royalties table (service role should bypass it anyway)
ALTER TABLE royalties DISABLE ROW LEVEL SECURITY;

-- Step 3: Verify it's disabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'royalties';

-- Step 4: Test the query
SELECT * FROM royalties LIMIT 1;
