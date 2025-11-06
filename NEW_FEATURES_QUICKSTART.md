# 🚀 Quick Start: Invoice & Enhanced Catalog Features

## Quick Setup (5 minutes)

### 1. Run Database Migration

```bash
# Open Supabase Dashboard → SQL Editor
# Copy and paste the contents of: invoices-table-migration.sql
# Click "Run" to execute
```

✅ This creates the `invoices` table with all necessary fields, policies, and functions.

### 2. Restart Your Development Server

```bash
# Stop your current server (Ctrl+C)
npm run dev
```

✅ This ensures all new components are loaded.

### 3. You're Done!

Navigate to your app and test the new features:
- **Invoices:** Click "Invoices" in the sidebar
- **Enhanced Catalog:** Go to "Catalog" and try the search bar

---

## 🎯 Quick Feature Tour

### For Artists

#### Creating Your First Invoice

1. **Login** as an artist user
2. **Click** "Invoices" in the sidebar
3. **See** your available balance displayed prominently
4. **Click** "Request Payment" button
5. **Fill in:**
   - Amount (up to your available balance)
   - Payment mode (Bank Transfer, PayPal, etc.)
   - Optional remarks
6. **Submit** - Your invoice is created with a unique number (e.g., INV-2025-001)
7. **Wait** for admin approval

**Your Invoice Status Journey:**
```
Pending (Yellow) → Approved (Blue) → Paid (Green)
                 ↓
              Rejected (Red)
```

### For Admins

#### Managing Invoices

1. **Login** as admin
2. **Click** "Invoices" in the sidebar
3. **See** all artist invoices with statistics:
   - Total invoices
   - Pending count and amount
   - Paid count
   - Total amount
4. **Search** by invoice number, artist email, or payment mode
5. **Filter** by status (Pending, Approved, Paid, Rejected)
6. **Take Action:**
   - **Pending invoices:** Click ✓ Approve or ✗ Reject
   - **Approved invoices:** Click 💰 Mark Paid
7. **Confirm** your action in the dialog

#### Using Enhanced Catalog Search

1. **Go to** "Catalog"
2. **Type** in the search bar:
   - Track titles
   - ISWC codes
   - Composer names
   - Platforms (Spotify, Apple Music, etc.)
   - Territories
3. **See** instant filtering as you type
4. **Clear** search to see all tracks again

#### Delete All Tracks (Use with Caution!)

1. **Go to** "Catalog" as admin
2. **Click** the red "Delete All" button
3. **Read** the warning carefully
4. **Confirm** if you're absolutely sure
5. **All tracks** and associated royalties are deleted

⚠️ **Warning:** This action cannot be undone!

---

## 📋 Test Scenarios

### Scenario 1: Artist Payment Request Flow

```
1. Artist has $1,500 in royalties
2. Artist creates invoice for $1,000
3. Available balance updates to $500
4. Admin approves the invoice
5. Admin marks invoice as paid
6. Artist sees "Paid" status
```

### Scenario 2: Admin Invoice Management

```
1. Multiple artists submit invoices
2. Admin opens Invoices page
3. Admin searches for specific artist
4. Admin filters by "Pending" status
5. Admin reviews and approves valid invoices
6. Admin rejects invalid invoices
```

### Scenario 3: Catalog Search

```
1. Admin has 100+ tracks in catalog
2. Admin types "Sunset" in search
3. Only matching tracks appear
4. Admin types "T-123" to find by ISWC
5. Admin clears search to see all
```

---

## 🔍 Testing Checklist

### Basic Functionality
- [ ] Invoices link appears in sidebar
- [ ] Artist can create invoice
- [ ] Admin can view all invoices
- [ ] Admin can approve/reject invoices
- [ ] Search filters tracks correctly
- [ ] Delete All shows confirmation

### Edge Cases
- [ ] Artist cannot request more than available balance
- [ ] Artist cannot see other artists' invoices
- [ ] Admin sees invoices from all artists
- [ ] Search handles empty results gracefully
- [ ] Delete All is admin-only
- [ ] Invoice numbers are unique

### UI/UX
- [ ] Status badges show correct colors
- [ ] Toast notifications appear on actions
- [ ] Confirmation dialogs prevent accidents
- [ ] Loading states display properly
- [ ] Mobile responsive layout works

---

## 🐛 Quick Troubleshooting

### "Cannot read property 'generate_invoice_number'"

**Cause:** Migration not run completely  
**Fix:**
```sql
-- Run this in Supabase SQL Editor
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  current_year INT;
  next_number INT;
  invoice_num TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(invoice_number FROM 'INV-' || current_year::TEXT || '-(\d+)') 
        AS INTEGER
      )
    ), 0
  ) + 1 INTO next_number
  FROM invoices
  WHERE invoice_number LIKE 'INV-' || current_year::TEXT || '-%';
  
  invoice_num := 'INV-' || current_year || '-' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN invoice_num;
END;
$$ LANGUAGE plpgsql;
```

### "Available balance is negative or wrong"

**Cause:** Royalty data might be missing  
**Fix:** Check that your royalties table has `net_amount` values:
```sql
SELECT COUNT(*), SUM(net_amount) FROM royalties WHERE artist_id = 'your-artist-id';
```

### Search not filtering

**Cause:** Browser cache  
**Fix:** 
1. Hard refresh: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
2. Clear browser cache
3. Restart dev server

### Delete All button not visible

**Cause:** Not logged in as admin  
**Fix:** 
1. Check user role in Supabase Dashboard
2. Ensure `user_profiles` table has correct role for your user
3. Logout and login again

---

## 💡 Pro Tips

### For Artists

1. **Track Your Balance:** Check the Invoices page regularly to see your available balance
2. **Add Remarks:** Use the remarks field to note what period the payment covers
3. **Payment Mode:** Choose your preferred payment method accurately for faster processing

### For Admins

1. **Use Search:** With many invoices, use the search bar to find specific ones quickly
2. **Filter Pending:** Filter by "Pending" to see what needs action
3. **Bulk Approve:** Open pending invoices in separate tabs to review and approve multiple quickly
4. **Regular Cleanup:** Use the statistics dashboard to track invoice flow

### For Developers

1. **Check Console:** Browser console shows helpful debug logs
2. **RLS Testing:** Test with different user roles to verify security
3. **Backup First:** Before using Delete All, always backup your data
4. **Mobile Test:** Test on actual mobile devices for best results

---

## 🎨 UI Element Guide

### Status Colors
- 🟡 **Yellow Badge** = Pending (needs admin action)
- 🔵 **Blue Badge** = Approved (payment being processed)
- 🟢 **Green Badge** = Paid (completed)
- 🔴 **Red Badge** = Rejected (declined)

### Button Types
- **Blue Filled** = Primary action (Create, Save)
- **Green Filled** = Positive action (Approve, Mark Paid)
- **Red Filled** = Destructive action (Delete, confirmed)
- **Red Outline** = Warning action (Delete All)
- **Gray Outline** = Secondary action (Cancel)

### Icons
- 📄 Receipt = Invoices section
- 🔍 Search = Search/filter functionality
- ➕ Plus = Add new item
- ✓ Check = Approve
- ✗ X = Reject
- 💰 Dollar = Mark as paid
- 🗑️ Trash = Delete

---

## 📊 Sample Data (for Testing)

### Create Test Royalties

```sql
-- Add some test royalties for your artist
INSERT INTO royalties (artist_id, track_id, net_amount, usage_count, broadcast_date, exploitation_source_name, territory)
VALUES 
  ('your-artist-id', 'your-track-id', 500.00, 10000, '2024-10-01', 'Spotify', 'US'),
  ('your-artist-id', 'your-track-id', 750.00, 15000, '2024-10-15', 'Apple Music', 'Global'),
  ('your-artist-id', 'your-track-id', 250.00, 5000, '2024-11-01', 'YouTube', 'UK');
```

This gives your test artist $1,500 in available balance to request.

### Expected Result

After running the above:
- Artist sees **Available Balance: $1,500.00**
- Artist can create invoice for up to $1,500
- After creating a $1,000 invoice, balance becomes $500

---

## 🎯 Next Steps

1. ✅ **Run the migration**
2. ✅ **Test as artist and admin**
3. ✅ **Familiarize yourself with the UI**
4. 📚 **Read the full documentation:** `INVOICE_CATALOG_FEATURES.md`
5. 🚀 **Deploy to production when ready**

---

## 📞 Need Help?

1. Check `INVOICE_CATALOG_FEATURES.md` for detailed documentation
2. Review browser console for error messages
3. Verify RLS policies in Supabase Dashboard
4. Check that user roles are set correctly
5. Ensure all migrations were run successfully

---

**Happy invoicing! 🎉**













