# Admin Features - Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Install Dependencies (1 min)
```bash
cd goodlife
npm install
```

All required packages are already installed:
- ✅ `@supabase/ssr`
- ✅ `@radix-ui/react-checkbox`
- ✅ `@radix-ui/react-select`

### Step 2: Environment Variables (1 min)

Create `.env.local` in the `goodlife` folder:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://ulvxfugjzgrjmcfvybjx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Where to get these:**
1. Go to your Supabase dashboard
2. Click **Settings** → **API**
3. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role → `SUPABASE_SERVICE_ROLE_KEY` (click "Reveal")

### Step 3: Run Database Migration (2 min)

1. Open Supabase dashboard
2. Go to **SQL Editor**
3. Copy entire contents of `admin-features-migration.sql`
4. Paste and click **Run**

Wait for: ✅ "Success. No rows returned"

### Step 4: Create First Admin User (1 min)

In Supabase SQL Editor, run:

```sql
DO $$
DECLARE
  admin_email TEXT := 'admin@yourcompany.com';  -- Change this
  admin_password TEXT := 'YourPassword123!';     -- Change this
  new_user_id UUID;
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, confirmation_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    admin_email, crypt(admin_password, gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"admin"}', FALSE, ''
  )
  RETURNING id INTO new_user_id;

  INSERT INTO user_profiles (id, email, role)
  VALUES (new_user_id, admin_email, 'admin');
  
  RAISE NOTICE 'Admin user created!';
END $$;
```

### Step 5: Start and Test (1 min)

```bash
npm run dev
```

Visit: `http://localhost:3000/login`

**Test the features:**
1. Login with your admin credentials
2. Go to `/admin/users` - Create a new user
3. Go to `/admin/royalties` - Search and manage royalties

## 📋 Feature Overview

### User Management (`/admin/users`)
- ✅ Create users with email + password
- ✅ Assign roles (admin or artist)
- ✅ Generate random passwords
- ✅ View all users

### Royalty Management (`/admin/royalties`)
- ✅ **Search**: Type to search track titles or artist emails
- ✅ **Filter**: Dropdown filters for platform and territory
- ✅ **Bulk Delete**: Select multiple rows and delete
- ✅ **Single Delete**: Trash icon on each row
- ✅ **Pagination**: Navigate through pages (10/25/50/100 per page)

## 🔑 Key URLs

| Page | URL | Description |
|------|-----|-------------|
| **User Management** | `/admin/users` | Create and view users |
| **Royalty Management** | `/admin/royalties` | Search, filter, delete royalties |
| **Login** | `/login` | Authentication |
| **Dashboard** | `/` | Main dashboard |

## 🔒 Security Features

- ✅ Admin-only routes (auto-redirect if not admin)
- ✅ Server-side role verification
- ✅ Protected API endpoints
- ✅ Secure password storage
- ✅ SQL injection protection

## 💡 Quick Tips

### Creating Users
1. Click **Generate** for a secure random password
2. Copy the password before creating (you'll need to share it)
3. User can login immediately (email auto-confirmed)

### Bulk Delete
1. Check boxes next to royalties (or check header to select all)
2. Click **Delete Selected** in the floating toolbar
3. Confirm in the modal
4. Toast notification shows how many deleted

### Search & Filter
- Search debounces after 300ms (smooth typing)
- Combine search + filters for precise results
- Click **Clear all** to reset everything
- Active filters shown as colored chips

### Navigation
- Admin header appears on all `/admin/*` pages
- Click **Back to Dashboard** to return to main app
- Users, Royalties links in header for quick switching

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| **Can't access `/admin/users`** | Make sure you're logged in as admin |
| **"Module not found: @supabase/ssr"** | Run `npm install` again |
| **"Unauthorized"** | Check user has `role = 'admin'` in database |
| **No royalties showing** | Check filters - try clicking "Clear all" |
| **Bulk delete not working** | Verify RLS policies are set up (run migration) |

## 📞 Support

**Documentation:**
- `ADMIN_FEATURES_SETUP.md` - Full setup guide
- `ADMIN_FEATURES_IMPLEMENTATION.md` - Technical details
- `admin-features-migration.sql` - Database schema

**Need Help?**
1. Check browser console for errors
2. Check Supabase logs in dashboard
3. Verify environment variables
4. Restart dev server

## ✅ Quick Checklist

Before going live:

- [ ] Environment variables set
- [ ] Database migration run
- [ ] Admin user created and tested
- [ ] Can login as admin
- [ ] Can access `/admin/users`
- [ ] Can create new user
- [ ] Can access `/admin/royalties`
- [ ] Can search royalties
- [ ] Can bulk delete royalties
- [ ] Non-admin users redirected (test with artist account)

---

**Ready to go!** 🚀

Your admin features are now fully functional and production-ready.

