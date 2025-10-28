# Admin Features Setup Guide

This guide covers the setup and usage of the new admin features including user management and bulk royalty operations.

## Features Added

### ✅ Admin User Management
- Create users with admin/artist roles
- Auto-generate secure passwords
- View all users with role-based badges
- Full authentication and authorization

### ✅ Admin Royalty Management
- **Search**: Multi-field search (track title, artist email)
- **Filter**: By platform, territory with dynamic filter options
- **Bulk Delete**: Select multiple royalties and delete in one action
- **Pagination**: Server-side pagination with configurable page size
- **Single Actions**: Delete individual royalties with confirmation

### ✅ Security Features
- Server-side role verification
- Protected API routes (admin-only)
- Row Level Security (RLS) policies
- Middleware-based route protection
- Parameterized queries (SQL injection prevention)

## Installation Steps

### 1. Install Required Dependencies

```bash
cd goodlife
npm install @radix-ui/react-checkbox @radix-ui/react-select @supabase/ssr
```

### 2. Environment Variables

Create or update your `.env.local` file with the following variables:

```bash
# Supabase Configuration (Public - can be exposed to client)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Supabase Admin (KEEP SECRET - server-side only)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

⚠️ **IMPORTANT**: The `SUPABASE_SERVICE_ROLE_KEY` must NEVER be exposed to the client. It's only used in server-side API routes.

#### How to Get Your Keys:

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy the following:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (click "Reveal" to see it)

### 3. Database Migration

Run the database migration to create/update tables and set up RLS policies:

#### Option A: Using Supabase Dashboard
1. Go to your Supabase project
2. Navigate to **SQL Editor**
3. Open the file `admin-features-migration.sql`
4. Copy and paste the entire contents
5. Click "Run"

#### Option B: Using Supabase CLI
```bash
supabase db push --file admin-features-migration.sql
```

This migration creates:
- `user_profiles` table with role-based access
- `royalties` table with comprehensive search indexes
- RLS policies for secure data access
- Helper functions for admin operations
- Full-text search indexes

### 4. Create Your First Admin User

You'll need to create at least one admin user to access the admin features.

#### Option A: Via Supabase Dashboard (Manual)

1. Go to **Authentication** → **Users** in Supabase dashboard
2. Click "Add User" → "Create new user"
3. Enter email and password
4. After creating the auth user, go to **Database** → **Table Editor** → `user_profiles`
5. Click "Insert" → "Insert row"
6. Fill in:
   - `id`: (paste the user ID from step 3)
   - `email`: (same email from step 2)
   - `role`: `admin`
7. Click "Save"

#### Option B: Via SQL (Recommended)

Run this SQL in the Supabase SQL Editor:

```sql
-- Replace these values with your admin credentials
DO $$
DECLARE
  admin_email TEXT := 'admin@yourcompany.com';
  admin_password TEXT := 'YourSecurePassword123!';
  new_user_id UUID;
BEGIN
  -- Create auth user
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
    confirmation_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    admin_email,
    crypt(admin_password, gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"admin"}',
    FALSE,
    ''
  )
  RETURNING id INTO new_user_id;

  -- Create user profile
  INSERT INTO user_profiles (id, email, role)
  VALUES (new_user_id, admin_email, 'admin');

  RAISE NOTICE 'Admin user created with ID: %', new_user_id;
END $$;
```

## Usage Guide

### Accessing Admin Features

1. **Login** as an admin user at `/login`
2. Navigate to admin pages:
   - **User Management**: `/admin/users`
   - **Royalty Management**: `/admin/royalties`

### Creating Users

1. Go to `/admin/users`
2. Fill in the "Create New User" form:
   - **Email**: User's email address
   - **Password**: Click "Generate" for a secure random password, or enter manually
   - **Role**: Select "admin" or "artist"
3. Click "Create User"
4. **Important**: Save the password and share it securely with the new user

### Managing Royalties

#### Search and Filter
1. Go to `/admin/royalties`
2. Use the search bar to find royalties by track title or artist email (debounced 300ms)
3. Use dropdown filters to filter by platform or territory
4. Filters are applied in real-time with server-side processing

#### Bulk Delete
1. Select royalties using checkboxes (or use the header checkbox to select all on page)
2. Click "Delete Selected" in the floating toolbar
3. Confirm the deletion in the modal
4. Selected royalties will be permanently deleted

#### Single Delete
1. Click the trash icon (🗑️) in the Actions column
2. Confirm the deletion
3. The royalty will be permanently deleted

#### Pagination
- Use the page size dropdown to show 10, 25, 50, or 100 results per page
- Use Previous/Next buttons to navigate pages
- Total count and current range are displayed

## API Endpoints

### POST /api/admin/create-user

Creates a new user with specified role.

**Request:**
```json
{
  "email": "artist@example.com",
  "password": "SecurePassword123!",
  "role": "artist"
}
```

**Response (Success):**
```json
{
  "success": true,
  "user": {
    "id": "uuid-here",
    "email": "artist@example.com",
    "role": "artist"
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Error message here"
}
```

**Authorization:** Requires authenticated admin user

### POST /api/admin/delete-royalties

Deletes multiple royalty records by ID.

**Request:**
```json
{
  "ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Response (Success):**
```json
{
  "success": true,
  "count": 3
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Error message here"
}
```

**Limits:**
- Maximum 1000 IDs per request
- All IDs must be valid UUIDs

**Authorization:** Requires authenticated admin user

## Security Considerations

### Server-Side Security
- ✅ All admin operations use server-side role verification
- ✅ Service role key is only used in API routes (never exposed to client)
- ✅ Parameterized queries prevent SQL injection
- ✅ Input validation on all endpoints

### Client-Side Security
- ✅ Middleware protects admin routes
- ✅ Non-admin users are redirected
- ✅ Role checks on all admin pages
- ✅ Authentication state managed securely

### Database Security
- ✅ Row Level Security (RLS) enabled on all tables
- ✅ Policies enforce role-based access
- ✅ Foreign key constraints maintain referential integrity
- ✅ Indexes optimize query performance

## Performance Optimizations

1. **Search Indexes**: Full-text search on track_title with GIN index
2. **B-tree Indexes**: Fast filtering on platform, territory, artist_email
3. **Server-Side Pagination**: Only fetch required rows per page
4. **Debounced Search**: Reduces unnecessary API calls (300ms delay)
5. **Batch Delete**: Single transaction for multiple deletes (max 1000)

## Troubleshooting

### "Missing SUPABASE_SERVICE_ROLE_KEY" Error
- Ensure `.env.local` contains `SUPABASE_SERVICE_ROLE_KEY`
- Restart Next.js dev server after adding environment variables
- Verify the key is correct in Supabase dashboard

### "Unauthorized" When Accessing Admin Pages
- Ensure you're logged in as an admin user
- Check that user profile has `role = 'admin'` in database
- Clear browser cookies and login again

### Proxy Not Protecting Routes
- Ensure `@supabase/ssr` is installed
- Check that proxy.ts is in the correct location (`src/proxy.ts`)
- Note: Next.js 16 uses `proxy.ts` instead of deprecated `middleware.ts`
- Restart Next.js dev server

### Bulk Delete Not Working
- Check browser console for errors
- Verify RLS policies are correctly set up
- Ensure admin user has correct role in database
- Check that all IDs are valid UUIDs

### Search/Filter Not Working
- Ensure database indexes are created (run migration)
- Check that royalties table has data
- Verify column names match schema
- Check browser network tab for API errors

## File Structure

```
goodlife/
├── src/
│   ├── app/
│   │   ├── admin/
│   │   │   ├── layout.tsx          # Admin section layout
│   │   │   ├── users/
│   │   │   │   └── page.tsx        # User management page
│   │   │   └── royalties/
│   │   │       └── page.tsx        # Royalty management page
│   │   └── api/
│   │       └── admin/
│   │           ├── create-user/
│   │           │   └── route.ts    # Create user API
│   │           └── delete-royalties/
│   │               └── route.ts    # Bulk delete API
│   ├── components/
│   │   ├── ConfirmModal.tsx        # Reusable confirmation dialog
│   │   ├── MultiSelectToolbar.tsx  # Bulk action toolbar
│   │   └── ui/
│   │       ├── checkbox.tsx        # Checkbox component
│   │       ├── select.tsx          # Select component
│   │       ├── label.tsx           # Label component
│   │       └── table.tsx           # Table components
│   ├── lib/
│   │   ├── supabaseAdmin.ts        # Admin Supabase client
│   │   └── authHelpers.ts          # Server auth utilities
│   └── proxy.ts                    # Route protection (Next.js 16)
└── admin-features-migration.sql    # Database migration

```

## Testing Checklist

- [ ] Install all dependencies
- [ ] Set up environment variables
- [ ] Run database migration
- [ ] Create admin user
- [ ] Login as admin
- [ ] Access `/admin/users` page
- [ ] Create a new user
- [ ] Access `/admin/royalties` page
- [ ] Search for royalties
- [ ] Filter by platform/territory
- [ ] Select multiple royalties
- [ ] Bulk delete royalties
- [ ] Delete single royalty
- [ ] Test pagination
- [ ] Verify non-admin cannot access admin routes
- [ ] Test logout and login again

## Next Steps

1. **Customize UI**: Modify styling to match your brand
2. **Add Edit Functionality**: Implement edit modals for royalties
3. **Add Export**: Allow exporting filtered royalties to CSV
4. **Add Analytics**: Track admin actions for audit trail
5. **Add Email Notifications**: Notify users when accounts are created
6. **Add Password Reset**: Implement password reset flow for new users

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Supabase logs in dashboard
3. Check browser console for client-side errors
4. Review server logs for API errors
5. Verify database schema matches migration

---

**Version:** 1.0.0  
**Last Updated:** October 2025

