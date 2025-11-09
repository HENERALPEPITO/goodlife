# Payment Request & Invoice System - Complete Implementation

## Overview

A complete payment request and invoice system where artists can request payments (minimum €100), and admins can approve/reject them. Invoices are automatically generated as PDF receipts when payment requests are created.

## Features

### Artist Features
- ✅ Request payment only once (if balance ≥ €100)
- ✅ Confirmation modal before submitting
- ✅ Automatic invoice generation on payment request
- ✅ View/download invoices (read-only)
- ✅ Balance resets to €0 after request
- ✅ Balance restored if request is rejected

### Admin Features
- ✅ View all payment requests
- ✅ Approve/reject payment requests
- ✅ View/download invoices for any artist
- ✅ Edit invoice business settings (globally)
- ✅ Settings apply to all future invoices

## Database Schema

### New Tables & Columns

1. **invoice_settings** table:
   - Stores admin-editable business information
   - Single row (global settings)
   - Fields: business_name, address, phone, email, tax_id

2. **invoices** table:
   - Added `payment_request_id` column (links invoice to payment request)

3. **royalties** table:
   - Added `is_paid` column (tracks if royalty has been paid)

Run `payment-request-system-schema.sql` to set up the database.

## Setup Instructions

### Step 1: Run Database Migration
Execute `payment-request-system-schema.sql` in Supabase SQL Editor.

### Step 2: Configure Invoice Settings (Admin)
1. Navigate to `/admin/invoice-settings`
2. Update business information:
   - Business Name
   - Address
   - Phone Number
   - Email Address
   - TAX ID
3. Click "Save Settings"

### Step 3: Test the Flow
1. **As Artist:**
   - Ensure balance ≥ €100
   - Click "Request Payment"
   - Confirm in modal
   - Check Invoices section for generated invoice

2. **As Admin:**
   - View payment requests at `/admin/payment-requests`
   - Click "View Invoice" to see PDF
   - Approve or reject requests

## Invoice PDF Design

The invoice PDF includes:
- **Header:** "INVOICE" with invoice number and date
- **Business Info:** From admin settings (editable)
- **Artist Info:** Name and email
- **Invoice Details:** 
  - Payment Mode: Bank Transfer
  - Status: Pending/Approved/Rejected
- **Total Amount:** Large, bold format
- **Footer:** "Generated automatically by Good Life Music Portal"

## API Endpoints

### POST `/api/payment/request`
Creates payment request and auto-generates invoice.

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
    "royalty_count": 25
  },
  "invoice": {
    "invoice_number": "INV-2025-001",
    "invoice_ref": "ABC12345"
  }
}
```

### GET `/api/invoice-settings`
Gets current invoice business settings.

**Response:**
```json
{
  "success": true,
  "settings": {
    "business_name": "Good Life Music S.L",
    "address": "Profesor Hermida 6, 3-3C, 36960 Sanxenxo (Spain)",
    "phone": "+34 693 43 25 06",
    "email": "info@goodlifemusic.com",
    "tax_id": "B72510704"
  }
}
```

### PUT `/api/invoice-settings`
Updates invoice business settings (admin only).

**Request:**
```json
{
  "business_name": "Good Life Music S.L",
  "address": "Profesor Hermida 6, 3-3C, 36960 Sanxenxo (Spain)",
  "phone": "+34 693 43 25 06",
  "email": "info@goodlifemusic.com",
  "tax_id": "B72510704"
}
```

## Components

### PaymentRequestCard.tsx
- Displays current balance
- Handles payment request creation
- Shows confirmation modal
- Uses API route for request creation

### PaymentRequestInvoicePDF.tsx
- Generates minimalist invoice PDFs
- Uses admin-editable business settings
- Includes all required invoice fields

### InvoiceManagement.tsx
- Lists all invoices (artist's own or all for admin)
- Supports PDF download for payment request invoices
- Uses PaymentRequestInvoicePDF for payment request invoices

### AdminInvoiceSettingsPage
- Admin-only page for editing business info
- Settings apply globally to all future invoices

## User Flow

### Artist Requesting Payment

1. Artist views dashboard
2. Sees current balance in PaymentRequestCard
3. Clicks "Request Payment" (if balance ≥ €100)
4. Confirmation modal appears
5. Artist confirms
6. System:
   - Creates payment_request record
   - Marks royalties as paid
   - Auto-generates invoice
   - Resets balance to €0
7. Invoice appears in Invoices section
8. Artist can view/download invoice (read-only)

### Admin Managing Requests

1. Admin views `/admin/payment-requests`
2. Sees all payment requests
3. Clicks "View Invoice" to preview PDF
4. Approves or rejects request
5. On approval:
   - Invoice status updated
   - Balance remains at €0
6. On rejection:
   - Balance restored to artist
   - Invoice status updated

### Admin Editing Invoice Settings

1. Admin navigates to `/admin/invoice-settings`
2. Edits business information
3. Saves settings
4. All future invoices use new settings

## File Structure

```
src/
├── components/
│   ├── PaymentRequestCard.tsx          # Artist payment request UI
│   ├── PaymentRequestConfirmationModal.tsx  # Confirmation dialog
│   ├── PaymentRequestInvoicePDF.tsx    # PDF generator for payment request invoices
│   ├── InvoiceManagement.tsx           # Invoice list & management
│   └── InvoiceForm.tsx                 # Invoice creation/edit form
├── app/
│   ├── api/
│   │   ├── payment/
│   │   │   └── request/route.ts        # Payment request API
│   │   ├── invoice-settings/route.ts   # Invoice settings API
│   │   └── invoices-simple/route.ts    # Invoices API (updated)
│   └── admin/
│       ├── payment-requests/page.tsx   # Admin payment requests page
│       └── invoice-settings/page.tsx   # Admin invoice settings page
└── lib/
    └── invoiceSettings.ts              # Invoice settings utilities
```

## Testing Checklist

- [ ] Artist can request payment when balance ≥ €100
- [ ] Confirmation modal appears before submission
- [ ] Invoice is auto-generated on payment request
- [ ] Invoice appears in Invoices section
- [ ] Artist can view/download invoice
- [ ] Artist cannot edit invoice
- [ ] Balance resets to €0 after request
- [ ] Admin can view all payment requests
- [ ] Admin can view invoice PDF
- [ ] Admin can approve/reject requests
- [ ] Balance restored on rejection
- [ ] Admin can edit invoice settings
- [ ] Settings apply to new invoices

## Notes

- Invoices are automatically generated when payment requests are created
- Invoice settings are global and apply to all future invoices
- Existing invoices are not affected by setting changes
- Payment request invoices use the minimalist design with admin-editable business info
- Regular invoices (created manually) use the original InvoicePDF format


