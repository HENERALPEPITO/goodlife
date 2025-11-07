"use client";

import { jsPDF } from "jspdf";
import type { InvoiceSettings } from "@/lib/invoiceSettings";

interface PaymentRequestInvoice {
  id?: string;
  invoice_number: string;
  invoice_date: string;
  artist_name: string;
  artist_email?: string;
  total_net: number;
  status: "pending" | "approved" | "rejected";
  payment_request_id?: string;
}

interface PaymentRequestInvoicePDFOptions {
  settings?: InvoiceSettings | null;
  logoUrl?: string;
}

/**
 * Payment Request Invoice PDF Generator
 * Generates minimalist invoice PDFs for payment requests
 */
export class PaymentRequestInvoicePDF {
  /**
   * Generates a PDF invoice for a payment request
   */
  static async generateInvoice(
    invoice: PaymentRequestInvoice,
    options?: PaymentRequestInvoicePDFOptions
  ): Promise<jsPDF> {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let yPosition = margin;

    // Get invoice settings
    let settings = options?.settings;
    if (!settings) {
      const { getInvoiceSettings } = await import("@/lib/invoiceSettings");
      settings = await getInvoiceSettings();
    }

    // Use default settings if none provided
    const businessSettings = settings || {
      business_name: "Good Life Music S.L",
      address: "Profesor Hermida 6, 3-3C, 36960 Sanxenxo (Spain)",
      contact_person: undefined,
      phone: "+34 693 43 25 06",
      email: "info@goodlifemusic.com",
      tax_id: "B72510704",
    };

    // Color constants
    const colors = {
      text: [17, 24, 39], // #111827
      secondary: [107, 114, 128], // #6B7280
      border: [229, 231, 235], // #E5E7EB
      accent: [37, 99, 235], // #2563EB
    };

    doc.setFont("helvetica");

    // ============================================
    // LOGO (if available) - Top Center
    // ============================================
    if (options?.logoUrl) {
      try {
        // Load logo image and place at top center
        const logoWidth = 50;
        const logoHeight = 20;
        const logoX = (pageWidth - logoWidth) / 2; // Center horizontally
        doc.addImage(options.logoUrl, 'PNG', logoX, yPosition, logoWidth, logoHeight);
        yPosition += logoHeight + 10;
      } catch (error) {
        console.warn("Could not load logo:", error);
      }
    }

    // ============================================
    // INVOICE HEADER (Centered)
    // ============================================
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.text);
    const headerText = "INVOICE";
    const headerWidth = doc.getTextWidth(headerText);
    doc.text(headerText, (pageWidth - headerWidth) / 2, yPosition); // Center the header
    yPosition += 15;

    // ============================================
    // INVOICE NUMBER AND DATE
    // ============================================
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.secondary);
    doc.text(`Invoice Number: ${invoice.invoice_number}`, margin, yPosition);
    yPosition += 5;
    doc.text(
      `Invoice Date: ${new Date(invoice.invoice_date).toLocaleDateString()}`,
      margin,
      yPosition
    );
    yPosition += 12;

    // ============================================
    // BUSINESS INFO (FROM ADMIN SETTINGS)
    // ============================================
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.text);
    doc.text(businessSettings.business_name, margin, yPosition);
    yPosition += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...colors.secondary);

    // Split address into lines (handle comma-separated or newline-separated)
    const addressLines = businessSettings.address.includes("\n")
      ? businessSettings.address.split("\n").map((s) => s.trim())
      : businessSettings.address.split(",").map((s) => s.trim());
    
    addressLines.forEach((line) => {
      if (line) {
        doc.text(line, margin, yPosition);
        yPosition += 5;
      }
    });

    // Contact person (if provided)
    if (businessSettings.contact_person) {
      yPosition += 2;
      doc.text(businessSettings.contact_person, margin, yPosition);
      yPosition += 5;
    }

    yPosition += 2;
    doc.text(`Phone: ${businessSettings.phone}`, margin, yPosition);
    yPosition += 5;
    doc.text(`Email: ${businessSettings.email}`, margin, yPosition);
    yPosition += 5;
    doc.text(`TAX ID: ${businessSettings.tax_id}`, margin, yPosition);
    yPosition += 12;

    // ============================================
    // SEPARATOR LINE
    // ============================================
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // ============================================
    // ARTIST INFO (RECIPIENT)
    // ============================================
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.text);
    doc.text("Bill To:", margin, yPosition);
    yPosition += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...colors.secondary);
    doc.text(invoice.artist_name, margin, yPosition);
    yPosition += 5;
    if (invoice.artist_email) {
      doc.text(invoice.artist_email, margin, yPosition);
      yPosition += 5;
    }
    yPosition += 8;

    // ============================================
    // SEPARATOR LINE
    // ============================================
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // ============================================
    // INVOICE DETAILS
    // ============================================
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.text);
    doc.text("Invoice Details", margin, yPosition);
    yPosition += 8;

    // Payment Mode
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...colors.secondary);
    doc.text("Payment Mode: Bank Transfer", margin, yPosition);
    yPosition += 5;

    // Status
    const statusText =
      invoice.status === "approved"
        ? "Approved"
        : invoice.status === "rejected"
        ? "Rejected"
        : "Pending";
    doc.text(`Status: ${statusText}`, margin, yPosition);
    yPosition += 10;

    // ============================================
    // SEPARATOR LINE
    // ============================================
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // ============================================
    // TOTAL AMOUNT (Large and Bold)
    // ============================================
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.text);
    doc.text("Total Amount:", margin, yPosition);
    
    const totalAmount = Number(invoice.total_net || 0).toFixed(2);
    const totalText = `€${totalAmount}`;
    const totalWidth = doc.getTextWidth(totalText);
    doc.text(totalText, pageWidth - margin - totalWidth, yPosition);
    yPosition += 15;

    // ============================================
    // SEPARATOR LINE
    // ============================================
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // ============================================
    // FOOTER
    // ============================================
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.secondary);
    const footerText = "Generated automatically by Good Life Music Portal – Receipt for Payment Request";
    const footerWidth = doc.getTextWidth(footerText);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.text(footerText, (pageWidth - footerWidth) / 2, pageHeight - 15);

    return doc;
  }

  /**
   * Downloads the invoice PDF
   */
  static async downloadInvoice(
    invoice: PaymentRequestInvoice,
    options?: PaymentRequestInvoicePDFOptions,
    filename?: string
  ): Promise<void> {
    const doc = await this.generateInvoice(invoice, options);
    const downloadFilename =
      filename || `invoice-${invoice.invoice_number || "invoice"}.pdf`;
    doc.save(downloadFilename);
  }

  /**
   * Opens the invoice PDF in a new window/tab
   */
  static async previewInvoice(
    invoice: PaymentRequestInvoice,
    options?: PaymentRequestInvoicePDFOptions
  ): Promise<void> {
    const doc = await this.generateInvoice(invoice, options);
    const pdfBlob = doc.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, "_blank");
  }
}

