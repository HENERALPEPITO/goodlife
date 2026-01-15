/**
 * Payment Request API
 * POST /api/payment/request
 * Creates a payment request for an artist
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getInvoiceSettingsAdmin } from "@/lib/invoiceSettings";
import { generatePaymentRequestInvoicePDF } from "@/lib/pdfGenerator";
import { sendNewPaymentRequestEmailToAdmin } from "@/lib/emailService";

interface PaymentRequestBody {
  artist_id: string;
}

export async function POST(request: NextRequest) {
  try {
    const adminClient = getSupabaseAdmin();
    const body: PaymentRequestBody = await request.json();
    const { artist_id } = body;

    if (!artist_id) {
      return NextResponse.json(
        { success: false, error: "Missing required field: artist_id" },
        { status: 400 }
      );
    }

    // 1. Get total earnings from royalties_summary
    const { data: summaryData, error: summaryError } = await adminClient
      .from("royalties_summary")
      .select("total_net")
      .eq("artist_id", artist_id);

    if (summaryError) {
      console.error("Error getting royalties summary:", summaryError);
      return NextResponse.json(
        { success: false, error: "Failed to calculate royalties" },
        { status: 500 }
      );
    }

    // Sum all total_net from royalties_summary
    const totalEarnings = (summaryData || []).reduce(
      (sum, row) => sum + parseFloat(row.total_net || "0"),
      0
    );

    // Get already paid amounts from payment_requests
    const { data: paidRequests } = await adminClient
      .from("payment_requests")
      .select("amount")
      .eq("artist_id", artist_id)
      .eq("status", "paid");

    const paidAmount = (paidRequests || []).reduce(
      (sum, req) => sum + parseFloat(req.amount || "0"),
      0
    );

    // Available balance = total earnings - paid amounts
    const totalAmount = totalEarnings - paidAmount;

    console.log("[Payment Request] Artist ID:", artist_id);
    console.log("[Payment Request] Total earnings from royalties_summary:", totalEarnings);
    console.log("[Payment Request] Paid amount from payment_requests:", paidAmount);
    console.log("[Payment Request] Available balance (totalAmount):", totalAmount);

    // 2. Check if balance is at least $100
    if (totalAmount < 100) {
      return NextResponse.json(
        {
          success: false,
          error: `Balance must be at least $100. Current balance: $${totalAmount.toFixed(2)}`,
        },
        { status: 400 }
      );
    }

    // 3. Check if there's already a pending or approved request
    const { data: existingRequest, error: existingError } = await adminClient
      .from("payment_requests")
      .select("id")
      .eq("artist_id", artist_id)
      .in("status", ["pending", "approved"])
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error("Error checking existing request:", existingError);
      return NextResponse.json(
        { success: false, error: "Failed to check existing requests" },
        { status: 500 }
      );
    }

    if (existingRequest) {
      return NextResponse.json(
        {
          success: false,
          error: "You already have a pending or approved payment request",
        },
        { status: 400 }
      );
    }

    // 4. Get artist information
    const { data: artist, error: artistError } = await adminClient
      .from("artists")
      .select("id, name, user_id, address, tax_id")
      .eq("id", artist_id)
      .single();

    if (artistError || !artist) {
      return NextResponse.json(
        { success: false, error: "Artist not found" },
        { status: 404 }
      );
    }

    // Get user profile for email
    const { data: userProfile } = await adminClient
      .from("user_profiles")
      .select("email")
      .eq("id", artist.user_id)
      .single();

    const artistEmail = userProfile?.email || "";

    // 5. Create payment request
    const { data: paymentRequest, error: requestError } = await adminClient
      .from("payment_requests")
      .insert({
        artist_id: artist_id,
        amount: totalAmount,
        status: "pending",
      })
      .select()
      .single();

    if (requestError || !paymentRequest) {
      console.error("Error creating payment request:", requestError);
      return NextResponse.json(
        { success: false, error: "Failed to create payment request" },
        { status: 500 }
      );
    }

    // 6. Payment tracking is handled via payment_requests table
    // When status changes to 'paid', it's subtracted from available balance

    // 7. Generate invoice number: INV-[YEAR]-[AUTO_ID]
    const year = new Date().getFullYear();
    const autoId = paymentRequest.id.substring(0, 8).toUpperCase();
    const invoiceNumber = `INV-${year}-${autoId}`;

    // 8. Generate PDF invoice
    const invoiceSettings = await getInvoiceSettingsAdmin();
    const invoiceDate = new Date().toISOString().split("T")[0];

    const invoice = {
      id: paymentRequest.id,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      artist_name: artist.name || "Artist",
      artist_email: artistEmail,
      artist_address: artist.address || undefined,
      artist_tax_id: artist.tax_id || undefined,
      total_net: totalAmount,
      status: "pending" as const,
      payment_request_id: paymentRequest.id,
    };

    console.log("[Payment Request] Creating PDF with total_net:", totalAmount);
    console.log("[Payment Request] Payment request amount:", paymentRequest.amount);

    const pdfDoc = await generatePaymentRequestInvoicePDF(invoice, {
      settings: invoiceSettings,
    });

    // Convert PDF to buffer (server-side compatible)
    const pdfArrayBuffer = pdfDoc.output("arraybuffer");
    const pdfBuffer = Buffer.from(pdfArrayBuffer);

    // 9. Upload PDF to Supabase Storage
    // Note: Make sure the "invoices" storage bucket exists in Supabase
    const fileName = `invoices/${artist_id}/${invoiceNumber}.pdf`;
    let publicUrl = "";
    
    try {
      const { error: uploadError } = await adminClient.storage
        .from("invoices")
        .upload(fileName, pdfBuffer, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) {
        console.error("Error uploading PDF:", uploadError);
        // Continue even if upload fails - we can regenerate later
      } else {
        // Get public URL for the PDF
        const {
          data: { publicUrl: url },
        } = adminClient.storage.from("invoices").getPublicUrl(fileName);
        publicUrl = url;
      }
    } catch (error) {
      console.error("Error with storage:", error);
      // Continue without storage URL
    }

    // 10. Create invoice record
    const { error: invoiceError } = await adminClient.from("invoices").insert({
      artist_id: artist_id,
      payment_request_id: paymentRequest.id,
      amount: totalAmount,
      invoice_number: invoiceNumber,
      mode_of_payment: "Bank Transfer",
      status: "pending",
      file_url: publicUrl,
    });

    if (invoiceError) {
      console.error("Error creating invoice record:", invoiceError);
      // Continue - invoice record is optional
    }

    // 11. Send email notification to admin
    try {
      const requestDate = new Date(paymentRequest.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      await sendNewPaymentRequestEmailToAdmin({
        artistName: artist.name || "Artist",
        artistEmail: artistEmail,
        amount: totalAmount,
        invoiceNumber: invoiceNumber,
        requestDate: requestDate,
        pdfBuffer: pdfBuffer,
      });
    } catch (emailError) {
      console.error("Error sending admin notification email:", emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json(
      {
        success: true,
        payment_request: paymentRequest,
        invoice_number: invoiceNumber,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unexpected error in payment request:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
