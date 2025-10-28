# Complete Setup Guide - GoodLife Platform

## Overview

This guide will walk you through setting up the complete GoodLife royalty management platform with all features including:
- ✅ User management (Admin & Artist roles)
- ✅ Royalty tracking and management
- ✅ Payment requests with PDF receipts
- ✅ Legacy invoice system
- ✅ Bulk operations and search functionality

## Prerequisites

- Node.js 18+ installed
- Supabase account and project created
- Git (optional)

## Step 1: Install Dependencies

```bash
cd goodlife
npm install
```

This will install all required packages including:
- Next.js 16
- Supabase client libraries
- Radix UI components
- jsPDF for PDF generation
- TailwindCSS

## Step 2: Environment Variables

Create a `.env.local` file in the `goodlife` directory:

```bash
# Public Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Secret - Server-side only (NEVER expose to client)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### How to get your keys:
1. Go to your Supabase dashboard
2. Navigate to **Settings** → **API**
3. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** (click "Reveal") → `SUPABASE_SERVICE_ROLE_KEY`

⚠️ **IMPORTANT**: Never commit `.env.local` to version control!

## Step 3: Database Setup

Run the following migrations **in order** using the Supabase SQL Editor:

### Migration 1: Core Admin Features
**File:** `admin-features-migration.sql`

This creates:
- `user_profiles` table
- `royalties` table with search indexes
- RLS policies
- Admin helper functions

**To run:**
1. Open Supabase Dashboard → SQL Editor
2. Copy entire contents of `admin-features-migration.sql`
3. Paste and click "Run"
4. Verify: ✅ "Success. No rows returned"

### Migration 2: Legacy Invoice System
**File:** `invoices-table-migration.sql`

This creates:
- `invoices` table
- Invoice RLS policies
- Invoice number generator function

**To run:**
1. In Supabase SQL Editor
2. Copy entire contents of `invoices-table-migration.sql`
3. Paste and click "Run"
4. Verify: ✅ "Success. No rows returned"

### Migration 3: Payment Request System
**File:** `payment-features-migration.sql`

This creates:
- `payment_requests` table
- `payment_receipts` table
- Payment tracking on royalties
- Receipt number generator
- Payment RLS policies

**To run:**
1. In Supabase SQL Editor
2. Copy entire contents of `payment-features-migration.sql`
3. Paste and click "Run"
4. Verify: ✅ "Success. No rows returned"

## Step 4: Create Your First Admin User

Run this SQL in the Supabase SQL Editor:

```sql
DO $$
DECLARE
  admin_email TEXT := 'admin@yourcompany.com';  -- CHANGE THIS
  admin_password TEXT := 'YourSecurePassword123!';  -- CHANGE THIS
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

**Important:**
- Replace `admin@yourcompany.com` with your email
- Replace `YourSecurePassword123!` with a secure password
- Save these credentials - you'll need them to login!

## Step 5: Verify Database Tables

Run this query to verify all tables were created:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see:
- ✅ `user_profiles`
- ✅ `royalties`
- ✅ `invoices`
- ✅ `payment_requests`
- ✅ `payment_receipts`

## Step 6: Start the Development Server

```bash
npm run dev
```

The app will start at `http://localhost:3000`

## Step 7: Test All Features

### 1. Login as Admin
- Go to `http://localhost:3000/login`
- Enter your admin credentials
- You should be redirected to the dashboard

### 2. Create a Test Artist
- Navigate to `/admin/users`
- Fill in the form:
  - Email: `artist@test.com`
  - Password: Click "Generate" or enter manually
  - Role: Artist
- Click "Create User"
- Save the password for testing

### 3. Upload Test Royalties (Optional)
- Navigate to `/royalty-uploader`
- Upload `test-royalty-data.csv` (included in project)
- Verify royalties appear in `/admin/royalties`

### 4. Test Admin Features

**User Management (`/admin/users`):**
- ✅ View all users
- ✅ Create new users
- ✅ See role badges

**Royalty Management (`/admin/royalties`):**
- ✅ Search by track title or artist email
- ✅ Filter by platform
- ✅ Filter by territory
- ✅ Select multiple royalties
- ✅ Bulk delete
- ✅ Single delete

**Payment Requests (`/admin/payment-requests`):**
- ✅ View all payment requests
- ✅ Filter by status
- ✅ Approve requests
- ✅ Reject requests with remarks
- ✅ View receipt breakdown
- ✅ Generate PDF receipts

### 5. Test Artist Features

**Login as Artist:**
- Logout
- Login with `artist@test.com` credentials
- You should see the artist dashboard

**Royalties (`/artist/royalties`):**
- ✅ View your royalties
- ✅ See unpaid amount
- ✅ Request payment for unpaid royalties

**Payments (`/artist/payments`):**
- ✅ View payment request history
- ✅ See request status
- ✅ View receipts
- ✅ Download PDF receipts

**Legacy Invoices (if using old system):**
- Navigate to main dashboard
- ✅ Create invoices
- ✅ View invoice status

## Features Overview

### For Admins

| Feature | Route | Description |
|---------|-------|-------------|
| **User Management** | `/admin/users` | Create users, assign roles |
| **Royalty Management** | `/admin/royalties` | Search, filter, bulk delete royalties |
| **Payment Requests** | `/admin/payment-requests` | Approve/reject payments, generate receipts |
| **Invoice Management** | Main dashboard | Manage legacy invoice system |

### For Artists

| Feature | Route | Description |
|---------|-------|-------------|
| **My Royalties** | `/artist/royalties` | View royalties, request payments |
| **My Payments** | `/artist/payments` | View payment history, download receipts |
| **My Invoices** | Main dashboard | Create/view legacy invoices |

## API Endpoints

### Admin Endpoints
- `POST /api/admin/create-user` - Create new user
- `POST /api/admin/delete-royalties` - Bulk delete royalties
- `GET /api/admin/payment-requests` - Get all payment requests
- `POST /api/admin/payment-requests` - Approve/reject payment

### Artist/Public Endpoints
- `POST /api/payment/request` - Create payment request
- `GET /api/payment/receipt` - Get receipt data for PDF

## Security Features

- ✅ Row Level Security (RLS) on all tables
- ✅ Server-side role verification
- ✅ Protected API routes (admin-only)
- ✅ Proxy-based route protection
- ✅ Parameterized queries (SQL injection prevention)
- ✅ Service role key only on server
- ✅ Password hashing (bcrypt)

## Troubleshooting

### "Error fetching invoices: {}"
**Solution:** Run `invoices-table-migration.sql` in Supabase SQL Editor

### "Module not found: @supabase/ssr"
**Solution:** Run `npm install` again

### "Unauthorized" on admin pages
**Solution:** Verify user has `role = 'admin'` in `user_profiles` table

### Tables don't exist
**Solution:** Run all 3 migrations in order (see Step 3)

### Can't login
**Solution:** 
1. Verify user exists in Supabase → Authentication
2. Check `user_profiles` table has matching record
3. Try resetting password in Supabase dashboard

### PDF won't generate
**Solution:** Verify `jspdf` and `jspdf-autotable` are installed

### 500 error on user creation
**Solution:** Verify `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`

## Development Workflow

### Adding Sample Royalties

Option 1: CSV Upload
```bash
# Use the royalty uploader at /royalty-uploader
# Upload sample-royalty-data.csv or test-royalty-data.csv
```

Option 2: SQL Insert
```sql
INSERT INTO royalties (
  track_title, artist_id, artist_email, platform, 
  territory, usage_count, gross_amount, admin_percent, 
  net_amount, broadcast_date
)
SELECT 
  'Sample Song ' || generate_series,
  (SELECT id FROM user_profiles WHERE role = 'artist' LIMIT 1),
  (SELECT email FROM user_profiles WHERE role = 'artist' LIMIT 1),
  (ARRAY['Spotify', 'Apple Music', 'YouTube'])[floor(random() * 3 + 1)],
  (ARRAY['US', 'UK', 'CA'])[floor(random() * 3 + 1)],
  floor(random() * 1000 + 1)::integer,
  (random() * 1000)::numeric(12,2),
  15.00,
  ((random() * 1000) * 0.85)::numeric(12,2),
  NOW() - (random() * interval '365 days')
FROM generate_series(1, 50);
```

## Production Deployment

### Before deploying to production:

1. **Update Environment Variables**
   - Set production Supabase credentials
   - Use strong service role key
   - Enable all security features

2. **Enable Email Confirmation**
   - Configure SMTP in Supabase
   - Enable email confirmation for new users

3. **Set up Custom Domain**
   - Configure custom domain in Vercel/hosting
   - Update Supabase redirect URLs

4. **Review RLS Policies**
   - Test all policies with different user roles
   - Ensure no data leakage

5. **Performance Optimization**
   - Enable Supabase connection pooling
   - Add database indexes as needed
   - Consider caching strategy

## Support & Documentation

- **Full Setup Guide**: `ADMIN_FEATURES_SETUP.md`
- **Payment Features**: `PAYMENT_FEATURES_GUIDE.md`
- **Implementation Details**: `ADMIN_FEATURES_IMPLEMENTATION.md`
- **Quick Start**: `ADMIN_FEATURES_QUICKSTART.md`

## Database Schema Reference

```
user_profiles (id, email, role, created_at)
├── royalties (artist_id → user_profiles.id)
├── invoices (artist_id → user_profiles.id)
├── payment_requests (artist_id → user_profiles.id)
└── payment_receipts (artist_id → user_profiles.id)
```

---

**Version:** 2.0.0  
**Last Updated:** October 2025  
**Status:** ✅ Production Ready

