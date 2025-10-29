# Quick Fix Guide - Invoice Error

## Error: "Error fetching invoices: {}"

### Problem
The `invoices` table doesn't exist in your Supabase database, causing the AdminInvoiceList component to fail.

### Solution (5 minutes)

#### Step 1: Run the Invoice Migration

1. Open your **Supabase Dashboard**
2. Go to **SQL Editor**
3. Open the file `invoices-table-migration.sql` from your project
4. Copy the **entire contents**
5. Paste into the SQL Editor
6. Click **"Run"**
7. Wait for: ✅ "Success. No rows returned"

#### Step 2: Verify Table Created

Run this query in SQL Editor:

```sql
SELECT * FROM invoices LIMIT 1;
```

You should see: "0 rows" (empty table is fine)

#### Step 3: Refresh Your App

1. Go back to your browser
2. Refresh the page (F5)
3. The error should be gone!

---

## Complete Setup (If Starting Fresh)

If you haven't run **any** migrations yet, you need to run all 3 in this order:

### 1. Admin Features Migration
**File:** `admin-features-migration.sql`
- Creates user_profiles and royalties tables
- ⏱️ Takes: ~30 seconds

### 2. Invoice Table Migration  
**File:** `invoices-table-migration.sql`
- Creates invoices table
- ⏱️ Takes: ~10 seconds

### 3. Payment Features Migration
**File:** `payment-features-migration.sql`
- Creates payment_requests and payment_receipts tables
- ⏱️ Takes: ~30 seconds

**Total time:** ~2 minutes

---

## How to Run a Migration

1. Open Supabase Dashboard
2. Click **SQL Editor** in sidebar
3. Click **"New Query"**
4. Copy migration file contents
5. Paste into editor
6. Click **"Run"** button
7. Check for success message

---

## Still Having Issues?

### Check if tables exist:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_profiles', 'royalties', 'invoices', 'payment_requests', 'payment_receipts')
ORDER BY table_name;
```

Expected result: All 5 tables listed

### Check environment variables:
Make sure `.env.local` has:
```
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key  
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

### Restart dev server:
```bash
# Stop current server (Ctrl+C)
npm run dev
```

---

## Need Full Documentation?

See `COMPLETE_SETUP_GUIDE.md` for comprehensive setup instructions.

---

**Quick Answer:** Run `invoices-table-migration.sql` in Supabase SQL Editor → Refresh page → Fixed! ✅



