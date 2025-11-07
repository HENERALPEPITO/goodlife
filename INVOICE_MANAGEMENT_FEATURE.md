# Invoice Management Feature

## Overview

A complete invoice management system integrated into the GoodLife Music platform with support for admin and artist users.

## Features

### 1. Invoice Creation
- **Admin**: Can create invoices for any artist
- **Artist**: Can submit invoices with editable details
- Fixed address format: Calle 9 #86, Merida, 97136 Mexico
- Fixed invoice recipient: Lime Blue Music Limited, London

### 2. Invoice Layout
The invoice follows this exact format:

```
SUBMIT INVOICE

ARTIST NAME: [Dynamic Artist Name]

ADDRESS: Calle 9 #86
         Merida
         97136 Mexico

INVOICE TO:
Lime Blue Music Limited Ground Floor
161 Rosebery Avenue London
ECIR 4QX
United Kingdom

Invoice Item:
Statement #[Dynamic Statement No]: [Period] [Artist Name]

Totals:
TOTAL NET: [Dynamic Amount]

Pay Me By:
PAYMENT OPTIONS: [Bank / PayPal / Wise / etc.]

Invoice Ref: [Dynamic Reference Code]
Invoice Date: [Dynamic Date]
```

### 3. PDF Export
- Download as PDF button for each invoice
- Professional PDF format using jsPDF
- Preserves all layout styles and dynamic values
- PDF filename: `invoice-{invoice_ref}.pdf`

### 4. Search & Filter
- Search by:
  - Invoice reference code
  - Statement number
  - Artist name
  - Invoice number
- Filter by:
  - Status (Pending, Approved, Rejected)
  - Artist (Admin only)

### 5. Status Management
- **Pending**: Initial state for new invoices
- **Approved**: Admin approves the invoice
- **Rejected**: Admin rejects the invoice
- Only pending invoices can be edited/deleted

### 6. Permissions
- **Admin**:
  - View all invoices
  - Create invoices for any artist
  - Approve/reject invoices
  - Edit any pending invoice
  
- **Artist**:
  - View only their own invoices
  - Create invoices
  - Edit/delete their own pending invoices
  - Download PDFs of their invoices

## Database Schema

### invoices Table
```sql
- id: UUID (Primary Key)
- artist_id: UUID (References artists.id)
- artist_name: TEXT
- statement_number: TEXT
- period: TEXT
- total_net: NUMERIC(12,2)
- payment_options: TEXT
- invoice_ref: TEXT (Unique)
- invoice_number: TEXT (Unique)
- invoice_date: TIMESTAMP
- status: TEXT (pending, approved, rejected)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

## Setup Instructions

### 1. Run Database Migration
Execute the SQL migration script in Supabase SQL Editor:

```sql
-- Run: invoice-management-schema.sql
```

This will:
- Add new columns to the invoices table
- Create indexes for performance
- Create function to generate invoice references
- Fix foreign key constraints

### 2. Verify Installation
1. Navigate to `/invoices` page
2. As admin, you should see "Create Invoice" button
3. As artist, you can create invoices for yourself

## Usage

### Creating an Invoice (Artist)
1. Click "Create Invoice" button
2. Fill in required fields:
   - Artist Name (pre-filled)
   - Statement Number *
   - Period
   - Total NET *
   - Payment Options
   - Invoice Date
3. Click "Create Invoice"
4. Invoice is created with status "Pending"

### Creating an Invoice (Admin)
1. Click "Create Invoice" button
2. Select artist from dropdown
3. Fill in all invoice details
4. Click "Create Invoice"

### Approving/Rejecting (Admin)
1. View invoice in the list
2. Click ✓ (Approve) or ✗ (Reject) button
3. Status updates immediately

### Downloading PDF
1. Click the download icon (📥) next to any invoice
2. PDF downloads automatically with proper formatting

### Editing Invoice
- Only pending invoices can be edited
- Click the edit icon (✏️) next to pending invoices
- Make changes and save

### Deleting Invoice
- Only pending invoices can be deleted
- Only artists can delete their own invoices
- Click the delete icon (🗑️) next to pending invoices

## Components

### InvoiceManagement.tsx
Main component handling invoice list, search, filter, and actions.

### InvoiceForm.tsx
Form component for creating/editing invoices with the specific layout format.

### InvoicePDF.tsx
PDF generator class with methods:
- `generateInvoice()`: Creates PDF document
- `downloadInvoice()`: Downloads PDF file
- `previewInvoice()`: Opens PDF in new window

## API Routes

The system uses direct Supabase client calls. All operations are handled through:
- `supabase.from("invoices").select()` - Fetch invoices
- `supabase.from("invoices").insert()` - Create invoice
- `supabase.from("invoices").update()` - Update invoice
- `supabase.from("invoices").delete()` - Delete invoice
- `supabase.rpc("generate_invoice_ref")` - Generate unique reference

## Design

- Clean minimalist layout
- White background
- Soft gray dividers
- Subtle typography
- Responsive grid/flexbox layout
- Professional color scheme

## Future Enhancements

- Email invoice functionality
- Invoice templates
- Bulk invoice operations
- Invoice history tracking
- Payment tracking integration
- Export to CSV/Excel

