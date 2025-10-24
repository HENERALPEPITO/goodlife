# Royalty Uploader Setup Guide

## Database Setup

1. **Create the royalties table in Supabase:**
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

2. **Enable Row Level Security:**
   ```sql
   alter table royalties enable row level security;
   ```

3. **Create RLS policies:**
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
- **CSV Upload**: Upload CSV files with royalty data
- **Data Table**: View all uploaded royalty records
- **Inline Editing**: Click the edit button to modify any record
- **Delete Records**: Click the delete button with confirmation modal
- **Toast Notifications**: Success/error messages for all operations
- **User Isolation**: Each user can only see and manage their own data

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
│   ├── login/
│   │   └── page.tsx          # Login page
│   └── royalty-uploader/
│       └── page.tsx          # Main royalty uploader page
├── components/
│   └── ui/                   # Shadcn UI components
│       ├── button.tsx
│       ├── input.tsx
│       ├── toast.tsx
│       ├── dialog.tsx
│       └── ...
└── lib/
    ├── auth.tsx             # Authentication context
    ├── supabaseClient.ts    # Supabase client
    └── utils.ts             # Utility functions
```

## Dependencies Added

- `@radix-ui/react-toast` - Toast notifications
- `@radix-ui/react-dialog` - Modal dialogs
- `@radix-ui/react-dropdown-menu` - Dropdown menus
- `@radix-ui/react-label` - Form labels
- `@radix-ui/react-slot` - Slot component
- `class-variance-authority` - CSS class variants
- `tailwind-merge` - Tailwind class merging
- `papaparse` - CSV parsing (already installed)

## Environment Variables

Make sure your `.env.local` file contains:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```
