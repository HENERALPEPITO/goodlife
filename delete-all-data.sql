-- ============================================
-- DELETE ALL DATA FROM DATABASE
-- WARNING: This will delete ALL data from all tables!
-- Run this in Supabase SQL Editor
-- ============================================

-- Disable foreign key checks temporarily (if needed)
-- Note: PostgreSQL doesn't support disabling FK checks, so we delete in order

-- Delete in order (child tables first, then parent tables)
-- This ensures foreign key constraints are respected

-- 1. Delete from child tables first
DELETE FROM invoices;
DELETE FROM royalties;
DELETE FROM payment_requests;

-- 2. Delete from dependent tables
DELETE FROM catalog_uploads;
DELETE FROM catalog_tracks;
DELETE FROM tracks;
DELETE FROM artists;

-- 3. Delete from user-related tables (but keep user_profiles if you want to keep user accounts)
-- Uncomment the line below if you want to delete user profiles too:
-- DELETE FROM user_profiles;

-- Alternative: If you want to use TRUNCATE (faster, resets auto-increment counters)
-- Note: TRUNCATE requires CASCADE for tables with foreign keys

-- TRUNCATE TABLE invoices CASCADE;
-- TRUNCATE TABLE royalties CASCADE;
-- TRUNCATE TABLE payment_requests CASCADE;
-- TRUNCATE TABLE catalog_uploads CASCADE;
-- TRUNCATE TABLE catalog_tracks CASCADE;
-- TRUNCATE TABLE tracks CASCADE;
-- TRUNCATE TABLE user_profiles CASCADE; -- Uncomment if you want to delete user profiles too

-- ============================================
-- VERIFY DELETION (optional - uncomment to check)
-- ============================================

-- SELECT 'invoices' as table_name, COUNT(*) as row_count FROM invoices
-- UNION ALL
-- SELECT 'payment_requests', COUNT(*) FROM payment_requests
-- UNION ALL
-- SELECT 'royalties', COUNT(*) FROM royalties
-- UNION ALL
-- SELECT 'tracks', COUNT(*) FROM tracks
-- UNION ALL
-- SELECT 'catalog_tracks', COUNT(*) FROM catalog_tracks
-- UNION ALL
-- SELECT 'catalog_uploads', COUNT(*) FROM catalog_uploads
-- UNION ALL
-- SELECT 'artists', COUNT(*) FROM artists
-- UNION ALL
-- SELECT 'user_profiles', COUNT(*) FROM user_profiles;

