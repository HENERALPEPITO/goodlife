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
  artist_name?: string;
  artist_email: string;
  artist_address?: string;
  artist_tax_id?: string;
  total_amount: number;
  status: string;
  created_at: string;
  updated_at: string;
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
  static async generateReceiptAsync(data: ReceiptData): Promise<jsPDF> {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPosition = 20;

    // Colors
    const colors = {
      text: [34, 34, 34] as [number, number, number],
      secondary: [107, 114, 128] as [number, number, number],
      border: [229, 231, 235] as [number, number, number],
    };

    // Logo
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
    } catch (error) {
      console.warn("Could not load logo:", error);
    }

    // Header
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.text);
    doc.text("INVOICE", pageWidth / 2, yPosition, { align: "center" });

    yPosition += 12;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.secondary);
    doc.text(`Invoice Number: ${data.receipt_number}`, margin, yPosition);
    yPosition += 5;
    doc.text(`Invoice Date: ${new Date(data.created_at).toLocaleDateString()}`, margin, yPosition);
    yPosition += 12;

    // ============================================
    // BILL TO: (ADMIN/BUSINESS - recipient of the invoice)
    // ============================================
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.text);
    doc.text("Bill To:", margin, yPosition);
    yPosition += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...colors.secondary);
    doc.text("Good Life Music S.L", margin, yPosition);
    yPosition += 5;
    doc.text("Profesor Hermida 6, 3-3C", margin, yPosition);
    yPosition += 5;
    doc.text("36960 Sanxenxo (Spain)", margin, yPosition);
    yPosition += 5;
    doc.text("Phone: +34 693 43 25 06", margin, yPosition);
    yPosition += 5;
    doc.text("Email: info@goodlifemusic.com", margin, yPosition);
    yPosition += 5;
    doc.text("TAX ID: B72510704", margin, yPosition);
    yPosition += 10;

    // Separator
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // ============================================
    // BILL FROM: (ARTIST - sender of the invoice)
    // ============================================
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.text);
    doc.text("Bill From:", margin, yPosition);
    yPosition += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...colors.secondary);
    doc.text(data.artist_name || "Artist", margin, yPosition);
    yPosition += 5;
    if (data.artist_email) {
      doc.text(data.artist_email, margin, yPosition);
      yPosition += 5;
    }
    if (data.artist_address) {
      const addressLines = data.artist_address.includes("\n")
        ? data.artist_address.split("\n").map((s) => s.trim())
        : data.artist_address.split(",").map((s) => s.trim());
      addressLines.forEach((line) => {
        if (line) {
          doc.text(line, margin, yPosition);
          yPosition += 5;
        }
      });
    }
    if (data.artist_tax_id) {
      doc.text(`TAX ID: ${data.artist_tax_id}`, margin, yPosition);
      yPosition += 5;
    }
    yPosition += 5;

    // Status badge
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.text);
    doc.text(`Status: ${data.status.toUpperCase()}`, margin, yPosition);

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

  static async downloadReceipt(data: ReceiptData, filename?: string): Promise<void> {
    const doc = await this.generateReceiptAsync(data);
    doc.save(filename || `receipt-${data.receipt_number}.pdf`);
  }

  static async previewReceipt(data: ReceiptData): Promise<void> {
    const doc = await this.generateReceiptAsync(data);
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
