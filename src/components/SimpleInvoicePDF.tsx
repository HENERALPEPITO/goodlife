/**
 * Simplified Invoice PDF Generator
 * No line items - just total amount and payment information
 */

"use client";

import { jsPDF } from "jspdf";
import { PDFGenerator, InvoiceData } from "./PDFGenerator";
import { loadLogoAsBase64 } from "@/lib/invoiceUtils";

export interface SimpleInvoiceData {
  invoice_number: string;
  invoice_date: string;
  artist_name: string;
  artist_address?: string;
  artist_email?: string;
  artist_phone?: string;
  total_amount: number;
  status: "pending" | "approved" | "rejected";
  payment_method?: string;
  notes?: string;
  currency?: string;
}

export class SimpleInvoicePDF {
  /**
   * Generates a simplified invoice PDF for Good Life Music S.L.
   * Minimalist design with no line items
   */
  static generateInvoice(data: SimpleInvoiceData, logoBase64?: string): jsPDF {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20; // 20mm margins
    let yPosition = margin;

    // Color constants
    const colors = {
      background: [255, 255, 255], // #FFFFFF
      text: [17, 17, 17], // #111111
      accent: [37, 99, 235], // #2563EB (royal blue)
      secondary: [107, 114, 128], // #6B7280 (medium gray)
      separator: [229, 231, 235], // #E5E7EB (soft light gray)
      totals: [17, 24, 39], // #111827 (dark bold)
    };

    doc.setFont("helvetica");

    // ============================================
    // HEADER SECTION
    // ============================================
    const headerY = yPosition;

    // Logo (left side) - if provided
    if (logoBase64) {
      try {
        const logoWidth = 40;
        const logoHeight = 15;
        doc.addImage(logoBase64, 'PNG', margin, headerY, logoWidth, logoHeight);
        yPosition = headerY + logoHeight + 5;
      } catch (error) {
        console.warn("Could not load logo image:", error);
      }
    }

    // Company info (right side)
    const companyInfoX = pageWidth - margin;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.text);
    doc.text("Good Life Music S.L", companyInfoX, headerY + 5, { align: "right" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.secondary);
    doc.text("Profesor Hermida 6, 3-3C", companyInfoX, headerY + 10, { align: "right" });
    doc.text("36960 Sanxenxo (Spain)", companyInfoX, headerY + 15, { align: "right" });
    doc.text("TAX ID: B72510704", companyInfoX, headerY + 20, { align: "right" });

    // Adjust yPosition if logo wasn't added
    if (!logoBase64) {
      yPosition = headerY + 25;
    }

    // Separator line
    yPosition += 10;
    doc.setDrawColor(...colors.separator);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 20;

    // ============================================
    // INVOICE TO SECTION
    // ============================================
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.accent);
    doc.text("Invoice To:", margin, yPosition);

    yPosition += 8;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.text);
    doc.text(data.artist_name, margin, yPosition);

    if (data.artist_address) {
      yPosition += 6;
      const addressLines = doc.splitTextToSize(data.artist_address, pageWidth - 2 * margin - 40);
      doc.text(addressLines, margin, yPosition);
      yPosition += addressLines.length * 6;
    }

    if (data.artist_email) {
      yPosition += 6;
      doc.setTextColor(...colors.secondary);
      doc.text(`Email: ${data.artist_email}`, margin, yPosition);
    }

    if (data.artist_phone) {
      yPosition += 6;
      doc.text(`Contact: ${data.artist_phone}`, margin, yPosition);
    }

    yPosition += 15;

    // Separator line
    doc.setDrawColor(...colors.separator);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 15;

    // ============================================
    // INVOICE DETAILS SECTION
    // ============================================
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.accent);
    doc.text("Invoice Details:", margin, yPosition);

    yPosition += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.secondary);
    doc.text(`Invoice Reference: ${data.invoice_number}`, margin, yPosition);

    yPosition += 6;
    doc.text(`Invoice Date: ${new Date(data.invoice_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, yPosition);

    yPosition += 6;
    const statusText = data.status.charAt(0).toUpperCase() + data.status.slice(1);
    doc.text(`Payment Status: ${statusText}`, margin, yPosition);

    yPosition += 20;

    // Separator line
    doc.setDrawColor(...colors.separator);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 20;

    // ============================================
    // TOTALS SECTION (Centered, Large)
    // ============================================
    const centerX = pageWidth / 2;
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.secondary);
    doc.text("Total Amount", centerX, yPosition, { align: "center" });

    yPosition += 12;
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.totals);
    const currency = data.currency || "€";
    doc.text(`${currency}${data.total_amount.toFixed(2)}`, centerX, yPosition, { align: "center" });

    yPosition += 20;

    // Payment Instructions (if provided)
    if (data.notes || data.payment_method) {
      doc.setDrawColor(...colors.separator);
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 12;

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...colors.accent);
      doc.text("Payment Instructions:", margin, yPosition);

      yPosition += 8;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...colors.text);

      if (data.payment_method) {
        doc.text(`Payment Method: ${data.payment_method}`, margin, yPosition);
        yPosition += 6;
      }

      if (data.notes) {
        const notesLines = doc.splitTextToSize(data.notes, pageWidth - 2 * margin);
        doc.text(notesLines, margin, yPosition);
        yPosition += notesLines.length * 6 + 6;
      }
    }

    // ============================================
    // FOOTER SECTION
    // ============================================
    const footerY = pageHeight - margin - 20;

    // Light gray divider
    doc.setDrawColor(...colors.separator);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY - 10, pageWidth - margin, footerY - 10);

    // Thank you message
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.secondary);
    doc.text("Thank you for working with Good Life Music S.L.", pageWidth / 2, footerY, { align: "center" });

    return doc;
  }

  /**
   * Downloads the simplified invoice PDF
   */
  static downloadInvoice(data: SimpleInvoiceData, logoBase64?: string, filename?: string): void {
    const doc = this.generateInvoice(data, logoBase64);
    const downloadFilename = filename || `invoice-${data.invoice_number}.pdf`;
    doc.save(downloadFilename);
  }

  /**
   * Opens the simplified invoice PDF in a new window/tab
   */
  static previewInvoice(data: SimpleInvoiceData, logoBase64?: string): void {
    const doc = this.generateInvoice(data, logoBase64);
    const pdfBlob = doc.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, "_blank");
  }
}







