# Supabase Authentication Setup

This document outlines the complete Supabase authentication integration for the Goodlife project.

## 🚀 Quick Start

### 1. Database Setup (Required First)

1. **Go to your Supabase Dashboard**: https://ulvxfugjzgrjmcfvybjx.supabase.co
2. **Navigate to SQL Editor** (in the left sidebar)
3. **Run the updated database schema** (includes user_profiles table):

```sql
-- Create user profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('artist', 'label', 'manager')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tracks table
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  isrc TEXT NOT NULL,
  composers TEXT NOT NULL,
  release_date DATE NOT NULL,
  platform TEXT NOT NULL,
  territory TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create royalty_statements table
CREATE TABLE IF NOT EXISTS royalty_statements (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  track_title TEXT NOT NULL,
  platform TEXT NOT NULL,
  period TEXT NOT NULL,
  streams INTEGER NOT NULL,
  revenue_usd DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('paid', 'pending')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE royalty_statements ENABLE ROW LEVEL SECURITY;

-- Create policies for user_profiles
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Create policies for tracks and royalty_statements
CREATE POLICY "Allow public read access on tracks" ON tracks FOR SELECT USING (true);
CREATE POLICY "Allow public insert on tracks" ON tracks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on tracks" ON tracks FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on tracks" ON tracks FOR DELETE USING (true);

CREATE POLICY "Allow public read access on royalty_statements" ON royalty_statements FOR SELECT USING (true);
CREATE POLICY "Allow public insert on royalty_statements" ON royalty_statements FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on royalty_statements" ON royalty_statements FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on royalty_statements" ON royalty_statements FOR DELETE USING (true);

-- Insert sample data
INSERT INTO tracks (id, title, isrc, composers, release_date, platform, territory, created_at) VALUES
('t1', 'Sunrise', 'US-ABC-25-00001', 'C. Elipan, A. Reyes', '2025-07-12', 'Spotify', 'Global', NOW()),
('t2', 'Ocean Drive', 'US-ABC-25-00002', 'C. Elipan', '2025-05-03', 'Apple Music', 'US', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO royalty_statements (id, track_id, track_title, platform, period, streams, revenue_usd, status, created_at) VALUES
('r1', 't1', 'Sunrise', 'Spotify', '2025-Q1', 15000, 750.50, 'paid', NOW()),
('r2', 't1', 'Sunrise', 'Apple Music', '2025-Q1', 8500, 425.25, 'paid', NOW()),
('r3', 't2', 'Ocean Drive', 'Spotify', '2025-Q1', 22000, 1100.00, 'pending', NOW()),
('r4', 't2', 'Ocean Drive', 'YouTube', '2025-Q1', 12000, 600.00, 'paid', NOW())
ON CONFLICT (id) DO NOTHING;
```

### 2. Enable Authentication in Supabase

1. **Go to Authentication > Settings** in your Supabase dashboard
2. **Enable Email Authentication**:
   - Turn on "Enable email confirmations"
   - Set "Site URL" to `http://localhost:3000` (for development)
   - Add `http://localhost:3000/**` to "Redirect URLs"

### 3. Test the Authentication

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Open the application**: http://localhost:3000
3. **You'll be redirected to login page**
4. **Create a new account**:
   - Click "Don't have an account? Sign up"
   - Enter email, password, and select role
   - Click "Sign up"
5. **Sign in** with your credentials

## 🔧 Authentication Features

### What's New:
- **Real Authentication** - Uses Supabase Auth instead of localStorage
- **User Registration** - Create accounts with email/password
- **Role-based Access** - Artist, Label, Manager roles
- **Secure Sessions** - JWT tokens with automatic refresh
- **Loading States** - Proper loading indicators during auth
- **Error Handling** - Comprehensive error messages

### Authentication Flow:
1. **Sign Up**: Create account with email, password, and role
2. **Sign In**: Login with email and password
3. **Session Management**: Automatic token refresh
4. **Sign Out**: Secure logout with session cleanup

### User Roles:
- **Artist**: Music creators
- **Label**: Record labels
- **Manager**: Artist managers

## 🔒 Security Features

- **Row Level Security (RLS)** enabled on all tables
- **User-specific data access** - users can only access their own profile
- **JWT token authentication** with automatic refresh
- **Secure password handling** through Supabase Auth
- **Session management** with proper cleanup

## 🧪 Testing the Setup

### 1. Test User Registration
- Go to http://localhost:3000/login
- Click "Don't have an account? Sign up"
- Fill in email, password, and select role
- Click "Sign up"
- Check your email for confirmation (if enabled)

### 2. Test User Login
- Use the credentials you just created
- Click "Sign in"
- You should be redirected to the dashboard

### 3. Test Sign Out
- Click the "Sign out" button in the top-right corner
- You should be redirected to the login page

### 4. Test Protected Routes
- Try accessing http://localhost:3000/catalog without being logged in
- You should be redirected to the login page

## 🚨 Important Notes

1. **Database Schema**: Must run the updated SQL schema first
2. **Email Confirmation**: May need to check Supabase settings for email confirmation
3. **Environment Variables**: The app uses hardcoded credentials for development
4. **Production Setup**: For production, use environment variables and proper email settings

## 🔄 Migration Complete

The application now uses:
- ✅ Supabase Authentication (instead of localStorage)
- ✅ Real user accounts with email/password
- ✅ Role-based user profiles
- ✅ Secure session management
- ✅ Protected routes with middleware
- ✅ Proper loading states
- ✅ Error handling

Your authentication is now fully integrated with Supabase! 🎉

