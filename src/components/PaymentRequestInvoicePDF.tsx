/**
 * Payment Request Invoice PDF Generator
 * Generates minimalist invoice PDFs for payment requests
 * Works on both client and server side
 */

import { jsPDF } from "jspdf";
import type { InvoiceSettings } from "@/lib/invoiceSettings";

export interface PaymentRequestInvoiceData {
  id: string;
  invoice_number: string;
  invoice_date: string;
  artist_name: string;
  artist_email?: string;
  total_net: number;
  status: "pending" | "approved" | "rejected";
  payment_request_id: string;
}

interface PaymentRequestInvoicePDFOptions {
  settings?: InvoiceSettings;
  logoBase64?: string;
}

export class PaymentRequestInvoicePDF {
  /**
   * Generates a minimalist invoice PDF for a payment request
   */
  static generateInvoice(
    data: PaymentRequestInvoiceData,
    options: PaymentRequestInvoicePDFOptions = {}
  ): jsPDF {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20; // 20mm margins
    let yPosition = margin;

    // Get invoice settings
    const settings = options.settings || {
      id: "default",
      business_name: "Good Life Music S.L",
      address: "Profesor Hermida 6, 3-3C, 36960 Sanxenxo (Spain)",
      phone: "+34 693 43 25 06",
      email: "info@goodlifemusic.com",
      tax_id: "B72510704",
      updated_at: new Date().toISOString(),
    };

    // Color constants (minimalist: black, gray, white)
    const colors = {
      background: [255, 255, 255], // #FFFFFF
      text: [17, 17, 17], // #111111
      secondary: [107, 114, 128], // #6B7280 (medium gray)
      separator: [229, 231, 235], // #E5E7EB (soft light gray)
    };

    // Set default font
    doc.setFont("helvetica");

    // ============================================
    // HEADER SECTION - Logo at top center
    // ============================================
    const headerY = yPosition;

    // Logo (center) - if provided
    if (options.logoBase64) {
      try {
        const logoWidth = 50;
        const logoHeight = 20;
        const logoX = (pageWidth - logoWidth) / 2;
        doc.addImage(options.logoBase64, "PNG", logoX, headerY, logoWidth, logoHeight);
        yPosition = headerY + logoHeight + 15;
      } catch (error) {
        console.warn("Could not load logo image:", error);
        yPosition = headerY + 10;
      }
    } else {
      yPosition = headerY + 10;
    }

    // Company info (right side)
    const companyInfoX = pageWidth - margin;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.text);
    doc.text(settings.business_name, companyInfoX, yPosition, { align: "right" });

    yPosition += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.secondary);
    
    // Split address into lines if needed
    const addressLines = settings.address.split(", ");
    addressLines.forEach((line, index) => {
      doc.text(line, companyInfoX, yPosition + (index * 6), { align: "right" });
    });
    yPosition += addressLines.length * 6;

    yPosition += 3;
    doc.text(`Phone: ${settings.phone}`, companyInfoX, yPosition, { align: "right" });
    yPosition += 6;
    doc.text(`Email: ${settings.email}`, companyInfoX, yPosition, { align: "right" });
    yPosition += 6;
    doc.text(`TAX ID: ${settings.tax_id}`, companyInfoX, yPosition, { align: "right" });

    yPosition += 15;

    // Separator line
    doc.setDrawColor(...colors.separator);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 15;

    // ============================================
    // INVOICE DETAILS SECTION
    // ============================================
    const detailsStartY = yPosition;

    // Left column: Invoice info
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.text);
    doc.text("INVOICE", margin, yPosition);

    yPosition += 10;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.secondary);
    doc.text(`Invoice Number: ${data.invoice_number}`, margin, yPosition);

    yPosition += 7;
    doc.text(`Invoice Date: ${new Date(data.invoice_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, margin, yPosition);

    // Right column: Artist info
    const artistY = detailsStartY;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.text);
    doc.text("Bill To", companyInfoX, artistY, { align: "right" });

    yPosition = artistY + 7;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(data.artist_name, companyInfoX, yPosition, { align: "right" });

    if (data.artist_email) {
      yPosition += 7;
      doc.setFontSize(10);
      doc.setTextColor(...colors.secondary);
      doc.text(data.artist_email, companyInfoX, yPosition, { align: "right" });
    }

    // Status badge
    const statusY = detailsStartY;
    const statusColors: Record<string, number[]> = {
      pending: [234, 179, 8], // yellow
      approved: [34, 197, 94], // green
      rejected: [239, 68, 68], // red
    };
    const statusColor = statusColors[data.status] || colors.secondary;
    doc.setFillColor(...statusColor);
    doc.roundedRect(companyInfoX - 60, statusY - 5, 55, 8, 2, 2, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(data.status.toUpperCase(), companyInfoX - 2.5, statusY, { align: "right" });

    yPosition = Math.max(yPosition, detailsStartY + 25) + 15;

    // Separator line
    doc.setDrawColor(...colors.separator);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 15;

    // ============================================
    // PAYMENT DETAILS SECTION
    // ============================================
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.text);
    doc.text("Payment Details", margin, yPosition);

    yPosition += 10;

    // Payment mode
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.secondary);
    doc.text("Payment Mode:", margin, yPosition);
    doc.setTextColor(...colors.text);
    doc.text("Bank Transfer", margin + 50, yPosition);

    yPosition += 10;

    // Total amount (highlighted)
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.text);
    doc.text("Total Amount:", margin, yPosition);
    
    const totalX = pageWidth - margin;
    doc.setFontSize(18);
    doc.text(`€${data.total_net.toFixed(2)}`, totalX, yPosition, { align: "right" });

    yPosition += 20;

    // Separator line
    doc.setDrawColor(...colors.separator);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 15;

    // ============================================
    // FOOTER SECTION
    // ============================================
    const footerY = pageHeight - margin - 30;

    // Footer text
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.secondary);
    doc.text(
      "Generated automatically by Good Life Music Portal – Receipt for Payment Request",
      pageWidth / 2,
      footerY,
      { align: "center" }
    );

    return doc;
  }

  /**
   * Downloads the invoice PDF
   */
  static downloadInvoice(
    data: PaymentRequestInvoiceData,
    options: PaymentRequestInvoicePDFOptions = {},
    filename?: string
  ): void {
    const doc = this.generateInvoice(data, options);
    const downloadFilename = filename || `invoice-${data.invoice_number}.pdf`;
    doc.save(downloadFilename);
  }

  /**
   * Opens the invoice PDF in a new window/tab
   */
  static previewInvoice(
    data: PaymentRequestInvoiceData,
    options: PaymentRequestInvoicePDFOptions = {}
  ): void {
    const doc = this.generateInvoice(data, options);
    const pdfBlob = doc.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, "_blank");
  }

  /**
   * Generates the PDF as a blob for upload to storage
   */
  static generatePDFBlob(
    data: PaymentRequestInvoiceData,
    options: PaymentRequestInvoicePDFOptions = {}
  ): Blob {
    const doc = this.generateInvoice(data, options);
    return doc.output("blob");
  }
}
