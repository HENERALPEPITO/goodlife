# Exclude Advance Payments from Analytics & Dashboard

## Summary
Updated the backend logic to exclude advance payment records from all artist analytics and dashboard views. This ensures that advance payments (which are treated as negative royalties) do not skew performance metrics or appear as regular royalty statements.

## Changes Made

### 1. Database Functions (RPCs) Updated (`supabase/migrations/20260217_exclude_advance_payments_from_analytics.sql`)

New migration created to update the following functions:

*   `get_artist_available_quarters`: Excludes quarters that contain *only* advance payments (or filters advance payments out of the totals for a quarter).
    *   Added `WHERE top_platform != 'Advance Payment'`
*   `get_artist_dashboard_overview`: Excludes advance payments from Total Earnings, Total Streams, Total Tracks, and Platform/Territory distributions.
    *   Added `WHERE top_platform != 'Advance Payment'` to all aggregations.
*   `get_artist_quarterly_trends`: Excludes advance payments from trend data (charts).
    *   Added `WHERE top_platform != 'Advance Payment'`
*   `get_artist_top_tracks`: Excludes the "Advance Payment" track from the top tracks list.
    *   Added `WHERE top_platform != 'Advance Payment'`
*   `get_artist_royalties_summary`: Excludes advance payment records from detailed royalty lists.
    *   Added `WHERE top_platform != 'Advance Payment'`
*   `get_admin_royalties_totals`: Excludes advance payments from admin dashboard totals.
    *   Added `WHERE top_platform != 'Advance Payment'`

### 2. API Route Updated (`src/app/api/data/royalties-summary/route.ts`)

*   Updated the `case 'summary'` block which handles direct queries for the detailed view of a specific quarter.
*   Added `.neq('top_platform', 'Advance Payment')` to the Supabase query.

## Impact

*   **Artist Dashboard:**
    *   "Available Statements" list will NOT show quarters that contain only an advance payment.
    *   "Total Earnings" and other overview metrics will reflect actual royalties earned, not net balance after advance.
    *   Charts (Trends, Top Tracks) will show performance based on actual streams/sales.
*   **Detailed View:**
    *   When viewing a quarter that *does* have both regular royalties and an advance payment (if that were possible/displayed), the advance payment record would be hidden from the list.
*   **Admin Dashboard:**
    *   Global totals will exclude advance payment amounts.

All modifications rely on `top_platform = 'Advance Payment'` (or `exploitation_source_name` mapping to it) as the filter criteria, which allows the Advance Payment Balance to be tracked separately (via the `artists.advance_payment` field and the separate Balance API) without polluting the content analytics.
