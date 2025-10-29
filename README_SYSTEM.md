# 🎵 GoodLife - Music Royalty Management System

> A complete role-based music royalties management platform built with Next.js and Supabase

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-green)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC)](https://tailwindcss.com/)

## 🌟 Features

### For Artists 🎤
- **Personal Dashboard** - View your revenue, streams, and top performing tracks
- **Analytics** - Beautiful charts showing performance across platforms and territories
- **Royalty Statements** - Detailed breakdown of earnings
- **Payment Requests** - One-click payment requests with status tracking
- **Track Catalog** - Browse your music catalog

### For Admins 👨‍💼
- **Admin Dashboard** - Overview of all artists and system-wide statistics
- **Artist Management** - View and manage all registered artists
- **CSV Upload** - Bulk import royalty data from CSV files
- **Full CRUD** - Create, edit, and delete tracks and royalties
- **Payment Management** - Approve or reject artist payment requests
- **Advanced Analytics** - System-wide performance insights

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Supabase account
- npm or yarn

### Installation

```bash
# Clone the repository
cd goodlife

# Install dependencies
npm install

# Run development server
npm run dev
```

### Database Setup

1. Create a Supabase project
2. Run the SQL schema:
   ```bash
   # Copy contents of complete-database-schema.sql
   # Paste into Supabase SQL Editor and run
   ```

3. Create test users:
   - Go to Supabase Auth Dashboard
   - Create users as described in QUICK_START.md

### Environment Variables

Update `src/lib/supabaseClient.ts` with your credentials, or create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## 📖 Documentation

- **[QUICK_START.md](./QUICK_START.md)** - Get started in 5 minutes
- **[IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)** - Complete technical guide
- **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** - Project overview

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Backend**: Supabase (PostgreSQL + Auth)
- **Styling**: Tailwind CSS, Shadcn UI
- **State**: React Query (TanStack Query)
- **Charts**: Recharts
- **Parsing**: PapaParse (CSV)

### Database Schema

```
user_profiles
├── id (UUID, FK to auth.users)
├── email (TEXT)
├── role (TEXT: 'admin' | 'artist')
└── created_at (TIMESTAMP)

tracks
├── id (UUID)
├── artist_id (UUID, FK to users)
├── title (TEXT)
├── iswc (TEXT)
├── composers (TEXT)
├── release_date (DATE)
├── platform (TEXT)
└── territory (TEXT)

royalties
├── id (UUID)
├── track_id (UUID, FK to tracks)
├── artist_id (UUID, FK to users)
├── usage_count (INTEGER)
├── gross_amount (NUMERIC)
├── admin_percent (NUMERIC)
├── net_amount (NUMERIC)
├── broadcast_date (DATE)
├── exploitation_source_name (TEXT)
└── territory (TEXT)

payment_requests
├── id (UUID)
├── artist_id (UUID, FK to users)
├── amount (NUMERIC)
├── status (TEXT: 'pending' | 'approved' | 'rejected' | 'paid')
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)
```

## 🔐 Security

- **Row Level Security (RLS)** - Database-level access control
- **Role-based UI** - Dynamic rendering based on user role
- **Secure Auth** - Supabase authentication
- **Type Safety** - Full TypeScript coverage

### RLS Policies

```sql
-- Artists see only their data
CREATE POLICY "Artist can view own tracks" 
ON tracks FOR SELECT 
USING (artist_id = auth.uid());

-- Admins see everything
CREATE POLICY "Admins can view all tracks" 
ON tracks FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```

## 📊 Sample CSV Format

For royalty uploads:

```csv
Song Title,ISWC,Composer,Date,Territory,Source,Usage Count,Gross,Admin %,Net
Sunset Dreams,T-123.456.789-0,John Doe,2024-10-01,US,Spotify,15000,750.00,15,637.50
Morning Light,T-987.654.321-0,Jane Smith,2024-10-15,Global,Apple Music,8500,425.00,15,361.25
```

See `sample-royalty-data.csv` for more examples.

## 🎨 Screenshots

### Artist Dashboard
- Personal statistics and revenue overview
- Payment request button
- Quick links to analytics and royalties

### Admin Dashboard
- All artists' statistics
- System-wide metrics
- Management tools

### Analytics Page
- Top performing tracks chart
- Revenue by source (pie chart)
- Territory breakdown
- Monthly trends

### CSV Upload
- Artist selection
- File upload with preview
- Batch import confirmation

## 🧪 Testing

### Test as Admin
```
Email: admin@test.com
Password: admin123456
```

**Can:**
- ✅ Upload CSV data
- ✅ View all artists
- ✅ Edit tracks and royalties
- ✅ Approve payment requests
- ✅ View system-wide analytics

### Test as Artist
```
Email: artist@test.com
Password: artist123456
```

**Can:**
- ✅ View personal dashboard
- ✅ See analytics and charts
- ✅ Request payments
- ✅ View catalog (read-only)
- ❌ Cannot edit or delete anything

## 🛣️ Roadmap

### Potential Enhancements
- [ ] Email notifications
- [ ] Bulk operations
- [ ] Advanced filtering
- [ ] Custom date ranges
- [ ] Multi-currency support
- [ ] Streaming API integrations
- [ ] Automated calculations
- [ ] Artist branding options

## 📝 Scripts

```bash
# Development
npm run dev          # Start dev server (port 3000)

# Production
npm run build        # Build for production
npm run start        # Start production server

# Linting
npm run lint         # Run ESLint
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is proprietary software for GoodLife Music.

## 🆘 Support

### Common Issues

**Can't login?**
- Check user exists in Supabase Auth
- Verify user_profiles entry exists with correct role

**Permission denied?**
- Ensure RLS policies are created
- Check user role in database

**CSV upload fails?**
- Verify CSV format matches template
- Ensure artist is selected
- Check Supabase connection

### Getting Help

1. Check [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)
2. Review database RLS policies
3. Check browser console for errors
4. Verify Supabase credentials

## 🙏 Acknowledgments

Built with:
- Next.js by Vercel
- Supabase for backend
- Shadcn UI for components
- Recharts for visualizations
- PapaParse for CSV parsing

## 📞 Contact

For questions or support, contact the GoodLife development team.

---

**Made with ❤️ for musicians and music professionals**







