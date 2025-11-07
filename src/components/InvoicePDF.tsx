"use client";

import { jsPDF } from "jspdf";
import type { InvoiceSettings } from "@/lib/invoiceSettings";

interface Invoice {
  id?: string;
  artist_id?: string;
  artist_name: string;
  artist_email?: string;
  statement_number?: string;
  period?: string;
  total_net: number;
  payment_options?: string;
  invoice_ref: string;
  invoice_date: string;
  invoice_number?: string;
  status?: "pending" | "approved" | "rejected";
}

interface InvoicePDFOptions {
  settings?: InvoiceSettings | null;
  logoUrl?: string;
}

export class InvoicePDF {
  /**
   * Generates a PDF invoice with the specified format
   */
  static generateInvoice(invoice: Invoice): jsPDF {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let yPosition = margin;

    // Color constants
    const colors = {
      text: [17, 24, 39], // #111827
      secondary: [107, 114, 128], // #6B7280
      border: [229, 231, 235], // #E5E7EB
    };

    doc.setFont("helvetica");

    // ============================================
    // HEADER: SUBMIT INVOICE
    // ============================================
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.text);
    doc.text("SUBMIT INVOICE", margin, yPosition);
    yPosition += 15;

    // ============================================
    // ARTIST NAME
    // ============================================
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("ARTIST NAME:", margin, yPosition);
    yPosition += 7;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(invoice.artist_name || "—", margin + 5, yPosition);
    yPosition += 12;

    // ============================================
    // ADDRESS
    // ============================================
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("ADDRESS:", margin, yPosition);
    yPosition += 7;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const addressLines = [
      "Calle 9 #86",
      "Merida",
      "97136 Mexico"
    ];
    addressLines.forEach(line => {
      doc.text(line, margin + 5, yPosition);
      yPosition += 6;
    });
    yPosition += 6;

    // ============================================
    // INVOICE TO
    // ============================================
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("INVOICE TO:", margin, yPosition);
    yPosition += 7;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const invoiceToLines = [
      "Lime Blue Music Limited Ground Floor",
      "161 Rosebery Avenue London",
      "ECIR 4QX",
      "United Kingdom"
    ];
    invoiceToLines.forEach(line => {
      doc.text(line, margin + 5, yPosition);
      yPosition += 6;
    });
    yPosition += 8;

    // ============================================
    // SEPARATOR LINE
    // ============================================
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // ============================================
    // INVOICE ITEM
    // ============================================
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Invoice Item:", margin, yPosition);
    yPosition += 7;
    
    doc.setFontSize(11);
    const invoiceItemText = `Statement #${invoice.statement_number || "—"}: ${invoice.period || ""} ${invoice.artist_name || ""}`.trim();
    doc.text(invoiceItemText, margin + 5, yPosition);
    yPosition += 12;

    // ============================================
    // SEPARATOR LINE
    // ============================================
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // ============================================
    // TOTALS
    // ============================================
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Totals:", margin, yPosition);
    yPosition += 7;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const totalNet = Number(invoice.total_net || 0).toFixed(2);
    doc.text(`TOTAL NET: €${totalNet}`, margin + 5, yPosition);
    yPosition += 12;

    // ============================================
    // PAY ME BY
    // ============================================
    if (invoice.payment_options) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Pay Me By:", margin, yPosition);
      yPosition += 7;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(`PAYMENT OPTIONS: ${invoice.payment_options}`, margin + 5, yPosition);
      yPosition += 12;
    }

    // ============================================
    // SEPARATOR LINE
    // ============================================
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // ============================================
    // INVOICE REF AND DATE
    // ============================================
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    
    const invoiceRef = invoice.invoice_ref || invoice.invoice_number || "—";
    const invoiceDate = invoice.invoice_date 
      ? new Date(invoice.invoice_date).toLocaleDateString()
      : new Date().toLocaleDateString();
    
    doc.text(`Invoice Ref: ${invoiceRef}`, margin, yPosition);
    yPosition += 6;
    doc.text(`Invoice Date: ${invoiceDate}`, margin, yPosition);

    return doc;
  }

  /**
   * Downloads the invoice PDF
   */
  static downloadInvoice(invoice: Invoice, filename?: string): void {
    const doc = this.generateInvoice(invoice);
    const downloadFilename = filename || `invoice-${invoice.invoice_ref || invoice.invoice_number || "invoice"}.pdf`;
    doc.save(downloadFilename);
  }

  /**
   * Opens the invoice PDF in a new window/tab
   */
  static previewInvoice(invoice: Invoice): void {
    const doc = this.generateInvoice(invoice);
    const pdfBlob = doc.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, "_blank");
  }
}

