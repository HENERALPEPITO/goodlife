/**
 * Example component demonstrating how to use the Invoice PDF Generator
 * This is a reference implementation - adapt as needed for your use case
 */

"use client";

import { PDFGenerator, InvoiceData } from "./PDFGenerator";
import { loadLogoAsBase64, convertInvoiceToInvoiceData } from "@/lib/invoiceUtils";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";

interface InvoicePDFExampleProps {
  invoice: {
    invoice_number: string;
    amount: number;
    created_at: string;
    status?: "pending" | "approved" | "paid" | "rejected";
    remarks?: string | null;
  };
  recipient: {
    name: string;
    email?: string;
    address?: string;
  };
}

/**
 * Example: Generate invoice PDF from invoice data
 */
export function InvoicePDFExample({ invoice, recipient }: InvoicePDFExampleProps) {
  const handleGenerateInvoice = async () => {
    try {
      // Load logo as base64 (optional)
      const logoBase64 = await loadLogoAsBase64('/logo.png');

      // Convert invoice data to InvoiceData format
      const invoiceData: InvoiceData = convertInvoiceToInvoiceData(
        invoice,
        recipient,
        {
          currency: '€',
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
          notes: invoice.remarks || undefined,
        }
      );

      // Generate and download the PDF
      PDFGenerator.downloadInvoice(invoiceData, logoBase64);
    } catch (error) {
      console.error("Failed to generate invoice:", error);
    }
  };

  const handlePreviewInvoice = async () => {
    try {
      // Load logo as base64 (optional)
      const logoBase64 = await loadLogoAsBase64('/logo.png');

      // Convert invoice data to InvoiceData format
      const invoiceData: InvoiceData = convertInvoiceToInvoiceData(
        invoice,
        recipient,
        {
          currency: '€',
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          notes: invoice.remarks || undefined,
        }
      );

      // Preview the PDF in a new window
      PDFGenerator.previewInvoice(invoiceData, logoBase64);
    } catch (error) {
      console.error("Failed to preview invoice:", error);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        onClick={handleGenerateInvoice}
        variant="outline"
        size="sm"
      >
        <FileDown className="h-4 w-4 mr-2" />
        Download Invoice
      </Button>
      <Button
        onClick={handlePreviewInvoice}
        variant="outline"
        size="sm"
      >
        Preview Invoice
      </Button>
    </div>
  );
}

/**
 * Example: Generate invoice with custom line items
 */
export function generateInvoiceWithLineItems() {
  const invoiceData: InvoiceData = {
    invoice_number: "INV-2025-001",
    invoice_date: new Date().toISOString(),
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    recipient_name: "John Doe",
    recipient_email: "john@example.com",
    recipient_address: "123 Main Street\nCity, State 12345",
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
    status: "paid",
    currency: "€",
    notes: "Payment terms: Net 30 days. Thank you for your business!",
  };

  // Load logo and generate
  loadLogoAsBase64('/logo.png').then((logoBase64) => {
    PDFGenerator.downloadInvoice(invoiceData, logoBase64);
  });
}







