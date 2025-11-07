# Simplified Invoice System

## Overview

A streamlined invoice system linked to payment requests. When an artist requests payment, an invoice is automatically generated. The invoice is simplified - no line items, just a total amount, artist details, and payment information.

## Features

### Artist Features
- ✅ **Request Payment** - Creates payment request and auto-generates invoice
- ✅ **View Invoices** - See all invoices linked to their payment requests
- ✅ **Download PDF** - Export invoices as PDF
- ✅ **Read-only Access** - Cannot modify invoice data

### Admin Features
- ✅ **View All Invoices** - See all invoices from all artists
- ✅ **Edit Invoice** - Modify artist info, address, email, phone, total amount, payment method, notes
- ✅ **Approve/Reject** - Approve or reject invoice requests
- ✅ **Export PDF** - Download invoices as PDF
- ✅ **Preview PDF** - Preview before saving changes

## Database Setup

Run the migration file to set up the database schema:

```sql
-- Run this in your Supabase SQL Editor
-- File: simplified-invoice-migration.sql
```

This creates:
- Simplified `invoices` table linked to `payment_requests`
- Auto-generation trigger when payment request is created
- Status sync trigger when payment request status changes
- Proper RLS policies for security

## Workflow

### 1. Artist Requests Payment

1. Artist navigates to Royalties → clicks "Request Payment"
2. Payment request is created in `payment_requests` table
3. **Invoice is automatically generated** via database trigger
4. Invoice defaults:
   - Status: `pending`
   - Total: matches requested amount
   - Artist details: auto-filled from `user_profiles`
   - Invoice number: auto-generated (INV-YYYY-####)

### 2. Admin Reviews Invoice

1. Admin opens "Invoices" tab
2. Sees list of all invoices (Pending / Approved / Rejected)
3. Can click "Edit" to modify:
   - Artist name
   - Artist address
   - Contact email
   - Contact phone
   - Total amount (editable before approval)
   - Payment method
   - Payment instructions / notes
4. Can preview PDF before saving
5. Can approve or reject invoice

### 3. Artist Views Invoice

1. Artist opens "Invoices" tab
2. Sees only their invoices
3. Can preview or download PDF
4. Cannot edit any information

## PDF Layout

The simplified invoice PDF includes:

**Header:**
- Logo (top-left)
- Company info (top-right):
  - Good Life Music S.L
  - Profesor Hermida 6, 3-3C
  - 36960 Sanxenxo (Spain)
  - TAX ID: B72510704

**Body:**
- **Invoice To:** Artist name, address, email, contact number
- **Invoice Details:** Invoice reference, date, payment status
- **Totals Section:** Total amount (bold, centered, large font)
- **Payment Instructions:** (if provided)

**Footer:**
- "Thank you for working with Good Life Music S.L."
- Light gray divider above footer

## API Endpoints

### GET `/api/invoices-simple`
Fetch all invoices (admin) or user's invoices (artist)

### GET `/api/invoices-simple/[id]`
Fetch a specific invoice by ID

### PUT `/api/invoices-simple/[id]`
Update an invoice (admin only, pending invoices only)

**Request Body:**
```json
{
  "artist_name": "John Doe",
  "artist_address": "123 Main St\nCity, State 12345",
  "artist_email": "john@example.com",
  "artist_phone": "+1234567890",
  "total_amount": 500.00,
  "payment_method": "Bank Transfer",
  "notes": "Payment terms: Net 30 days"
}
```

### POST `/api/invoices-simple/[id]/approve`
Approve an invoice (admin only)

### POST `/api/invoices-simple/[id]/reject`
Reject an invoice (admin only)

## Component Structure

### `SimpleInvoiceManager.tsx`
Main component handling both admin and artist views. Automatically adjusts based on user role.

### `SimpleInvoicePDF.tsx`
PDF generation utilities with `generateInvoice()`, `downloadInvoice()`, and `previewInvoice()` methods.

## Security

- Row Level Security (RLS) policies ensure:
  - Artists can only view their own invoices
  - Admins can view and manage all invoices
  - Only admins can edit, approve, or reject invoices
  - Proper authentication required for all operations

## Design System

- **Layout:** Light gray sidebar (#F3F4F6), white background (#FFFFFF)
- **Text:** Black (#111111)
- **Accent:** Royal blue (#2563EB) for buttons and highlights
- **Borders:** Soft light gray (#E5E7EB)
- **Fonts:** Inter or SF Pro Display (Helvetica used in PDF)
- **Buttons:** Rounded corners (rounded-2xl), soft shadows

## File Structure

```
goodlife/
├── simplified-invoice-migration.sql    # Database migration
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── invoices-simple/
│   │   │   │   ├── route.ts              # GET /api/invoices-simple
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts          # GET, PUT /api/invoices-simple/[id]
│   │   │   │       ├── approve/route.ts  # POST /api/invoices-simple/[id]/approve
│   │   │   │       └── reject/route.ts   # POST /api/invoices-simple/[id]/reject
│   │   │   └── payment/
│   │   │       └── request/route.ts      # Updated to verify invoice creation
│   │   └── invoices/
│   │       └── page.tsx                   # Invoice management page
│   └── components/
│       ├── SimpleInvoiceManager.tsx      # Main invoice component
│       └── SimpleInvoicePDF.tsx           # PDF generation
```

## Next Steps

1. Run the database migration in Supabase SQL Editor
2. Test payment request creation (should auto-generate invoice)
3. Test admin invoice editing and approval
4. Test artist invoice viewing and PDF download
5. Verify PDF generation matches brand requirements

## Notes

- Invoices are auto-generated when payment requests are created
- Invoice status syncs with payment request status
- Only pending invoices can be edited
- Approved/rejected invoices are read-only
- PDF generation uses the same minimalist design for consistency








