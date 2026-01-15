"use client";

import { jsPDF } from "jspdf";
import type { InvoiceSettings } from "@/lib/invoiceSettings";

interface PaymentRequestInvoice {
  id?: string;
  invoice_number: string;
  invoice_date: string;
  artist_name: string;
  artist_email?: string;
  artist_address?: string;
  artist_tax_id?: string;
  total_net: number;
  status: "pending" | "approved" | "rejected";
  payment_request_id?: string;
}

interface PaymentRequestInvoicePDFOptions {
  settings?: InvoiceSettings | null;
  logoUrl?: string;
}

export class PaymentRequestInvoicePDF {
  static async generateInvoice(
    invoice: PaymentRequestInvoice,
    options?: PaymentRequestInvoicePDFOptions
  ): Promise<jsPDF> {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPosition = margin;

    // Load settings
    let settings = options?.settings;
    if (!settings) {
      const { getInvoiceSettings } = await import("@/lib/invoiceSettings");
      settings = await getInvoiceSettings();
    }

    const businessSettings = settings || {
      business_name: "Good Life Music S.L",
      address: "Profesor Hermida 6, 3-3C, 36960 Sanxenxo (Spain)",
      contact_person: undefined,
      phone: "+34 693 43 25 06",
      email: "info@goodlifemusic.com",
      tax_id: "B72510704",
    };

    // Colors (RGB)
    const colors = {
      background: [255, 255, 255] as [number, number, number],
      text: [34, 34, 34] as [number, number, number],
      secondary: [107, 114, 128] as [number, number, number],
      border: [229, 231, 235] as [number, number, number],
      pending: [156, 163, 175] as [number, number, number],
      approved: [16, 185, 129] as [number, number, number],
      rejected: [239, 68, 68] as [number, number, number],
    };

    // Helper to apply RGB values
    const applyRGB = (
      fn: (r: number, g: number, b: number) => unknown,
      rgb: [number, number, number]
    ) => fn(rgb[0], rgb[1], rgb[2]);

    // Background fill
    applyRGB(doc.setFillColor.bind(doc), colors.background);
    doc.rect(0, 0, pageWidth, pageHeight, "F");

    doc.setFont("helvetica");

    // LOGO (top right)
    try {
      const response = await fetch("/logo.png");
      const blob = await response.blob();
      const logoBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      const logoWidth = 50;
      const logoHeight = 20;
      const logoX = pageWidth - margin - logoWidth;
      doc.addImage(logoBase64, "PNG", logoX, yPosition, logoWidth, logoHeight);
      yPosition += logoHeight + 10;
    } catch (err) {
      console.warn("Logo failed to load:", err);
    }

    // HEADER: INVOICE
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    applyRGB(doc.setTextColor.bind(doc), colors.text);

    const headerText = "INVOICE";
    const headerWidth = doc.getTextWidth(headerText);
    doc.text(headerText, (pageWidth - headerWidth) / 2, yPosition);
    yPosition += 18;

    // INVOICE NUMBER + DATE
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    applyRGB(doc.setTextColor.bind(doc), colors.secondary);

    doc.text(`Invoice Number: ${invoice.invoice_number}`, margin, yPosition);
    yPosition += 5;

    doc.text(
      `Invoice Date: ${new Date(invoice.invoice_date).toLocaleDateString()}`,
      margin,
      yPosition
    );
    yPosition += 12;

    // ============================================
    // BILL TO: (ADMIN/BUSINESS - recipient of the invoice)
    // ============================================
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    applyRGB(doc.setTextColor.bind(doc), colors.text);
    doc.text("Bill To:", margin, yPosition);
    yPosition += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    applyRGB(doc.setTextColor.bind(doc), colors.secondary);
    doc.text(businessSettings.business_name, margin, yPosition);
    yPosition += 5;

    const addressLines = businessSettings.address.split(/,|\n/).map((t) => t.trim());
    for (const line of addressLines) {
      if (line) {
        doc.text(line, margin, yPosition);
        yPosition += 5;
      }
    }

    if (businessSettings.contact_person) {
      doc.text(businessSettings.contact_person, margin, yPosition);
      yPosition += 5;
    }

    doc.text(`Phone: ${businessSettings.phone}`, margin, yPosition);
    yPosition += 5;
    doc.text(`Email: ${businessSettings.email}`, margin, yPosition);
    yPosition += 5;
    doc.text(`TAX ID: ${businessSettings.tax_id}`, margin, yPosition);
    yPosition += 12;

    // SEPARATOR LINE
    applyRGB(doc.setDrawColor.bind(doc), colors.border);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // ============================================
    // BILL FROM: (ARTIST - sender of the invoice)
    // ============================================
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    applyRGB(doc.setTextColor.bind(doc), colors.text);
    doc.text("Bill From:", margin, yPosition);
    yPosition += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    applyRGB(doc.setTextColor.bind(doc), colors.secondary);

    doc.text(invoice.artist_name, margin, yPosition);
    yPosition += 5;

    if (invoice.artist_email) {
      doc.text(invoice.artist_email, margin, yPosition);
      yPosition += 5;
    }

    if (invoice.artist_address) {
      const artistAddressLines = invoice.artist_address.split(/,|\n/).map((t) => t.trim());
      for (const line of artistAddressLines) {
        if (line) {
          doc.text(line, margin, yPosition);
          yPosition += 5;
        }
      }
    }

    if (invoice.artist_tax_id) {
      doc.text(`TAX ID: ${invoice.artist_tax_id}`, margin, yPosition);
      yPosition += 5;
    }

    yPosition += 8;

    // LINE
    applyRGB(doc.setDrawColor.bind(doc), colors.border);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 12;

    // INVOICE DETAILS
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    applyRGB(doc.setTextColor.bind(doc), colors.text);
    doc.text("Invoice Details", margin, yPosition);
    yPosition += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    applyRGB(doc.setTextColor.bind(doc), colors.secondary);
    doc.text("Payment Mode: Bank Transfer", margin, yPosition);
    yPosition += 5;

    // STATUS COLOR
    const statusColor =
      invoice.status === "approved"
        ? colors.approved
        : invoice.status === "rejected"
        ? colors.rejected
        : colors.pending;

    applyRGB(doc.setTextColor.bind(doc), statusColor);
    doc.text(`Status: ${invoice.status.toUpperCase()}`, margin, yPosition);
    yPosition += 10;

    // LINE
    applyRGB(doc.setDrawColor.bind(doc), colors.border);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 12;

    // TOTAL AMOUNT
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    applyRGB(doc.setTextColor.bind(doc), colors.text);
    doc.text("Total Amount:", margin, yPosition);

    const totalText = `$${Number(invoice.total_net).toFixed(2)}`;
    const totalWidth = doc.getTextWidth(totalText);
    doc.text(totalText, pageWidth - margin - totalWidth, yPosition);
    yPosition += 18;

    // FOOTER
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    applyRGB(doc.setTextColor.bind(doc), colors.secondary);

    const footerText =
      "Generated automatically by Good Life Music Portal – Receipt for Payment Request";

    const fw = doc.getTextWidth(footerText);
    doc.text(footerText, (pageWidth - fw) / 2, pageHeight - 15);

    return doc;
  }

  static async downloadInvoice(
    invoice: PaymentRequestInvoice,
    options?: PaymentRequestInvoicePDFOptions,
    filename?: string
  ) {
    const doc = await this.generateInvoice(invoice, options);
    doc.save(filename || `invoice-${invoice.invoice_number}.pdf`);
  }

  static async previewInvoice(
    invoice: PaymentRequestInvoice,
    options?: PaymentRequestInvoicePDFOptions
  ) {
    const doc = await this.generateInvoice(invoice, options);
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }
}
