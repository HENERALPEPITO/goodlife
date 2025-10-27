# GoodLife - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Database Setup (2 minutes)

1. Open your Supabase project
2. Go to SQL Editor
3. Copy and paste the entire contents of `complete-database-schema.sql`
4. Click "Run"

This creates all tables, policies, and indexes.

### Step 2: Create Test Users (2 minutes)

#### Create Admin:
1. Go to Authentication > Users in Supabase
2. Click "Add User" → Email
3. Email: `admin@test.com`, Password: `admin123456`
4. Copy the User ID
5. In SQL Editor, run:
```sql
INSERT INTO user_profiles (id, email, role)
VALUES ('PASTE-USER-ID-HERE', 'admin@test.com', 'admin');
```

#### Create Artist:
1. Click "Add User" → Email
2. Email: `artist@test.com`, Password: `artist123456`
3. Copy the User ID
4. In SQL Editor, run:
```sql
INSERT INTO user_profiles (id, email, role)
VALUES ('PASTE-USER-ID-HERE', 'artist@test.com', 'artist');
```

### Step 3: Run the App (1 minute)

```bash
cd goodlife
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Step 4: Test the System

#### Login as Admin:
- Email: `admin@test.com`
- Password: `admin123456`
- You'll see: Admin Dashboard with options to manage artists, upload CSVs

#### Login as Artist:
- Email: `artist@test.com`  
- Password: `artist123456`
- You'll see: Artist Dashboard with analytics, payment request button

## 📊 Test CSV Upload

As admin, upload this sample CSV to `test-royalty-data.csv`:

```csv
Song Title,ISWC,Composer,Date,Territory,Source,Usage Count,Gross,Admin %,Net
Sunset Dreams,T-123.456.789-0,John Doe,2024-10-01,US,Spotify,15000,750.00,15,637.50
Morning Light,T-987.654.321-0,Jane Smith,2024-10-15,Global,Apple Music,8500,425.00,15,361.25
Ocean Waves,T-555.444.333-0,John Doe,2024-11-01,UK,YouTube,12000,600.00,15,510.00
```

1. Go to "Upload CSV" page
2. Select the artist you created
3. Upload the CSV file
4. View the preview
5. Click "Upload to Database"

Now logout and login as the artist to see their data!

## 🎯 What to Explore

### As Admin:
- ✅ Dashboard - See all artists' stats
- ✅ Artists - View all registered artists
- ✅ Upload CSV - Import royalty data
- ✅ Catalog - Manage tracks
- ✅ Royalties - View and edit all royalties
- ✅ Analytics - System-wide analytics

### As Artist:
- ✅ Dashboard - Personal stats and payment request
- ✅ Analytics - Charts showing performance
- ✅ Royalties - View earnings (read-only)
- ✅ Catalog - View tracks (read-only)

## 🔧 Environment Variables

Already configured in `src/lib/supabaseClient.ts`:
```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "your-url";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "your-key";
```

For production, create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## 🎉 You're Ready!

The system is now fully functional with:
- ✅ Role-based authentication
- ✅ Admin and artist dashboards
- ✅ CSV upload system
- ✅ Analytics with charts
- ✅ Payment request system
- ✅ Track and royalty management

## 📖 Next Steps

- Read `IMPLEMENTATION_GUIDE.md` for detailed documentation
- Check `complete-database-schema.sql` for database structure
- Explore the code in `src/app/` for each feature

## ❓ Need Help?

Common issues:
- **Can't login?** Check user_profiles table has the correct role
- **Permission denied?** RLS policies might not be set up correctly
- **CSV upload fails?** Make sure artist is selected and CSV format matches

Enjoy building with GoodLife! 🎵




