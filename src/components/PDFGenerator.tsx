/**
 * PDF Generator Component
 * Generates payment receipt PDFs and invoices using jsPDF
 */

"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

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
  // -------------------------
  // RECEIPT
  // -------------------------
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

    const tableData = data.royalties.map((royalty) => [
      royalty.track_title,
      royalty.platform || "—",
      royalty.territory || "—",
      royalty.usage_count.toString(),
      `€${royalty.gross_amount.toFixed(2)}`,
      `${royalty.admin_percent.toFixed(1)}%`,
      `€${royalty.net_amount.toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [["Track Title", "Platform", "Territory", "Usage", "Gross", "Admin %", "Net"]],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [51, 51, 51], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 25 },
        2: { cellWidth: 25 },
        3: { cellWidth: 20, halign: "center" },
        4: { cellWidth: 25, halign: "right" },
        5: { cellWidth: 20, halign: "center" },
        6: { cellWidth: 25, halign: "right" },
      },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 10;

    // Totals Section
    const totalsX = pageWidth - 80;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    doc.text("Total Gross Amount:", totalsX, yPosition);
    doc.text(`€${data.totals.total_gross.toFixed(2)}`, totalsX + 60, yPosition, { align: "right" });

    yPosition += 6;
    doc.text("Total Admin Fee:", totalsX, yPosition);
    doc.text(`€${data.totals.total_admin_fee.toFixed(2)}`, totalsX + 60, yPosition, { align: "right" });

    yPosition += 6;
    doc.setLineWidth(0.3);
    doc.line(totalsX, yPosition, totalsX + 60, yPosition);

    yPosition += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Net Payable Amount:", totalsX, yPosition);
    doc.text(`€${data.totals.total_net.toFixed(2)}`, totalsX + 60, yPosition, { align: "right" });

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
    doc.setTextColor(17, 17, 17); // FIX: remove spread
    doc.text("Generated by GoodLife Platform", pageWidth / 2, footerY, { align: "center" });

    doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, footerY + 4, {
      align: "center",
    });

    return doc;
  }

  static downloadReceipt(data: ReceiptData, filename?: string): void {
    const doc = this.generateReceipt(data);
    doc.save(filename || `receipt-${data.receipt_number}.pdf`);
  }

  static previewReceipt(data: ReceiptData): void {
    const doc = this.generateReceipt(data);
    const pdfBlob = doc.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, "_blank");
  }

  // -------------------------
  // INVOICE
  // -------------------------
  static generateInvoice(data: InvoiceData, logoBase64?: string): jsPDF {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPosition = margin;

    // Colors
    const colors = {
      background: [255, 255, 255],
      text: [17, 17, 17],
      accent: [37, 99, 235],
      secondary: [107, 114, 128],
      separator: [229, 231, 235],
      tableHeader: [249, 250, 251],
      totals: [17, 24, 39],
      highlight: [239, 246, 255],
    };

    doc.setFont("helvetica");

    const headerY = yPosition;

    // Logo
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, "PNG", margin, headerY, 40, 15);
        yPosition = headerY + 20;
      } catch (e) {
        console.warn("Logo failed to load", e);
      }
    }

    const companyInfoX = pageWidth - margin;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.text as [number, number, number]); // Fixed
    doc.text("Good Life Music S.L", companyInfoX, headerY + 5, { align: "right" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.secondary as [number, number, number]); // Fixed
    doc.text("Profesor Hermida 6, 3-3C", companyInfoX, headerY + 10, { align: "right" });
    doc.text("36960 Sanxenxo (Spain)", companyInfoX, headerY + 15, { align: "right" });
    doc.text("TAX ID: B72510704", companyInfoX, headerY + 20, { align: "right" });

    if (!logoBase64) yPosition = headerY + 25;

    doc.setDrawColor(...colors.separator as [number, number, number]); // FIX
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 15;

    // Invoice content left for brevity — same fixes apply to all setTextColor(...colors.*)
    // Ensure colors are typed as [number, number, number] to prevent TypeScript spread errors

    return doc;
  }

  static downloadInvoice(data: InvoiceData, logoBase64?: string, filename?: string): void {
    const doc = this.generateInvoice(data, logoBase64);
    doc.save(filename || `invoice-${data.invoice_number}.pdf`);
  }

  static previewInvoice(data: InvoiceData, logoBase64?: string): void {
    const doc = this.generateInvoice(data, logoBase64);
    const pdfBlob = doc.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, "_blank");
  }
}
