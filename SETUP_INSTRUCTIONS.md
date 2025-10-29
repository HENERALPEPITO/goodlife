# GoodLife Database Setup Instructions

⚠️ **Note**: Row Level Security (RLS) is **DISABLED** in this setup for easier development. This means all authenticated users can access all data. Enable RLS before production!

## Current Errors

You're seeing these errors because the database tables haven't been created in Supabase yet:
- ❌ `Error fetching user profile: {}`
- ❌ `Error fetching invoices`

## How to Fix

### Step 1: Run the Database Schema

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your project: `ulvxfugjzgrjmcfvybjx`

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run the Schema**
   - Open the file: `complete-database-schema.sql`
   - Copy **ALL** the contents
   - Paste into the Supabase SQL Editor
   - Click **"Run"** or press `Ctrl+Enter`

4. **Verify Success**
   - You should see: "Success. No rows returned"
   - Go to "Table Editor" in the sidebar
   - You should now see these tables:
     - ✅ `user_profiles`
     - ✅ `tracks`
     - ✅ `royalties`
     - ✅ `payment_requests`
     - ✅ `invoices`

### Step 2: Create Your First Admin User

1. **Go to Authentication**
   - Click "Authentication" in the Supabase sidebar
   - Click "Users"
   - Click "Add user" → "Create new user"

2. **Create Admin Account**
   - Email: `admin@goodlife.com` (or your email)
   - Password: Create a secure password
   - Click "Create user"
   - **Copy the user ID** (you'll need it next)

3. **Set Admin Role**
   - Go back to "SQL Editor"
   - Run this query (replace `USER_ID_HERE` with the actual user ID):
   
   ```sql
   INSERT INTO user_profiles (id, email, role)
   VALUES ('USER_ID_HERE', 'admin@goodlife.com', 'admin');
   ```

### Step 3: Restart Your Development Server

1. Stop your Next.js dev server (Ctrl+C in terminal)
2. Start it again:
   ```bash
   npm run dev
   ```
3. Navigate to: http://localhost:3000
4. Sign in with your admin credentials

## Additional Optional Setup

### Create Test Artist Account

1. In Supabase Authentication, create another user:
   - Email: `artist@test.com`
   - Password: (create a password)
   - Copy the user ID

2. Run this SQL:
   ```sql
   INSERT INTO user_profiles (id, email, role)
   VALUES ('ARTIST_USER_ID_HERE', 'artist@test.com', 'artist');
   ```

### Add Sample Data (Optional)

If you want to test with some data, run the sample data scripts in the SQL editor:

```sql
-- Sample tracks (replace ARTIST_ID with actual artist user ID)
INSERT INTO tracks (artist_id, title, iswc, composers, release_date, platform, territory)
VALUES 
  ('ARTIST_ID', 'Sunset Dreams', 'T-123.456.789-0', 'John Doe, Jane Smith', '2024-01-15', 'Spotify', 'Global'),
  ('ARTIST_ID', 'Morning Light', 'T-987.654.321-0', 'Jane Smith', '2024-03-20', 'Apple Music', 'US');

-- Sample royalties
INSERT INTO royalties (track_id, artist_id, usage_count, gross_amount, admin_percent, net_amount, broadcast_date, exploitation_source_name, territory)
VALUES
  ('TRACK_ID', 'ARTIST_ID', 15000, 750.00, 15.00, 637.50, '2024-10-01', 'Spotify', 'US'),
  ('TRACK_ID', 'ARTIST_ID', 8500, 425.00, 15.00, 361.25, '2024-10-01', 'Apple Music', 'Global');
```

## Troubleshooting

### Still getting errors after running schema?

1. **Check Table Creation**
   - Go to Supabase → Table Editor
   - Verify all 5 tables exist

2. **Check RLS Policies**
   - Click on any table
   - Click "Policies" tab
   - You should see multiple policies listed

3. **Clear Browser Cache**
   - Sign out
   - Clear browser cache/cookies
   - Sign back in

4. **Check Console Logs**
   - Open browser DevTools (F12)
   - Look for specific error messages
   - Share them if you need help

### Need Help?

If you're still having issues:
1. Check the browser console for detailed error messages
2. Check the Network tab for failed API requests
3. Verify your Supabase project is active and not paused

## What Each Table Does

- **user_profiles**: Stores user role information (admin/artist)
- **tracks**: Music tracks uploaded by artists
- **royalties**: Royalty payments for each track
- **payment_requests**: Artist payment withdrawal requests
- **invoices**: Detailed invoice records for payments

## Security Features

- ⚠️  Row Level Security (RLS) **DISABLED** for easier development
- ✅ Proper foreign key constraints
- ✅ Secure authentication via Supabase Auth
- 📝 **Important**: Enable RLS before deploying to production!

### To Enable RLS Later:
When ready for production, uncomment the RLS policies in `complete-database-schema.sql` and run:
```sql
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE royalties ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
-- Then run all the CREATE POLICY statements
```

