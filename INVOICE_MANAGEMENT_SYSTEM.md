# Invoice Management System

## Overview

A complete invoice management system with full CRUD operations for admins and read-only access for artists. The system generates clean, minimalist PDF invoices matching the Good Life Music S.L. brand.

## Features

### Admin Features
- ✅ **Create Invoices** - Full form with all invoice fields
- ✅ **Edit Invoices** - Modify any invoice field
- ✅ **Delete Invoices** - Remove invoices from the system
- ✅ **Preview PDF** - Real-time preview before saving
- ✅ **Export PDF** - Download invoices as PDF
- ✅ **Upload Logo** - Optional custom logo override
- ✅ **Line Items Management** - Add/remove/edit line items dynamically
- ✅ **Auto-calculate Totals** - Automatic subtotal, tax, and total calculations

### Artist Features
- ✅ **View Invoices** - See all invoices assigned to them
- ✅ **Download PDF** - Export invoices as PDF
- ✅ **Read-only Access** - Cannot modify any invoice data

## Database Setup

Run the migration file to set up the database schema:

```sql
-- Run this in your Supabase SQL Editor
-- File: invoice-management-migration.sql
```

This creates:
- Extended `invoices` table with new fields
- `invoice_line_items` table for invoice line items
- Proper RLS policies for security
- Triggers for automatic total calculations

## Usage

### Admin: Creating an Invoice

1. Navigate to `/invoices`
2. Click "Create Invoice"
3. Fill in the form:
   - Select artist from dropdown
   - Invoice number (auto-generated, editable)
   - Invoice date and due date
   - Recipient information (name, email, phone, address)
   - Add line items (description, quantity, unit price)
   - Set tax rate (optional)
   - Add notes/payment instructions
   - Upload logo (optional)
4. Click "Preview PDF" to see the result
5. Click "Save Changes" to create the invoice

### Admin: Editing an Invoice

1. Find the invoice in the list
2. Click the "Edit" button
3. Modify any fields
4. Preview or save changes

### Artist: Viewing Invoices

1. Navigate to `/invoices`
2. View all invoices assigned to you
3. Click "Preview" to view in browser
4. Click "Download PDF" to save as PDF

## API Endpoints

### GET `/api/invoices`
Fetch all invoices (admin) or user's invoices (artist)

### POST `/api/invoices`
Create a new invoice (admin only)

**Request Body:**
```json
{
  "artist_id": "uuid",
  "invoice_number": "INV-2025-001",
  "invoice_date": "2025-01-15T00:00:00Z",
  "due_date": "2025-02-15T00:00:00Z",
  "recipient_name": "John Doe",
  "recipient_email": "john@example.com",
  "recipient_phone": "+1234567890",
  "recipient_address": "123 Main St\nCity, State 12345",
  "tax_rate": 21,
  "currency": "€",
  "notes": "Payment terms: Net 30 days",
  "logo_url": "data:image/png;base64,...",
  "line_items": [
    {
      "description": "Music Licensing Fee",
      "quantity": 1,
      "unit_price": 500.00,
      "subtotal": 500.00
    }
  ]
}
```

### GET `/api/invoices/[id]`
Fetch a specific invoice by ID

### PUT `/api/invoices/[id]`
Update an invoice (admin only)

### DELETE `/api/invoices/[id]`
Delete an invoice (admin only)

## PDF Styling

The PDF generator creates invoices with:

- **Header**: Good Life Music logo (top-left), company info (top-right)
- **Company Info**:
  - Good Life Music S.L
  - Profesor Hermida 6, 3-3C
  - 36960 Sanxenxo (Spain)
  - TAX ID: B72510704
- **Invoice Details**: Invoice number, date, due date, recipient info
- **Table**: Description | Qty | Unit Price | Total
- **Totals**: Subtotal, tax (if applicable), total (aligned right)
- **Footer**: Optional notes/payment instructions

### Colors
- Background: #FFFFFF
- Text: #111111
- Accent: #2563EB (royal blue)
- Lines: #E5E7EB (soft light gray)
- Table Headers: #F9FAFB (light tint)

### Typography
- Font: Helvetica (similar to Inter/SF Pro Display)
- Body: 10-11pt
- Headings: 14-18pt

## Component Structure

### `InvoiceManager.tsx`
Main component handling both admin and artist views. Automatically adjusts based on user role.

### `PDFGenerator.tsx`
PDF generation utilities with `generateInvoice()`, `downloadInvoice()`, and `previewInvoice()` methods.

### `invoiceUtils.ts`
Utility functions for logo loading and invoice data conversion.

## Security

- Row Level Security (RLS) policies ensure:
  - Artists can only view their own invoices
  - Admins can view and manage all invoices
  - Proper authentication required for all operations

## File Structure

```
goodlife/
├── invoice-management-migration.sql    # Database migration
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── invoices/
│   │   │       ├── route.ts            # GET, POST /api/invoices
│   │   │       └── [id]/route.ts       # GET, PUT, DELETE /api/invoices/[id]
│   │   └── invoices/
│   │       └── page.tsx                 # Invoice management page
│   ├── components/
│   │   ├── InvoiceManager.tsx          # Main invoice component
│   │   └── PDFGenerator.tsx             # PDF generation
│   └── lib/
│       └── invoiceUtils.ts              # Invoice utilities
```

## Next Steps

1. Run the database migration in Supabase
2. Test creating an invoice as admin
3. Test viewing invoices as artist
4. Verify PDF generation matches brand requirements
5. (Optional) Set up logo storage in Supabase Storage for production

## Notes

- Logo uploads are currently stored as base64 data URLs. For production, consider uploading to Supabase Storage and storing the URL.
- Invoice numbers are auto-generated but can be manually edited.
- Tax calculations are automatic based on subtotal and tax rate.
- All totals are calculated automatically from line items.







