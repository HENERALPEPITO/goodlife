# Adding Artist: artist@test.com

## Current Situation

- **Email**: artist@test.com
- **Target UUID**: 920946a9-1d77-45c9-bb72-aaf80aa2769e
- **Status**: An existing user exists with a different UUID (2e1df7aa-59c0-4488-9db3-d7bba553d3ee)

## Problem

The `user_profiles` table requires the user to exist in `auth.users` first (foreign key constraint). The target UUID `920946a9-1d77-45c9-bb72-aaf80aa2769e` doesn't exist in `auth.users` yet.

## Solution Options

### Option 1: Use Admin API (Easiest - Recommended)

Use the admin create-user endpoint which handles both auth user and profile creation:

```bash
POST http://localhost:3000/api/admin/create-user
Content-Type: application/json
Authorization: Bearer <admin-token>

{
  "email": "artist@test.com",
  "password": "artist123456",
  "role": "artist"
}
```

**Note**: This will generate a new UUID automatically. If you need the specific UUID `920946a9-1d77-45c9-bb72-aaf80aa2769e`, use Option 2.

### Option 2: Create via Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Users**
3. Click **"Add User"** or **"Invite User"**
4. Fill in:
   - Email: `artist@test.com`
   - Password: (set a secure password)
   - Auto Confirm User: **ON**
5. Click **"Create User"**
6. Copy the generated User ID
7. If the ID is different from `920946a9-1d77-45c9-bb72-aaf80aa2769e`, either:
   - Use the generated ID, OR
   - Update the script to use the generated ID

### Option 3: Use Existing User (If UUID doesn't matter)

If you don't need the specific UUID, you can just use the existing user:
- UUID: `2e1df7aa-59c0-4488-9db3-d7bba553d3ee`
- Email: `artist@test.com`
- Role: `artist` (already set)

This user already exists and can be used immediately!

## After Creating Auth User

Once the auth user exists with UUID `920946a9-1d77-45c9-bb72-aaf80aa2769e`, run:

```sql
-- Run this in Supabase SQL Editor
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
```

## Verify

Check that the artist was created:

```sql
SELECT id, email, role, created_at
FROM user_profiles
WHERE id = '920946a9-1d77-45c9-bb72-aaf80aa2769e';
```

