# Royalty Uploader Setup Guide

## ⚠️ UPDATED: Server-Side CSV Processing

The CSV uploader has been refactored to handle large files (up to 10MB) on the server-side:
- ✅ No more browser memory crashes
- ✅ Files uploaded to Supabase Storage first
- ✅ Processing happens in Next.js API Route
- ✅ Batched database inserts (500 rows at a time)
- ✅ Better error handling and progress notifications

## Prerequisites

### 1. Supabase Storage Bucket Setup

**IMPORTANT**: You must create a storage bucket named `royalties` in your Supabase project.

#### Steps to create the bucket:
1. Go to your Supabase Dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New bucket**
4. Name it: `royalties`
5. Set it to **Private** (recommended) or **Public** based on your needs
6. Click **Create bucket**

#### Storage Policies (if using private bucket):
```sql
-- Allow authenticated users to upload CSV files
create policy "Allow authenticated users to upload"
on storage.objects for insert
to authenticated
with check (bucket_id = 'royalties');

-- Allow service role to download files (for API route)
create policy "Allow service role to read"
on storage.objects for select
to service_role
using (bucket_id = 'royalties');
```

### 2. Environment Variables

Make sure your `.env.local` file contains:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**NOTE**: The `SUPABASE_SERVICE_ROLE_KEY` is required for the API route to bypass RLS.

## Database Setup

1. **Create the user_profiles table first:**
   ```sql
   create table user_profiles (
     id uuid primary key references auth.users(id) on delete cascade,
     email text,
     role text not null default 'artist',
     created_at timestamp default now()
   );
   ```

2. **Create the royalties table:**
   ```sql
   create table royalties (
     id uuid primary key default uuid_generate_v4(),
     user_id uuid references auth.users(id) on delete cascade,
     song_title text,
     iswc text,
     song_composers text,
     broadcast_date date,
     territory text,
     exploitation_source_name text,
     usage_count int,
     gross_amount numeric,
     administration_percent numeric,
     net_amount numeric,
     created_at timestamp default now()
   );
   ```

3. **Enable Row Level Security:**
   ```sql
   alter table user_profiles enable row level security;
   alter table royalties enable row level security;
   ```

4. **Create RLS policies for user_profiles:**
   ```sql
   create policy "Users can view their own profile"
   on user_profiles for select
   using (auth.uid() = id);

   create policy "Users can insert their own profile"
   on user_profiles for insert
   with check (auth.uid() = id);

   create policy "Users can update their own profile"
   on user_profiles for update
   using (auth.uid() = id);
   ```

5. **Create RLS policies for royalties:**
   ```sql
   create policy "Users can view their own data"
   on royalties for select
   using (auth.uid() = user_id);

   create policy "Users can insert their own data"
   on royalties for insert
   with check (auth.uid() = user_id);

   create policy "Users can update their own data"
   on royalties for update
   using (auth.uid() = user_id);

   create policy "Users can delete their own data"
   on royalties for delete
   using (auth.uid() = user_id);
   ```

## Features

### Authentication
- Login page at `/login` with email/password authentication
- Automatic redirect to `/royalty-uploader` after login
- Logout functionality in the top-right corner

### Royalty Uploader Page (`/royalty-uploader`)
- **CSV Upload**: Upload CSV files with royalty data (up to 10MB)
- **Server-Side Processing**: Files are processed on the server to handle large datasets
- **Progress Notifications**: Real-time updates during upload and processing
- **Artist Selection**: Admins can upload royalties for specific artists
- **Automatic Track Creation**: Creates tracks if they don't exist
- **Batched Inserts**: Inserts royalties in batches of 500 for performance
- **Toast Notifications**: Success/error messages for all operations

### CSV Format
The CSV should include these columns:
- Song Title
- ISWC
- Song Composer(s)
- Broadcast Date
- Territory
- Exploitation Source Name
- Usage Count
- Gross Amount
- Administration %
- Net Amount

### Security
- Row Level Security (RLS) ensures users can only access their own data
- All database operations are restricted by user ID
- Authentication required for all pages except login

## Testing

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Create a test user:**
   - Go to `/login`
   - Use the sign-up form to create a new account
   - Or use the test credentials: `test@test.com` / `testpassword123`

3. **Upload test data:**
   - Use the provided `test-royalty-data.csv` file
   - Upload it through the interface
   - Verify the data appears in the table

4. **Test editing and deletion:**
   - Click the edit button on any record
   - Modify the data and save
   - Click the delete button to remove a record

## File Structure

```
src/
├── app/
│   ├── api/
│   │   └── royalties/
│   │       └── ingest/
│   │           └── route.ts    # NEW: Server-side CSV ingestion API
│   ├── login/
│   │   └── page.tsx            # Login page
│   └── royalty-uploader/
│       └── page.tsx            # UPDATED: Frontend uploader (no client parsing)
├── components/
│   └── ui/                     # Shadcn UI components
│       ├── button.tsx
│       ├── input.tsx
│       ├── toast.tsx
│       └── ...
└── lib/
    ├── auth.tsx                # Authentication context
    ├── supabaseClient.ts       # Supabase client (browser)
    ├── supabaseAdmin.ts        # Supabase admin client (server)
    └── utils.ts                # Utility functions
```

## Dependencies

- `papaparse` - CSV parsing (client & server)
- `@types/papaparse` - TypeScript types for PapaParse
- `@supabase/supabase-js` - Supabase client
- `@supabase/ssr` - Supabase server-side utilities
- All existing UI dependencies (Radix UI, etc.)

No new dependencies needed - everything is already installed!

## How It Works

### Upload Flow:
1. **Frontend** (`page.tsx`):
   - User selects artist
   - User selects CSV file (validated: max 10MB)
   - File is uploaded to Supabase Storage bucket `royalties`
   - Frontend calls `/api/royalties/ingest` with `artistId` and `filePath`

2. **API Route** (`/api/royalties/ingest/route.ts`):
   - Downloads CSV from Supabase Storage
   - Parses CSV using PapaParse (server-side)
   - Normalizes data fields
   - Creates tracks if they don't exist (unique by `artist_id` + `song_title`)
   - Inserts royalties in batches of 500
   - Returns success response with count

3. **Frontend Response**:
   - Shows success toast with number of records inserted
   - Resets form
   - Clears file selection

### Error Handling:
- File validation (type, size)
- Storage upload errors
- CSV parsing errors
- Database insertion errors
- All errors shown via toast notifications

## Testing

### Test with a large CSV:
1. Create a CSV with 5,000+ rows
2. Upload through the interface
3. Monitor the progress notifications
4. Verify all records are inserted successfully

### Expected behavior:
- File uploads to storage quickly
- "Processing CSV on server..." message appears
- Success toast shows total records inserted
- No browser memory issues or crashes

## Troubleshooting

### Error: "Failed to download file from storage"
- ✅ Check that the `royalties` bucket exists
- ✅ Check storage policies allow service role access
- ✅ Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly

### Error: "Failed to upload file"
- ✅ Check that the `royalties` bucket exists
- ✅ Check storage policies allow authenticated user uploads
- ✅ Verify file is a valid CSV and under 10MB

### Error: "Failed to create track"
- ✅ Check `tracks` table exists and has correct columns
- ✅ Verify `artist_id` is valid
- ✅ Check database policies allow inserts
