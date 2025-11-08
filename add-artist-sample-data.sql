-- ============================================
-- Add Sample Data for Artist
-- Email: artist@test.com
-- UUID: 920946a9-1d77-45c9-bb72-aaf80aa2769e
-- ============================================
--
-- IMPORTANT: Schema Relationships
-- - tracks.artist_id → artists.id (NOT auth.users.id)
-- - royalties.artist_id → auth.users.id
-- - payment_requests.artist_id → auth.users.id
-- - invoices.artist_id → auth.users.id
--
-- The artists table links user_id (auth.users.id) to artists.id

-- Step 1: Get the artists.id for our user
-- (This should already exist from when we created the artist)
DO $$
DECLARE
  v_artist_id UUID;
  v_user_id UUID := '920946a9-1d77-45c9-bb72-aaf80aa2769e';
  v_track_id UUID;
BEGIN
  -- Get artists.id from user_id
  SELECT id INTO v_artist_id
  FROM artists
  WHERE user_id = v_user_id;

  IF v_artist_id IS NULL THEN
    RAISE EXCEPTION 'Artist record not found for user_id: %', v_user_id;
  END IF;

  RAISE NOTICE 'Using artists.id: %', v_artist_id;

  -- Step 2: Create a test track (uses artists.id)
  INSERT INTO tracks (
    artist_id,  -- References artists.id
    title,
    platform,
    territory,
    created_at
  )
  VALUES (
    v_artist_id,
    'Test Track - Sample',
    'Spotify',
    'US',
    NOW()
  )
  RETURNING id INTO v_track_id;

  RAISE NOTICE 'Created track with id: %', v_track_id;

  -- Step 3: Create test royalties (uses user_id)
  INSERT INTO royalties (
    artist_id,  -- References auth.users.id
    track_id,
    net_amount,
    usage_count,
    gross_amount,
    admin_percent,
    exploitation_source_name,
    territory,
    broadcast_date,
    created_at
  )
  VALUES (
    v_user_id,  -- user_id for royalties
    v_track_id,
    150.75,  -- net_amount
    1500,  -- usage_count
    200.00,  -- gross_amount
    25.00,  -- admin_percent
    'Spotify',
    'US',
    CURRENT_DATE,
    NOW()
  ),
  (
    v_user_id,
    v_track_id,
    89.50,
    950,
    120.00,
    25.00,
    'Apple Music',
    'US',
    CURRENT_DATE,
    NOW()
  );

  RAISE NOTICE 'Created sample royalties';

  -- Step 4: Verify the data
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - Tracks created: 1';
  RAISE NOTICE '  - Royalties created: 2';
  RAISE NOTICE '  - Total revenue: ~€240.25';

END $$;

-- Verify the data was created
SELECT 
  'Tracks' as type,
  COUNT(*) as count,
  SUM(CASE WHEN artist_id = 'c5e680a3-e47b-4729-8361-ae34c3c340bc' THEN 1 ELSE 0 END) as for_this_artist
FROM tracks

UNION ALL

SELECT 
  'Royalties',
  COUNT(*),
  SUM(CASE WHEN artist_id = '920946a9-1d77-45c9-bb72-aaf80aa2769e' THEN 1 ELSE 0 END)
FROM royalties;




