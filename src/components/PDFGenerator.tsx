/**
 * PDF Generator Component
 * Generates payment receipt PDFs using jsPDF
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
      `$${royalty.gross_amount.toFixed(2)}`,
      `${royalty.admin_percent.toFixed(1)}%`,
      `$${royalty.net_amount.toFixed(2)}`,
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
    doc.text(`$${data.totals.total_gross.toFixed(2)}`, totalsX + 60, yPosition, {
      align: "right",
    });

    yPosition += 6;
    doc.text("Total Admin Fee:", totalsX, yPosition);
    doc.text(`$${data.totals.total_admin_fee.toFixed(2)}`, totalsX + 60, yPosition, {
      align: "right",
    });

    yPosition += 6;
    doc.setLineWidth(0.3);
    doc.line(totalsX, yPosition, totalsX + 60, yPosition);

    yPosition += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Net Payable Amount:", totalsX, yPosition);
    doc.text(`$${data.totals.total_net.toFixed(2)}`, totalsX + 60, yPosition, {
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
}



