# GoodLife Royalty Management System - Implementation Guide

## 🎯 Overview

This is a complete role-based music royalties management system built with:
- **Next.js 16** (App Router)
- **Supabase** (Auth + PostgreSQL)
- **TypeScript**
- **Tailwind CSS**
- **Shadcn UI**
- **React Query** (TanStack Query)
- **Recharts** (Analytics)
- **PapaParse** (CSV Parsing)

## 🏗️ System Architecture

### Database Schema

The system uses 4 main tables:

1. **user_profiles** - Extends Supabase auth with roles
2. **tracks** - Artist's music catalog
3. **royalties** - Royalty payments and usage data
4. **payment_requests** - Artist payment requests

### User Roles

#### 🎨 Artist Role
- View personal analytics (revenue, streams, top tracks)
- View royalty statements (read-only)
- View catalog (read-only)
- Request payments
- Cannot edit or delete any data

#### 👨‍💼 Admin Role
- View all artists' data
- Upload CSV royalty data
- Create/Edit/Delete tracks
- Create/Edit/Delete royalties
- Approve/Reject payment requests
- View aggregated analytics across all artists

## 📦 Setup Instructions

### 1. Database Setup

Run the SQL schema in your Supabase SQL Editor:

```bash
# Use this file:
complete-database-schema.sql
```

This will create:
- All required tables
- Row Level Security (RLS) policies
- Indexes for performance
- Sample data structure

### 2. Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Create Test Users

#### Create Admin User:
1. Go to Supabase Auth Dashboard
2. Create user: `admin@test.com` / password: `admin123456`
3. Run SQL:
```sql
INSERT INTO user_profiles (id, email, role)
VALUES ('admin-user-id-from-auth', 'admin@test.com', 'admin');
```

#### Create Artist User:
1. Create user: `artist@test.com` / password: `artist123456`
2. Run SQL:
```sql
INSERT INTO user_profiles (id, email, role)
VALUES ('artist-user-id-from-auth', 'artist@test.com', 'artist');
```

### 5. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000`

## 📁 Project Structure

```
src/
├── app/
│   ├── analytics/        # Analytics dashboard with charts
│   ├── api/             # API routes (legacy, not used)
│   ├── artists/         # Admin: Artist management
│   ├── catalog/         # Track catalog with CRUD
│   ├── login/           # Authentication page
│   ├── royalties/       # Royalty management + payment requests
│   ├── royalty-uploader/ # Admin: CSV upload
│   ├── settings/        # User settings
│   ├── layout.tsx       # Root layout with sidebar
│   ├── page.tsx         # Role-based dashboard
│   └── providers.tsx    # React Query + Auth providers
├── components/
│   ├── ui/              # Shadcn UI components
│   ├── AdminDashboard.tsx
│   ├── ArtistDashboard.tsx
│   ├── Sidebar.tsx      # Role-based navigation
│   └── Topbar.tsx       # Top bar with user info
├── lib/
│   ├── auth.tsx         # Auth context and hooks
│   ├── supabaseClient.ts
│   └── utils.ts
└── types.ts             # TypeScript definitions
```

## 🔑 Key Features

### 1. Role-Based Authentication
- Secure role checking on every page
- Automatic redirects for unauthorized access
- RLS policies enforce data access at database level

### 2. CSV Upload System
- Admin uploads CSV with format:
  ```
  Song Title, ISWC, Composer, Date, Territory, Source, Usage Count, Gross, Admin %, Net
  ```
- Automatically creates/links tracks
- Parses and validates data with PapaParse
- Associates royalties with selected artist

### 3. Analytics Dashboard
- Top performing tracks (bar chart)
- Revenue by source (pie chart)
- Revenue by territory (horizontal bar chart)
- Monthly revenue trend (line chart)
- Key metrics: Total Revenue, Streams, Avg per Stream, Top Territory

### 4. Payment Request System
- Artists can request payment for available balance
- Admins can approve/reject requests
- Status tracking: pending, approved, rejected, paid
- Prevents duplicate requests for same balance

### 5. Catalog Management
- Admins: Full CRUD operations
- Artists: Read-only access to their tracks
- Fields: Title, ISWC, Composers, Release Date, Platform, Territory

### 6. Royalty Management
- View royalties with track information
- Edit/Delete (admin only)
- Export to CSV/PDF
- Filter and search capabilities
- Summary statistics

## 🔒 Security Features

### Row Level Security (RLS)
All tables have RLS enabled with policies:

```sql
-- Artists can only view their own data
CREATE POLICY "Artist can view own tracks" 
ON tracks FOR SELECT 
USING (artist_id = auth.uid());

-- Admins can view everything
CREATE POLICY "Admins can view all tracks" 
ON tracks FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```

### Frontend Protection
- `useAuth()` hook checks user role
- Automatic redirects for unauthorized pages
- UI elements hidden based on role
- Server-side validation via RLS

## 📊 Data Flow

### Artist Payment Request Flow:
1. Artist views dashboard with available balance
2. Clicks "Request Payment" button
3. System calculates: `total_revenue - pending_requests`
4. Creates payment_request with status "pending"
5. Admin sees request in payment requests section
6. Admin approves or rejects
7. Status updated in database

### CSV Upload Flow:
1. Admin selects artist from dropdown
2. Uploads CSV file
3. PapaParse parses CSV
4. System checks if tracks exist or creates new ones
5. Inserts royalty records linked to tracks
6. Shows success message with count

## 🎨 UI/UX Features

- **Dark Mode** - Full theme support
- **Responsive** - Mobile-friendly design
- **Toast Notifications** - User feedback for all actions
- **Loading States** - Skeleton loaders and spinners
- **Form Validation** - Required fields and error messages
- **Confirmation Dialogs** - Prevent accidental deletions

## 🚀 Deployment

### Vercel (Recommended)
```bash
npm run build
# Deploy to Vercel via GitHub integration
```

### Environment Variables in Production
Set the same `.env.local` variables in your hosting platform:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 📝 API Reference

### Main Hooks

#### `useAuth()`
```typescript
const { user, loading, signIn, signOut, signUp } = useAuth();
```

#### Direct Supabase Queries
```typescript
// Get user's royalties
const { data, error } = await supabase
  .from("royalties")
  .select("*, tracks(title)")
  .eq("artist_id", user.id);
```

## 🐛 Troubleshooting

### Common Issues

1. **"User not found" error**
   - Ensure user_profiles entry exists for the auth user
   - Check that role is set correctly

2. **"Permission denied" errors**
   - Verify RLS policies are created
   - Check user role in user_profiles table

3. **CSV upload fails**
   - Verify CSV format matches expected columns
   - Check that artist is selected
   - Ensure Supabase connection is working

4. **Charts not displaying**
   - Check that royalty data exists
   - Verify broadcast_date field has valid dates
   - Check browser console for errors

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Shadcn UI Components](https://ui.shadcn.com)
- [React Query](https://tanstack.com/query/latest)
- [Recharts](https://recharts.org)

## 🎯 Future Enhancements

Potential features to add:
- Email notifications for payment approvals
- Bulk CSV upload with progress bar
- Advanced filtering and search
- Custom date range reports
- Artist-specific branding
- Multi-currency support
- Automated royalty calculations
- Integration with streaming platform APIs

## 📞 Support

For issues or questions, check:
1. This documentation
2. Supabase RLS policies
3. Browser console errors
4. Network tab for failed requests

---

**Built with ❤️ for GoodLife Music**

















