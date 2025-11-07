# Payment Request & Invoice System - Setup Guide

## Overview

This system allows artists to request payouts when their balance reaches €100 or more, and admins to approve/reject these requests. The system automatically generates PDF invoices/receipts with editable contact details.

## Database Setup

### 1. Run the Migration Script

Run the SQL migration script in your Supabase SQL Editor:

```sql
-- Run: payment-request-invoice-system-migration.sql
```

This script will:
- Add `is_paid` column to `royalties` table
- Create/update `payment_requests` table
- Create/update `invoices` table with `file_url` and `invoice_number`
- Create `invoice_settings` table
- Create database functions:
  - `get_unpaid_royalties_total(artist_uuid)` - Returns sum of unpaid royalties
  - `mark_royalties_as_paid(artist_uuid)` - Marks all unpaid royalties as paid
  - `restore_royalties_on_rejection(request_uuid)` - Restores royalties when request is rejected

### 2. Create Supabase Storage Bucket

Create a storage bucket named `invoices` in Supabase:

1. Go to Supabase Dashboard → Storage
2. Click "New bucket"
3. Name: `invoices`
4. Public: Yes (or configure RLS policies)
5. Click "Create bucket"

## Features

### Artist Side

1. **Payment Request Page** (`/artist/payment-request`)
   - Shows current unpaid balance
   - Button enabled when balance ≥ €100
   - Confirmation modal before submitting
   - Prevents multiple pending requests

2. **Payment Request Flow**:
   - Fetches unpaid royalties total
   - Validates balance ≥ €100
   - Creates payment request
   - Marks royalties as paid
   - Generates PDF invoice automatically
   - Uploads PDF to storage
   - Creates invoice record

3. **My Payments Page** (`/artist/payments`)
   - View all payment requests
   - View/download invoices

### Admin Side

1. **Payment Requests Page** (`/admin/payment-requests`)
   - View all payment requests
   - View PDF invoices
   - Approve/Reject requests
   - When approved: Generates new PDF with "Approved" status
   - When rejected: Restores royalties using `restore_royalties_on_rejection()`

2. **Invoice Settings Page** (`/admin/invoice-settings`)
   - Edit phone and email only
   - Business name, address, and TAX ID are fixed
   - Changes apply to all future invoices

## Invoice PDF Design

- **Background**: White (#FFFFFF)
- **Text**: Dark gray (#222222)
- **Font**: Helvetica (Inter-like)
- **Status Badges**:
  - Pending: #9CA3AF
  - Approved: #10B981
  - Rejected: #EF4444
- **Layout**: Two-column (Business Info | Invoice Details)
- **Invoice Number Format**: `INV-[YEAR]-[AUTO_ID]`

## API Routes

### Artist Routes

- `POST /api/payment/request` - Create payment request
  - Body: `{ artist_id: string }`
  - Returns: `{ success: boolean, payment_request: {...}, invoice_number: string }`

### Admin Routes

- `GET /api/admin/payment-requests` - Get all payment requests
- `POST /api/admin/payment-requests` - Approve/Reject request
  - Body: `{ id: string, status: "approved" | "rejected", remarks?: string }`
- `GET /api/invoices?payment_request_id=xxx` - Get invoice by payment request ID
- `GET /api/invoice-settings` - Get invoice settings
- `PUT /api/invoice-settings` - Update invoice settings (phone/email only)
  - Body: `{ phone: string, email: string }`

## Navigation

### Artist Navigation
- Royalties → "Request Payment" button
- Sidebar: "Payment Request" link
- Sidebar: "My Payments" link

### Admin Navigation
- Sidebar: "Payment Requests" link
- Sidebar: "Invoice Settings" link

## Database Functions

### get_unpaid_royalties_total(artist_uuid)

Returns the sum of all unpaid royalties for an artist.

```sql
SELECT get_unpaid_royalties_total('artist-uuid-here');
```

### mark_royalties_as_paid(artist_uuid)

Marks all unpaid royalties as paid for an artist.

```sql
SELECT mark_royalties_as_paid('artist-uuid-here');
```

### restore_royalties_on_rejection(request_uuid)

Restores royalties when a payment request is rejected.

```sql
SELECT restore_royalties_on_rejection('request-uuid-here');
```

## Testing

1. **Test Artist Flow**:
   - Login as artist
   - Go to `/artist/payment-request`
   - Check balance (should show unpaid royalties)
   - If balance ≥ €100, click "Request Payment"
   - Confirm in modal
   - Check that balance resets to €0
   - Check that invoice PDF is generated

2. **Test Admin Flow**:
   - Login as admin
   - Go to `/admin/payment-requests`
   - View pending requests
   - Click "View PDF" to see invoice
   - Click "Approve" or "Reject"
   - Verify PDF is regenerated on approve
   - Verify royalties are restored on reject

3. **Test Invoice Settings**:
   - Login as admin
   - Go to `/admin/invoice-settings`
   - Update phone and email
   - Verify only these fields are editable
   - Create new payment request and verify new settings appear in PDF

## Troubleshooting

### PDF Not Generating

- Check browser console for errors
- Verify `jspdf` is installed: `npm install jspdf`
- Check that invoice settings exist in database

### Storage Upload Failing

- Verify `invoices` bucket exists in Supabase
- Check bucket permissions (should be public or have RLS policies)
- Verify service role key has storage access

### Balance Not Resetting

- Check that `mark_royalties_as_paid()` function exists
- Verify function is called in API route
- Check database logs for errors

### Royalties Not Restored on Reject

- Check that `restore_royalties_on_rejection()` function exists
- Verify function is called in admin API route
- Check that payment request has correct `artist_id`

## Notes

- Artists can only have one pending/approved request at a time
- Balance must be ≥ €100 to request payment
- PDFs are stored in Supabase Storage under `invoices/{artist_id}/{invoice_number}.pdf`
- Invoice numbers follow format: `INV-{YEAR}-{AUTO_ID}`
- Only phone and email can be edited in invoice settings
- Business name, address, and TAX ID are fixed

