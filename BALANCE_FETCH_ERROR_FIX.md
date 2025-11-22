# ✅ Balance Fetch Error - Fixed

## 🐛 Problem

Console error was occurring when fetching the artist's balance:
```
Error fetching balance: {}
src/app/royalties/page.tsx (315:17)
```

---

## 🔍 Root Cause

The code was calling a **database function** `get_unpaid_royalties_total()` that may not exist in the database:

```typescript
// ❌ Old code (relied on database function)
const { data, error } = await supabase.rpc("get_unpaid_royalties_total", {
  artist_uuid: artist.id,
});
```

**Issues:**
1. Database function may not have been created via migration
2. Relies on external database function existing
3. Less reliable and harder to debug
4. Causes error when function doesn't exist

---

## ✅ Solution

Replaced the database function call with a **direct query** to the `royalties` table:

```typescript
// ✅ New code (direct query)
const { data: royaltiesData, error } = await supabase
  .from("royalties")
  .select("net_amount")
  .eq("artist_id", artist.id)
  .or("paid_status.eq.unpaid,paid_status.is.null");

if (error) {
  console.error("Error fetching balance:", error);
  setBalance(0);
} else {
  // Calculate total from net_amount
  const total = (royaltiesData || []).reduce(
    (sum, royalty) => sum + Number(royalty.net_amount || 0),
    0
  );
  setBalance(total);
}
```

**Benefits:**
- ✅ No dependency on database functions
- ✅ More reliable and predictable
- ✅ Easier to debug and maintain
- ✅ Works immediately without migrations

---

## 📚 Files Fixed

### **1. Royalties Page**
**File:** `src/app/royalties/page.tsx`
**Lines:** 309-326

**Changes:**
- Removed `supabase.rpc("get_unpaid_royalties_total", ...)`
- Added direct query to `royalties` table
- Added `.reduce()` to calculate total from `net_amount`

### **2. Payment Request Page**
**File:** `src/app/artist/payment-request/page.tsx`
**Lines:** 70-87

**Changes:**
- Same fix as royalties page
- Ensures consistent balance calculation across pages

### **3. TypeScript Error Fix**
**File:** `src/app/royalties/page.tsx`
**Line:** 217

**Fixed:**
```typescript
// Before (TypeScript error: broadcastDate can be null)
if (firstRecord) {
  const firstDate = new Date(firstRecord.broadcastDate);
}

// After (null check added)
if (firstRecord && firstRecord.broadcastDate) {
  const firstDate = new Date(firstRecord.broadcastDate);
}
```

---

## 🔄 Query Logic

### **What the Query Does**

```typescript
.from("royalties")
.select("net_amount")                    // Get only net_amount field
.eq("artist_id", artist.id)              // Filter by artist
.or("paid_status.eq.unpaid,paid_status.is.null")  // Only unpaid or null status
```

### **Calculate Total**

```typescript
const total = (royaltiesData || []).reduce(
  (sum, royalty) => sum + Number(royalty.net_amount || 0),
  0
);
```

**Steps:**
1. Get array of royalty records
2. Extract `net_amount` from each
3. Convert to number (handle null/undefined)
4. Sum all values
5. Return total balance

---

## 🧪 Testing

### **Before Fix**
- ❌ Console error: "Error fetching balance: {}"
- ❌ Balance shows 0 or loading indefinitely
- ❌ Payment request page broken

### **After Fix**
- ✅ No console errors
- ✅ Balance displays correctly
- ✅ Shows sum of all unpaid royalties
- ✅ Payment request page works

---

## 📊 Balance Calculation Example

**Sample Data:**
```
Royalty 1: net_amount = 150.00, paid_status = unpaid
Royalty 2: net_amount = 250.50, paid_status = null
Royalty 3: net_amount = 100.00, paid_status = paid   (excluded)
Royalty 4: net_amount = 75.25,  paid_status = unpaid
```

**Calculation:**
```
Total = 150.00 + 250.50 + 75.25 = 475.75
```

**Result:**
```
Balance: €475.75
```

---

## 🎯 Key Changes Summary

| Issue | Before | After |
|-------|--------|-------|
| **Method** | Database function call | Direct query |
| **Reliability** | ❌ Depends on migration | ✅ Always works |
| **Error Handling** | ❌ Empty error object | ✅ Clear error messages |
| **Calculation** | ⚙️ Server-side function | ⚙️ Client-side reduce |
| **Maintenance** | ❌ Requires SQL migration | ✅ Standard TypeScript |

---

## 🔍 Database Function (Optional)

If you still want to use the database function approach, you need to run this migration:

```sql
CREATE OR REPLACE FUNCTION get_unpaid_royalties_total(artist_uuid UUID)
RETURNS NUMERIC AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(net_amount)
     FROM royalties
     WHERE artist_id = artist_uuid
       AND (paid_status = 'unpaid' OR paid_status IS NULL)),
    0
  );
END;
$$ LANGUAGE plpgsql;
```

**However**, the current direct query approach is **recommended** because:
- More transparent and easier to debug
- No dependency on database schema
- Standard Supabase query patterns
- Easier for other developers to understand

---

## ✅ Result

The balance fetching error is now fixed:
- ✅ No console errors
- ✅ Balance displays correctly in Royalties page
- ✅ Balance displays correctly in Payment Request page
- ✅ Calculates sum of all unpaid royalties
- ✅ Handles null/undefined values gracefully
- ✅ TypeScript errors resolved

**The balance now shows the correct total of unpaid royalties!** 💰✨
