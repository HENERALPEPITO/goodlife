# Payment Request + Invoice System Implementation

## Overview

A complete payment request and invoice system for the Good Life Music platform. Invoices are automatically generated as receipts when artists request payment. Admins can view, approve, or reject payment requests but cannot manually create invoices.

## Features Implemented

### 🎤 Artist Side

1. **Request Payment Button**
   - Only visible when:
     - Artist's total unpaid royalties ≥ €100
     - Artist has no existing pending or approved request
   - Location: Artist Dashboard (`/`)

2. **Payment Request Flow**
   - Click "Request Payment" button
   - Confirmation modal appears: "Are you sure you want to request payment? This will request your full unpaid amount and reset your balance to €0."
   - On confirmation:
     - Creates payment request record with status 'pending'
     - Marks all unpaid royalties as paid (balance resets to €0)
     - Automatically generates minimalist invoice PDF
     - Saves PDF to Supabase Storage (`/storage/invoices/`)
     - Links invoice to payment request

3. **Invoice Viewing**
   - Artists can view all their invoices in the "Invoices" section (`/invoices`)
   - Each invoice has a "View PDF" button
   - PDFs can be viewed in browser or downloaded
   - Invoices are read-only (not editable)

4. **Balance Management**
   - If admin rejects a request, royalties are automatically restored to artist's balance
   - Artist cannot request another payment until previous request is resolved

### 🧑‍💼 Admin Side

1. **Payment Requests Dashboard**
   - Location: `/admin/payment-requests`
   - Displays all payment requests with:
     - Artist Name
     - Requested Amount (€)
     - Date
     - Status (Pending / Approved / Rejected)
     - Actions: "Approve", "Reject", "View Invoice"

2. **Admin Actions**
   - **Approve**: Sets status to 'approved'
   - **Reject**: Sets status to 'rejected' and restores royalties via `restore_royalties_on_rejection(request_id)`
   - **View Invoice**: Opens the PDF invoice in a new tab

3. **Invoice Settings Management**
   - Location: `/admin/invoice-settings`
   - Admins can edit global invoice business details:
     - Business Name
     - Address
     - Contact Person (optional)
     - Phone Number
     - Email Address
     - TAX ID
   - Changes apply to all future invoices
   - Default values are pre-populated

4. **Invoice Creation**
   - Admins **cannot** manually create invoices
   - All invoices are automatically generated when artists request payment
   - Each invoice acts as a receipt showing payment details

### 🧾 Invoice Design (Auto-generated PDF)

- **Minimalist white background**, clean layout
- **Good Life Music** logo at top center (if available)
- Text: black and gray tones with subtle dividers
- Fields shown:
  - Invoice Number: `INV-[YEAR]-[AUTO_ID]`
  - Invoice Date: Date of Request
  - Artist Name: Artist Full Name
  - Artist Email: Artist Email
  - Total Amount: € Amount (no unit price breakdown)
  - Payment Mode: Bank Transfer
  - Status: Pending / Approved / Rejected
  - Business Info from `invoice_settings` table:
    - Business Name
    - Address
    - Phone
    - Email
    - TAX ID
- Footer: "Generated automatically by Good Life Music Portal – Receipt for Payment Request"

## Database Structure

### Tables

1. **payment_requests**
   ```sql
   - id (UUID, PRIMARY KEY)
   - artist_id (UUID, REFERENCES artists(id))
   - amount (NUMERIC(10,2))
   - status (TEXT: 'pending' | 'approved' | 'rejected')
   - pdf_url (TEXT, nullable)
   - created_at (TIMESTAMP)
   - updated_at (TIMESTAMP)
   ```

2. **invoice_settings**
   ```sql
   - id (UUID, PRIMARY KEY)
   - business_name (TEXT)
   - address (TEXT)
   - contact_person (TEXT, nullable)
   - phone (TEXT)
   - email (TEXT)
   - tax_id (TEXT)
   - updated_at (TIMESTAMP)
   - updated_by (UUID, REFERENCES auth.users(id))
   ```

3. **invoices**
   ```sql
   - id (UUID, PRIMARY KEY)
   - artist_id (UUID, REFERENCES artists(id))
   - payment_request_id (UUID, REFERENCES payment_requests(id))
   - invoice_number (TEXT, UNIQUE)
   - amount (NUMERIC(12,2))
   - pdf_url (TEXT, nullable)
   - status (TEXT: 'pending' | 'approved' | 'paid' | 'rejected')
   - mode_of_payment (TEXT)
   - created_at (TIMESTAMP)
   - updated_at (TIMESTAMP)
   ```

4. **royalties** (updated)
   ```sql
   - is_paid (BOOLEAN, DEFAULT FALSE) -- Added column
   ```

### Database Functions

1. **get_unpaid_royalties_total(artist_uuid UUID)**
   - Returns total unpaid royalties for an artist

2. **mark_royalties_as_paid(artist_uuid UUID)**
   - Marks all unpaid royalties as paid for an artist
   - Returns count of updated rows

3. **restore_royalties_on_rejection(request_uuid UUID)**
   - Restores royalties to unpaid status when payment request is rejected
   - Returns count of updated rows

## Setup Instructions

### 1. Run Database Migration

Execute the SQL migration file in your Supabase SQL Editor:

```bash
goodlife/payment-invoice-system-migration.sql
```

This will:
- Create/update `payment_requests` table
- Create `invoice_settings` table with default values
- Add `is_paid` column to `royalties` table
- Add `pdf_url` and `payment_request_id` columns to `invoices` table
- Create all required database functions
- Set up indexes for performance

### 2. Create Supabase Storage Bucket

Create a storage bucket named `invoices` in Supabase:

1. Go to Supabase Dashboard → Storage
2. Create new bucket: `invoices`
3. Set bucket to **Public** (or configure RLS policies as needed)
4. Set allowed MIME types: `application/pdf`

### 3. Verify Environment Variables

Ensure these are set in your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 4. Default Invoice Settings

The `invoice_settings` table is pre-populated with:

- **Business Name**: Good Life Music S.L
- **Address**: Profesor Hermida 6, 3-3C, 36960 Sanxenxo (Spain)
- **Phone**: +34 693 43 25 06
- **Email**: info@goodlifemusic.com
- **TAX ID**: B72510704

Admins can update these via `/admin/invoice-settings`.

## API Endpoints

### Artist Payment Request

**POST** `/api/payment/request`
- Creates payment request and auto-generates invoice
- Requires authentication
- Returns payment request details and invoice info

### Admin Payment Requests

**GET** `/api/admin/payment-requests?status={status}`
- Fetches all payment requests (filtered by status if provided)
- Admin only

**POST** `/api/admin/payment-requests`
- Updates payment request status (approve/reject)
- Body: `{ id, status, remarks? }`
- Admin only
- Automatically restores royalties if rejected

### Invoice Settings

**GET** `/api/invoice-settings`
- Fetches current invoice settings
- Admin only

**PUT** `/api/invoice-settings`
- Updates invoice settings
- Body: `{ business_name, address, contact_person?, phone, email, tax_id }`
- Admin only

### Invoices

**GET** `/api/invoices-simple?payment_request_id={id}`
- Fetches invoices (filtered by payment_request_id if provided)
- Artists see only their own invoices
- Admins see all invoices

## File Structure

```
goodlife/
├── payment-invoice-system-migration.sql     # Database migration
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── payment/
│   │   │   │   └── request/route.ts        # Payment request API
│   │   │   ├── admin/
│   │   │   │   └── payment-requests/       # Admin payment requests API
│   │   │   └── invoice-settings/           # Invoice settings API
│   │   ├── admin/
│   │   │   ├── payment-requests/page.tsx   # Admin payment requests dashboard
│   │   │   └── invoice-settings/page.tsx   # Invoice settings page
│   │   └── invoices/page.tsx               # Artist invoices page
│   ├── components/
│   │   ├── PaymentRequestCard.tsx          # Artist payment request button
│   │   ├── PaymentRequestConfirmationModal.tsx
│   │   ├── PaymentRequestInvoicePDF.tsx    # PDF invoice generator
│   │   └── ArtistInvoices.tsx              # Artist invoices list
│   └── lib/
│       ├── invoiceSettings.ts              # Invoice settings utilities
│       └── supabaseAdmin.ts                # Supabase admin client
```

## Usage Flow

### Artist Requesting Payment

1. Artist navigates to dashboard
2. Sees "Request Payment" button if balance ≥ €100 and no pending requests
3. Clicks button → confirmation modal appears
4. Confirms → payment request created
5. Balance resets to €0
6. Invoice PDF automatically generated and saved
7. Invoice appears in "Invoices" section

### Admin Managing Requests

1. Admin navigates to `/admin/payment-requests`
2. Sees all payment requests with status
3. Can click "View Invoice" to see PDF
4. Can click "Approve" or "Reject"
5. If rejected, royalties are restored to artist's balance
6. If approved, invoice status updates

### Admin Updating Invoice Settings

1. Admin navigates to `/admin/invoice-settings`
2. Updates business information
3. Saves → changes apply to all future invoices
4. Existing invoices remain unchanged

## Testing Checklist

- [ ] Artist can request payment when balance ≥ €100
- [ ] Artist cannot request payment when balance < €100
- [ ] Artist cannot request payment if pending/approved request exists
- [ ] Invoice PDF is generated automatically on payment request
- [ ] Invoice PDF is saved to Supabase Storage
- [ ] Artist can view invoices in `/invoices`
- [ ] Artist can view/download invoice PDFs
- [ ] Admin can view all payment requests
- [ ] Admin can approve payment requests
- [ ] Admin can reject payment requests
- [ ] Rejected requests restore royalties to artist balance
- [ ] Admin can view invoice PDFs
- [ ] Admin can update invoice settings
- [ ] Invoice settings apply to new invoices
- [ ] Balance calculation uses unpaid royalties only

## Notes

- All invoices are automatically generated (no manual creation)
- Invoices are read-only (not editable)
- PDFs are stored in Supabase Storage bucket `invoices`
- Invoice numbers follow format: `INV-[YEAR]-[AUTO_ID]`
- Default minimum payout: €100 (configurable in `PaymentRequestCard.tsx`)
- All monetary values use € (EUR)

## Troubleshooting

### PDF Not Generating

1. Check Supabase Storage bucket `invoices` exists and is accessible
2. Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly
3. Check browser console for errors
4. Verify `jsPDF` package is installed

### Royalties Not Restoring on Rejection

1. Verify `restore_royalties_on_rejection` function exists in database
2. Check function is called correctly in admin API route
3. Verify `payment_request_id` foreign key relationship

### Invoice Settings Not Saving

1. Verify admin authentication
2. Check `invoice_settings` table exists
3. Verify all required fields are provided
4. Check database logs for errors



