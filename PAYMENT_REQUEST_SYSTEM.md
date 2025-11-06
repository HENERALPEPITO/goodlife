# Payment Request System - Implementation Guide

## Overview

The Payment Request System allows artists to request payouts when their royalty balance exceeds €100. The system ensures only one pending/approved request exists at a time and automatically manages balance tracking.

## Features

### Artist Features
- ✅ View current unpaid royalty balance
- ✅ Request payment when balance ≥ €100
- ✅ Only one pending/approved request at a time
- ✅ Confirmation modal before submitting
- ✅ Automatic balance reset to €0 on submission
- ✅ Disabled button when conditions not met

### Admin Features
- ✅ View all payment requests
- ✅ Approve payment requests (creates invoice)
- ✅ Reject payment requests (restores balance)
- ✅ Filter by status
- ✅ View artist information

## Database Schema

### 1. Add `is_paid` column to `royalties` table
```sql
ALTER TABLE royalties ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_royalties_is_paid ON royalties(is_paid);
CREATE INDEX IF NOT EXISTS idx_royalties_artist_id_is_paid ON royalties(artist_id, is_paid);
```

### 2. Ensure `payment_requests` table structure
```sql
CREATE TABLE IF NOT EXISTS payment_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3. Add `payment_request_id` to `invoices` table (if needed)
```sql
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_request_id UUID REFERENCES payment_requests(id);
```

## Setup Instructions

### Step 1: Run Database Migration
Execute `payment-request-system-schema.sql` in Supabase SQL Editor:
- Adds `is_paid` column to royalties
- Creates indexes for performance
- Ensures payment_requests table structure
- Creates helper functions (optional)

### Step 2: Verify Installation
1. Navigate to Artist Dashboard
2. Check that "Current Balance" card appears
3. Verify "Request Payment" button is disabled if balance < €100
4. As admin, navigate to `/admin/payment-requests`

## User Flow

### Artist Requesting Payment

1. **Check Balance**
   - Artist views dashboard
   - Sees current unpaid balance in "Current Balance" card
   - Button shows tooltip if disabled

2. **Request Payment** (if balance ≥ €100 and no pending request)
   - Click "Request Payment" button
   - Confirmation modal appears:
     ```
     Are you sure you want to request a payout of €[BALANCE]?
     This will reset your balance to €0 once submitted.
     ```
   - Click "✅ Confirm Request"

3. **System Processing**
   - Creates `payment_request` record with status 'pending'
   - Marks all unpaid royalties as `is_paid = true`
   - Resets displayed balance to €0
   - Disables "Request Payment" button

4. **Waiting for Admin**
   - Artist sees pending request notification
   - Cannot create new request until current one is resolved

### Admin Approval/Rejection

1. **View Requests**
   - Navigate to `/admin/payment-requests`
   - See all requests in table with filters

2. **Approve Request**
   - Click "Approve" button
   - Add optional remarks
   - System:
     - Updates request status to 'approved'
     - Creates invoice record
     - Balance remains at €0 (royalties already marked as paid)

3. **Reject Request**
   - Click "Reject" button
   - Add optional remarks
   - System:
     - Updates request status to 'rejected'
     - Marks royalties as `is_paid = false` (restores balance)
     - Artist can request payment again

## API Endpoints

### POST `/api/payment/request`
Creates a new payment request for the authenticated artist.

**Request:**
```json
{
  "amount": 150.00
}
```

**Response:**
```json
{
  "success": true,
  "paymentRequest": {
    "id": "uuid",
    "total_amount": 150.00,
    "amount": 150.00,
    "royalty_count": 25
  }
}
```

**Validation:**
- Balance must be ≥ €100
- No existing pending/approved request
- Artist must be authenticated

### GET `/api/admin/payment-requests`
Fetches all payment requests (admin only).

**Query Parameters:**
- `status`: Filter by status (pending, approved, rejected)
- `artist_id`: Filter by artist

**Response:**
```json
{
  "success": true,
  "paymentRequests": [
    {
      "id": "uuid",
      "artist_id": "uuid",
      "artist_email": "artist@example.com",
      "total_amount": 150.00,
      "status": "pending",
      "royalty_count": 25,
      "created_at": "2024-01-01T00:00:00Z",
      "approved_by_email": null
    }
  ]
}
```

### POST `/api/admin/payment-requests`
Updates payment request status (admin only).

**Request:**
```json
{
  "id": "uuid",
  "status": "approved",
  "remarks": "Optional remarks"
}
```

**Response:**
```json
{
  "success": true,
  "paymentRequest": { ... }
}
```

## Components

### PaymentRequestCard.tsx
- Displays current balance
- Shows "Request Payment" button
- Handles disabled state and tooltips
- Opens confirmation modal

### PaymentRequestConfirmationModal.tsx
- Confirmation dialog
- Shows balance amount
- Confirm/Cancel buttons

### AdminPaymentRequestsPage
- Table view of all requests
- Filter by status
- Approve/Reject actions
- View invoice link

## Error Handling

### Common Errors

1. **Balance < €100**
   - Button disabled with tooltip
   - Message: "Minimum payout is €100. You currently have €[balance]."

2. **Existing Pending Request**
   - Button disabled with tooltip
   - Message: "You already have a pending payment request."

3. **API Errors**
   - Toast notifications
   - Error messages displayed to user
   - Console logging for debugging

## Testing Checklist

- [ ] Artist with balance < €100 cannot request payment
- [ ] Artist with balance ≥ €100 can request payment
- [ ] Confirmation modal appears before submission
- [ ] Balance resets to €0 after request
- [ ] Button disabled after request submission
- [ ] Cannot create second request while first is pending
- [ ] Admin can view all requests
- [ ] Admin can approve request (creates invoice)
- [ ] Admin can reject request (restores balance)
- [ ] Rejected requests restore artist balance
- [ ] Invoice created on approval

## Design Specifications

### Colors
- Primary: #2563EB (blue)
- Background: #FFFFFF
- Text: #111111
- Approve: #22C55E (green)
- Reject: #EF4444 (red)

### Typography
- Font: Inter / SF Pro Display
- Numbers: Bold (text-lg or text-xl)
- Modals: Rounded-xl with drop shadow

### Layout
- Clean minimalist design
- White background
- Soft gray dividers
- Grid/flexbox alignment

