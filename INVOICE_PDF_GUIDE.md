# Invoice PDF Generator Guide

## Overview

The Invoice PDF Generator creates clean, minimalist invoice PDFs for Good Life Music S.L. The design is inspired by Apple and Stripe-style invoices, featuring:

- Modern, professional layout
- Clear spacing and light typography
- Soft color contrasts
- Print-friendly A4 format

## Brand Information

The invoice generator automatically includes:
- **Company:** Good Life Music S.L
- **Address:** Profesor Hermida 6, 3-3C, 36960 Sanxenxo (Spain)
- **TAX ID:** B72510704

## Design Specifications

### Color Scheme
- **Background:** Pure white (#FFFFFF)
- **Text:** Near-black (#111111)
- **Accent:** Royal blue (#2563EB) for highlights and section titles
- **Secondary text:** Medium gray (#6B7280)
- **Separators:** Soft light gray (#E5E7EB)
- **Table headers:** Light tint background (#F9FAFB)
- **Totals:** Dark bold (#111827)

### Typography
- Uses Helvetica (similar to Helvetica Neue/Inter/SF Pro Display)
- Body text: 10-11pt
- Headings: 14-18pt
- Bold weights for totals and important sections

## Usage

### Basic Example

```typescript
import { PDFGenerator, InvoiceData } from "@/components/PDFGenerator";
import { loadLogoAsBase64 } from "@/lib/invoiceUtils";

// Create invoice data
const invoiceData: InvoiceData = {
  invoice_number: "INV-2025-001",
  invoice_date: new Date().toISOString(),
  due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  recipient_name: "John Doe",
  recipient_email: "john@example.com",
  recipient_address: "123 Main Street\nCity, State 12345",
  total: 500.00,
  currency: "€",
  status: "paid",
};

// Load logo (optional)
const logoBase64 = await loadLogoAsBase64('/logo.png');

// Generate and download
PDFGenerator.downloadInvoice(invoiceData, logoBase64);
```

### With Line Items

```typescript
const invoiceData: InvoiceData = {
  invoice_number: "INV-2025-002",
  invoice_date: new Date().toISOString(),
  recipient_name: "Jane Smith",
  recipient_email: "jane@example.com",
  line_items: [
    {
      description: "Music Licensing Fee",
      quantity: 1,
      rate: 500.00,
      amount: 500.00,
    },
    {
      description: "Royalty Payment",
      quantity: 1,
      rate: 250.00,
      amount: 250.00,
    },
  ],
  subtotal: 750.00,
  tax_rate: 21, // VAT in Spain
  tax_amount: 157.50,
  total: 907.50,
  currency: "€",
};
```

### Converting from Database Invoice

```typescript
import { convertInvoiceToInvoiceData } from "@/lib/invoiceUtils";

const invoiceData = convertInvoiceToInvoiceData(
  invoice, // From database
  {
    name: "Artist Name",
    email: "artist@example.com",
    address: "Address line 1\nAddress line 2",
  },
  {
    currency: '€',
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    tax_rate: 21,
  }
);
```

## API Reference

### `PDFGenerator.generateInvoice(data, logoBase64?)`

Generates a jsPDF document with the invoice.

**Parameters:**
- `data: InvoiceData` - Invoice data
- `logoBase64?: string` - Optional base64-encoded logo image

**Returns:** `jsPDF` document

### `PDFGenerator.downloadInvoice(data, logoBase64?, filename?)`

Generates and downloads the invoice PDF.

**Parameters:**
- `data: InvoiceData` - Invoice data
- `logoBase64?: string` - Optional base64-encoded logo image
- `filename?: string` - Optional filename (defaults to `invoice-{invoice_number}.pdf`)

### `PDFGenerator.previewInvoice(data, logoBase64?)`

Generates and opens the invoice PDF in a new window.

**Parameters:**
- `data: InvoiceData` - Invoice data
- `logoBase64?: string` - Optional base64-encoded logo image

## InvoiceData Interface

```typescript
interface InvoiceData {
  invoice_number: string;          // Required
  invoice_date: string;            // Required (ISO date string)
  due_date?: string;               // Optional (ISO date string)
  recipient_name: string;           // Required
  recipient_email?: string;         // Optional
  recipient_address?: string;       // Optional (use \n for line breaks)
  line_items?: InvoiceLineItem[];  // Optional (if not provided, creates single item)
  subtotal?: number;               // Optional (calculated from line_items if not provided)
  tax_rate?: number;               // Optional (percentage, e.g., 21 for 21%)
  tax_amount?: number;             // Optional (calculated if tax_rate provided)
  total: number;                   // Required
  status?: "pending" | "approved" | "paid" | "rejected"; // Optional
  currency?: string;               // Optional (defaults to "€")
  notes?: string;                  // Optional
}
```

## InvoiceLineItem Interface

```typescript
interface InvoiceLineItem {
  description: string;  // Required
  quantity?: number;    // Optional
  rate?: number;        // Optional
  amount: number;       // Required
}
```

## Logo

The logo should be placed in the `public` folder as `logo.png`. The generator will automatically load it when provided. If no logo is provided, the invoice will still generate correctly without it.

## Layout Structure

1. **Header** - Logo (left) and company info (right)
2. **Invoice Details** - Invoice number, date, due date, and recipient info
3. **Table Section** - Line items with description, quantity, rate, and amount
4. **Totals** - Subtotal, tax (if applicable), and total (aligned right)
5. **Footer** - Thank you message and optional notes

## Notes

- All margins are set to 20mm for consistent spacing
- The invoice is designed for A4 paper size
- Colors and text maintain strong readability on white paper
- The design avoids excessive borders, using spacing and color balance instead
- Every element has proper breathing room for a clean, professional look








