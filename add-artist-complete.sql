-- ============================================
-- Complete Script to Add Artist with Specific UUID
-- Email: artist@test.com
-- UUID: 920946a9-1d77-45c9-bb72-aaf80aa2769e
-- ============================================

-- STEP 1: Delete existing user profile if it exists with different UUID
-- This is safe because the existing user has no associated data (0 tracks, 0 royalties, etc.)
DELETE FROM user_profiles 
WHERE email = 'artist@test.com';

-- STEP 2: Create auth user with target UUID (requires superuser/admin access)
-- This may fail if you don't have direct access to auth schema
-- If it fails, you'll need to create the auth user via Supabase Dashboard

DO $$
BEGIN
  -- Check if auth user already exists with target UUID
  IF EXISTS (
    SELECT 1 FROM auth.users WHERE id = '920946a9-1d77-45c9-bb72-aaf80aa2769e'
  ) THEN
    RAISE NOTICE 'Auth user already exists with target UUID';
  ELSE
    -- Try to create the auth user
    -- WARNING: This requires superuser access to auth schema
    BEGIN
      INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        confirmation_token,
        recovery_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        '920946a9-1d77-45c9-bb72-aaf80aa2769e',
        'authenticated',
        'authenticated',
        'artist@test.com',
        crypt('artist123456', gen_salt('bf')),  -- Default password: artist123456
        NOW(),
        NOW(),
        NOW(),
        '{"provider":"email","providers":["email"]}',
        '{"role":"artist"}',
        false,
        '',
        ''
      );
      RAISE NOTICE '✅ Auth user created with target UUID';
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE WARNING 'Cannot create auth user directly. Please create via Supabase Dashboard or Admin API first.';
      WHEN unique_violation THEN
        RAISE NOTICE 'Auth user already exists';
      WHEN OTHERS THEN
        RAISE WARNING 'Error creating auth user: %', SQLERRM;
    END;
  END IF;
END $$;

-- STEP 3: Create user profile
INSERT INTO user_profiles (id, email, role, created_at)
VALUES (
  '920946a9-1d77-45c9-bb72-aaf80aa2769e',
  'artist@test.com',
  'artist',
  NOW()
)
ON CONFLICT (id) 
DO UPDATE SET
  email = EXCLUDED.email,
  role = EXCLUDED.role;

-- STEP 4: Verify
SELECT 
  '✅ Success' as status,
  id,
  email,
  role,
  created_at
FROM user_profiles
WHERE id = '920946a9-1d77-45c9-bb72-aaf80aa2769e';

-- Check auth user status
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM auth.users WHERE id = '920946a9-1d77-45c9-bb72-aaf80aa2769e') 
    THEN '✅ Auth user exists'
    ELSE '❌ Auth user does NOT exist - profile will not work until auth user is created'
  END as auth_status;
