# Supabase Backend Integration

This document outlines the Supabase backend integration for the Goodlife project.

## 🚀 Quick Start

### 1. Database Setup

1. Go to your Supabase project dashboard: https://ulvxfugjzgrjmcfvybjx.supabase.co
2. Navigate to the SQL Editor
3. Copy and paste the contents of `database-schema.sql` into the editor
4. Run the SQL to create the tables and sample data

### 2. Environment Variables

The Supabase client is already configured with your credentials in `src/lib/supabaseClient.ts`. For production, you should:

1. Create a `.env.local` file in the project root:
```env
NEXT_PUBLIC_SUPABASE_URL=https://ulvxfugjzgrjmcfvybjx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsdnhmdWdqemdyam1jZnZ5Ymp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMTEwMDcsImV4cCI6MjA3Njc4NzAwN30.EHZGnCR7hMsncMdQ6LSW5WOg-z3GZFCxpjCvOsqSj8I
```

2. Update `src/lib/supabaseClient.ts` to use environment variables:
```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
```

### 3. Test the Connection

Run the test script to verify the connection:
```bash
node test-supabase.js
```

## 📊 Database Schema

### Tables Created

1. **tracks** - Stores music track information
   - `id` (TEXT, PRIMARY KEY)
   - `title` (TEXT)
   - `isrc` (TEXT)
   - `composers` (TEXT)
   - `release_date` (DATE)
   - `platform` (TEXT)
   - `territory` (TEXT)
   - `created_at` (TIMESTAMP)

2. **royalty_statements** - Stores royalty payment information
   - `id` (TEXT, PRIMARY KEY)
   - `track_id` (TEXT, FOREIGN KEY)
   - `track_title` (TEXT)
   - `platform` (TEXT)
   - `period` (TEXT)
   - `streams` (INTEGER)
   - `revenue_usd` (DECIMAL)
   - `status` (TEXT: 'paid' | 'pending')
   - `created_at` (TIMESTAMP)

### Sample Data

The schema includes sample data for testing:
- 2 sample tracks
- 4 sample royalty statements

## 🔧 API Endpoints Updated

All API endpoints have been migrated to use Supabase:

### Catalog API
- `GET /api/catalog` - Fetch all tracks
- `POST /api/catalog` - Create new track
- `PUT /api/catalog/[id]` - Update track
- `DELETE /api/catalog/[id]` - Delete track

### Royalties API
- `GET /api/royalties` - Fetch royalty statements with pagination and filtering
- `GET /api/royalties/export` - Export royalty statements as CSV

## 🔒 Security

- Row Level Security (RLS) is enabled on all tables
- Public access policies are configured for development
- For production, implement proper authentication and authorization

## 🚨 Important Notes

1. **Database Schema**: Run the `database-schema.sql` file in your Supabase SQL Editor before testing the application.

2. **Data Transformation**: The API routes include data transformation between the database schema (snake_case) and the application format (camelCase).

3. **Error Handling**: All API routes include comprehensive error handling and logging.

4. **Testing**: Use the test script to verify the connection before running the application.

## 🧪 Testing

1. Run the test script: `node test-supabase.js`
2. Start the development server: `npm run dev`
3. Test the API endpoints:
   - GET http://localhost:3000/api/catalog
   - GET http://localhost:3000/api/royalties
   - GET http://localhost:3000/api/royalties/export

## 🔄 Migration Complete

The application has been successfully migrated from in-memory storage to Supabase backend. All existing functionality is preserved while gaining:

- Persistent data storage
- Scalable database backend
- Real-time capabilities (if needed)
- Built-in authentication (for future use)
- Database management tools

