/**
 * PDF Generator Component
 * Generates payment receipt PDFs and invoices using jsPDF
 */

"use client";

import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';

interface RoyaltyItem {
  track_title: string;
  usage_count: number;
  gross_amount: number;
  admin_percent: number;
  net_amount: number;
  broadcast_date: string;
  platform: string;
  territory: string;
}

interface ReceiptData {
  receipt_number: string;
  artist_email: string;
  total_amount: number;
  status: string;
  created_at: string;
  approved_at: string | null;
  approved_by_email: string | null;
  royalties: RoyaltyItem[];
  totals: {
    total_gross: number;
    total_admin_fee: number;
    total_net: number;
    royalty_count: number;
  };
}

export interface InvoiceLineItem {
  description: string;
  quantity?: number;
  rate?: number;
  amount: number;
}

export interface InvoiceData {
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  recipient_name: string;
  recipient_email?: string;
  recipient_address?: string;
  line_items?: InvoiceLineItem[];
  subtotal?: number;
  tax_rate?: number;
  tax_amount?: number;
  total: number;
  status?: "pending" | "approved" | "paid" | "rejected";
  currency?: string;
  notes?: string;
}

export class PDFGenerator {
  /**
   * Generates a payment receipt PDF
   */
  static generateReceipt(data: ReceiptData): jsPDF {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPosition = 20;

    // Header
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("GOODLIFE ROYALTY PAYMENT RECEIPT", pageWidth / 2, yPosition, {
      align: "center",
    });

    yPosition += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Receipt #${data.receipt_number}`, pageWidth / 2, yPosition, {
      align: "center",
    });

    // Divider line
    yPosition += 10;
    doc.setLineWidth(0.5);
    doc.line(15, yPosition, pageWidth - 15, yPosition);

    // Artist Information
    yPosition += 10;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Artist Information", 15, yPosition);

    yPosition += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Email: ${data.artist_email}`, 15, yPosition);

    yPosition += 5;
    doc.text(`Request Date: ${new Date(data.created_at).toLocaleDateString()}`, 15, yPosition);

    if (data.approved_at) {
      yPosition += 5;
      doc.text(`Approved Date: ${new Date(data.approved_at).toLocaleDateString()}`, 15, yPosition);
    }

    if (data.approved_by_email) {
      yPosition += 5;
      doc.text(`Approved By: ${data.approved_by_email}`, 15, yPosition);
    }

    yPosition += 5;
    doc.setFont("helvetica", "bold");
    doc.text(`Status: ${data.status.toUpperCase()}`, 15, yPosition);

    // Royalty Details Table
    yPosition += 10;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Royalty Details", 15, yPosition);

    yPosition += 5;

    // Prepare table data
    const tableData = data.royalties.map((royalty) => [
      royalty.track_title,
      royalty.platform || "—",
      royalty.territory || "—",
      royalty.usage_count.toString(),
      `€${royalty.gross_amount.toFixed(2)}`,
      `${royalty.admin_percent.toFixed(1)}%`,
      `€${royalty.net_amount.toFixed(2)}`,
    ]);

    // Generate table
    autoTable(doc, {
      startY: yPosition,
      head: [
        [
          "Track Title",
          "Platform",
          "Territory",
          "Usage",
          "Gross",
          "Admin %",
          "Net",
        ],
      ],
      body: tableData,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [51, 51, 51],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      columnStyles: {
        0: { cellWidth: 45 }, // Track Title
        1: { cellWidth: 25 }, // Platform
        2: { cellWidth: 25 }, // Territory
        3: { cellWidth: 20, halign: "center" }, // Usage
        4: { cellWidth: 25, halign: "right" }, // Gross
        5: { cellWidth: 20, halign: "center" }, // Admin %
        6: { cellWidth: 25, halign: "right" }, // Net
      },
    });

    // Get final Y position after table
    yPosition = (doc as any).lastAutoTable.finalY + 10;

    // Totals Section
    const totalsX = pageWidth - 80;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    doc.text("Total Gross Amount:", totalsX, yPosition);
    doc.text(`€${data.totals.total_gross.toFixed(2)}`, totalsX + 60, yPosition, {
      align: "right",
    });

    yPosition += 6;
    doc.text("Total Admin Fee:", totalsX, yPosition);
    doc.text(`€${data.totals.total_admin_fee.toFixed(2)}`, totalsX + 60, yPosition, {
      align: "right",
    });

    yPosition += 6;
    doc.setLineWidth(0.3);
    doc.line(totalsX, yPosition, totalsX + 60, yPosition);

    yPosition += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Net Payable Amount:", totalsX, yPosition);
    doc.text(`€${data.totals.total_net.toFixed(2)}`, totalsX + 60, yPosition, {
      align: "right",
    });

    // Signature Section
    yPosition += 20;
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    doc.text("_____________________________", 15, yPosition);
    doc.text("_____________________________", pageWidth - 80, yPosition);

    yPosition += 5;
    doc.setFontSize(9);
    doc.text("Admin Signature", 15, yPosition);
    doc.text("Artist Acknowledgement", pageWidth - 80, yPosition);

    yPosition += 5;
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 15, yPosition);
    doc.text(`Date: __________________`, pageWidth - 80, yPosition);

    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 15;
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text("Generated by GoodLife Platform", pageWidth / 2, footerY, {
      align: "center",
    });

    doc.text(
      `Generated on: ${new Date().toLocaleString()}`,
      pageWidth / 2,
      footerY + 4,
      { align: "center" }
    );

    return doc;
  }

  /**
   * Downloads the PDF to the user's computer
   */
  static downloadReceipt(data: ReceiptData, filename?: string): void {
    const doc = this.generateReceipt(data);
    const downloadFilename = filename || `receipt-${data.receipt_number}.pdf`;
    doc.save(downloadFilename);
  }

  /**
   * Opens the PDF in a new window/tab
   */
  static previewReceipt(data: ReceiptData): void {
    const doc = this.generateReceipt(data);
    const pdfBlob = doc.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, "_blank");
  }

  /**
   * Generates a clean, minimalist invoice PDF for Good Life Music S.L.
   * Design inspired by Apple and Stripe-style invoices
   */
  static generateInvoice(data: InvoiceData, logoBase64?: string): jsPDF {
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
      tableHeader: [249, 250, 251], // #F9FAFB
      totals: [17, 24, 39], // #111827 (dark bold)
      highlight: [239, 246, 255], // #EFF6FF (very light blue)
    };

    // Set default font (Helvetica Neue is similar to Helvetica)
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
    yPosition += 15;

    // ============================================
    // INVOICE DETAILS SECTION
    // ============================================
    const detailsStartY = yPosition;
    const detailsLeftX = margin;
    const detailsRightX = pageWidth - margin;

    // Left column: Invoice info
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.text);
    doc.text("Invoice", detailsLeftX, yPosition);

    yPosition += 8;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.secondary);
    doc.text(`Invoice #${data.invoice_number}`, detailsLeftX, yPosition);

    yPosition += 6;
    doc.text(`Date: ${new Date(data.invoice_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, detailsLeftX, yPosition);

    if (data.due_date) {
      yPosition += 6;
      doc.text(`Due Date: ${new Date(data.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, detailsLeftX, yPosition);
    }

    // Right column: Recipient info
    const recipientY = detailsStartY;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.accent);
    doc.text("Bill To", detailsRightX, recipientY, { align: "right" });

    yPosition = recipientY + 6;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.text);
    doc.text(data.recipient_name, detailsRightX, yPosition, { align: "right" });

    if (data.recipient_email) {
      yPosition += 6;
      doc.setFontSize(10);
      doc.setTextColor(...colors.secondary);
      doc.text(data.recipient_email, detailsRightX, yPosition, { align: "right" });
    }

    if (data.recipient_address) {
      yPosition += 6;
      const addressLines = data.recipient_address.split('\n');
      addressLines.forEach((line, index) => {
        doc.text(line, detailsRightX, yPosition + (index * 6), { align: "right" });
      });
      yPosition += addressLines.length * 6;
    }

    // Status badge (optional, if status is provided)
    if (data.status && data.status === "paid") {
      const statusY = detailsStartY;
      doc.setFillColor(...colors.highlight);
      doc.roundedRect(detailsRightX - 50, statusY - 5, 45, 8, 2, 2, 'F');
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...colors.accent);
      doc.text("PAID", detailsRightX - 2.5, statusY, { align: "right" });
    }

    // Find the maximum Y position from both columns
    yPosition = Math.max(yPosition, detailsStartY + 30) + 15;

    // Separator line
    doc.setDrawColor(...colors.separator);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // ============================================
    // TABLE SECTION
    // ============================================
    const tableStartY = yPosition;

    // Prepare line items
    let lineItems: InvoiceLineItem[] = [];
    if (data.line_items && data.line_items.length > 0) {
      lineItems = data.line_items;
    } else {
      // If no line items provided, create a single item from the total
      lineItems = [{
        description: "Payment Request",
        quantity: 1,
        rate: data.total,
        amount: data.total,
      }];
    }

    // Calculate subtotal if not provided
    const subtotal = data.subtotal ?? lineItems.reduce((sum, item) => sum + item.amount, 0);
    const taxRate = data.tax_rate ?? 0;
    const taxAmount = data.tax_amount ?? (subtotal * taxRate / 100);
    const total = data.total;

    // Prepare table data
    const tableData = lineItems.map((item) => {
      const description = item.description || "Item";
      const quantity = item.quantity !== undefined ? item.quantity.toString() : "—";
      const rate = item.rate !== undefined ? `${data.currency || "€"}${item.rate.toFixed(2)}` : "—";
      const amount = `${data.currency || "€"}${item.amount.toFixed(2)}`;
      return [description, quantity, rate, amount];
    });

    // Generate table with minimal styling
    autoTable(doc, {
      startY: tableStartY,
      head: [["Description", "Qty", "Unit Price", "Total"]],
      body: tableData,
      theme: "plain",
      headStyles: {
        fillColor: colors.tableHeader,
        textColor: colors.text,
        fontStyle: "bold",
        fontSize: 10,
        cellPadding: { top: 8, bottom: 8, left: 4, right: 4 },
        lineColor: colors.separator,
        lineWidth: 0.5,
      },
      bodyStyles: {
        textColor: colors.text,
        fontSize: 10,
        cellPadding: { top: 10, bottom: 10, left: 4, right: 4 },
        lineColor: colors.separator,
        lineWidth: 0.3,
      },
      alternateRowStyles: {
        fillColor: [255, 255, 255], // No alternate colors for clean look
      },
      columnStyles: {
        0: { cellWidth: "auto", halign: "left" }, // Description
        1: { cellWidth: 30, halign: "center" }, // Quantity
        2: { cellWidth: 40, halign: "right" }, // Rate
        3: { cellWidth: 40, halign: "right" }, // Amount
      },
      styles: {
        lineColor: colors.separator,
        lineWidth: 0.3,
      },
      margin: { left: margin, right: margin },
    });

    // Get final Y position after table
    yPosition = (doc as any).lastAutoTable.finalY + 15;

    // ============================================
    // TOTALS SECTION
    // ============================================
    const totalsX = pageWidth - margin - 80;
    const totalsLabelWidth = 50;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.secondary);

    // Subtotal
    doc.text("Subtotal", totalsX, yPosition, { align: "right" });
    doc.setTextColor(...colors.text);
    doc.text(`${data.currency || "€"}${subtotal.toFixed(2)}`, totalsX + totalsLabelWidth, yPosition, { align: "right" });

    // Tax (if applicable)
    if (taxRate > 0 && taxAmount > 0) {
      yPosition += 7;
      doc.setTextColor(...colors.secondary);
      doc.text(`Tax (${taxRate}%)`, totalsX, yPosition, { align: "right" });
      doc.setTextColor(...colors.text);
      doc.text(`${data.currency || "€"}${taxAmount.toFixed(2)}`, totalsX + totalsLabelWidth, yPosition, { align: "right" });
    }

    // Separator line before total
    yPosition += 8;
    doc.setDrawColor(...colors.separator);
    doc.setLineWidth(0.5);
    doc.line(totalsX, yPosition, totalsX + totalsLabelWidth, yPosition);

    // Total
    yPosition += 10;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.totals);
    doc.text("Total", totalsX, yPosition, { align: "right" });
    doc.setFontSize(14);
    doc.text(`${data.currency || "€"}${total.toFixed(2)}`, totalsX + totalsLabelWidth, yPosition, { align: "right" });

    yPosition += 20;

    // ============================================
    // FOOTER SECTION
    // ============================================
    const footerY = pageHeight - margin - 20;

    // Notes (if provided)
    if (data.notes) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...colors.secondary);
      const notesLines = doc.splitTextToSize(data.notes, pageWidth - 2 * margin);
      doc.text(notesLines, margin, yPosition);
      yPosition += notesLines.length * 5 + 10;
    }

    // Thank you message
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.secondary);
    doc.text("Thank you for your business.", margin, footerY, { align: "left" });

    // Contact info
    doc.setFontSize(9);
    doc.text("Questions? Contact us at your convenience.", margin, footerY + 6, { align: "left" });

    return doc;
  }

  /**
   * Downloads the invoice PDF
   */
  static downloadInvoice(data: InvoiceData, logoBase64?: string, filename?: string): void {
    const doc = this.generateInvoice(data, logoBase64);
    const downloadFilename = filename || `invoice-${data.invoice_number}.pdf`;
    doc.save(downloadFilename);
  }

  /**
   * Opens the invoice PDF in a new window/tab
   */
  static previewInvoice(data: InvoiceData, logoBase64?: string): void {
    const doc = this.generateInvoice(data, logoBase64);
    const pdfBlob = doc.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, "_blank");
  }
}





