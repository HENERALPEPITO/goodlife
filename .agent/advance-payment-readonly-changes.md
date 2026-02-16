# Advance Payment UI Update - Hide Advance Quarter

## Summary
Updated the Royalties Management UI to:
1. Display advance payment as a read-only label (ADVANCE: $X.XX) - only when advance exists
2. **Hide the advance payment quarter** from the quarterly royalty list
3. Filter out advance payment records from all royalty displays and counts

## Changes Made

### 1. Backend API (`src/app/api/admin/royalties/[artistId]/route.ts`)
- Fetches `advance_payment` from the `artists` table
- Includes `advancePayment` in the API response

### 2. Frontend UI (`src/app/admin/royalties/[artistId]/page.tsx`)

#### State Management
- Added `advancePayment` state to store the advance amount
- Updated `fetchRoyalties()` to extract advance payment from API response

#### Filtering Logic
- **Modified `groupByQuarter()` function** to skip advance payment records:
  - Filters out records where `isrc === "ADVANCE"`
  - Filters out records where `exploitation_source_name === "Advance Payment"`
  
#### UI Display Updates
1. **Advance Label** (lines 610-616)
   - Shows "ADVANCE: $X.XX" only when `advancePayment > 0`
   - Positioned above the info bar
   - Amber/yellow styling for visibility

2. **Info Bar Count** (line 622)
   - Updated to show count of non-advance royalty records only
   - Uses filter: `royalties.filter(r => r.isrc !== "ADVANCE" && r.exploitation_source_name !== "Advance Payment").length`

3. **Empty State Condition** (line 648)
   - Changed from `royalties.length > 0` to `quarterGroups.length > 0`
   - Ensures proper display when only advance payment exists

## How It Works

### Advance Payment Record Identification
Advance payment records are created with:
- `isrc: "ADVANCE"`
- `exploitation_source_name: "Advance Payment"`
- `track_title: "Advance Payment"`
- Negative `net_amount` value

### Filtering Behavior
✅ **Filtered from:**
- Quarterly groups display
- Royalty record counts
- Quarter totals (gross/net)

✅ **Still displayed:**
- Advance amount label at the top (read-only)

## Result
- The "Q1 2026" (or any quarter) containing only the advance payment record **will not appear** in the quarterly list
- The advance amount is **only shown as a label** at the top
- All royalty counts and totals **exclude** the advance payment
- Clean, uncluttered UI that separates advance payments from actual royalties
