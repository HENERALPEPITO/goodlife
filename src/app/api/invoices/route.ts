/**
 * Invoices API
 * GET /api/invoices?payment_request_id=xxx
 * Gets invoice by payment_request_id
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getCurrentUser } from "@/lib/authHelpers";

export async function GET(request: NextRequest) {
  try {
    // Get current user - try headers first, then cookies
    let user = null;
    
    // Try to get user from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const supabase = getSupabaseAdmin();
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (!authError && authUser) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("id, role, email")
          .eq("id", authUser.id)
          .single();
        
        if (profile) {
          user = {
            id: profile.id,
            role: profile.role,
            email: profile.email,
          };
        }
      }
    }
    
    // If no user from header, try cookies
    if (!user) {
      user = await getCurrentUser(request.headers);
    }
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please login." },
        { status: 401 }
      );
    }

    const adminClient = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const paymentRequestId = searchParams.get("payment_request_id");

    if (!paymentRequestId) {
      return NextResponse.json(
        { success: false, error: "Missing payment_request_id parameter" },
        { status: 400 }
      );
    }

    // Get invoice by payment_request_id
    const { data: invoiceData, error } = await adminClient
      .from("invoices")
      .select("*")
      .eq("payment_request_id", paymentRequestId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching invoice:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch invoice" },
        { status: 500 }
      );
    }

    // If invoice doesn't exist, try to generate it from payment request
    let finalInvoice = invoiceData;
    if (!finalInvoice) {
      // Get payment request
      const { data: paymentRequest } = await adminClient
        .from("payment_requests")
        .select("*")
        .eq("id", paymentRequestId)
        .single();

      if (!paymentRequest) {
        return NextResponse.json(
          { success: false, error: "Payment request not found" },
          { status: 404 }
        );
      }

      // Check authorization
      if (user.role !== "admin") {
        const { data: artist } = await adminClient
          .from("artists")
          .select("user_id")
          .eq("id", paymentRequest.artist_id)
          .single();

        if (!artist || artist.user_id !== user.id) {
          return NextResponse.json(
            { success: false, error: "You don't have permission to view this invoice" },
            { status: 403 }
          );
        }
      }

      // Generate invoice number
      const year = new Date().getFullYear();
      const autoId = paymentRequest.id.substring(0, 8).toUpperCase();
      const invoiceNumber = `INV-${year}-${autoId}`;

      // Get artist info
      const { data: artist } = await adminClient
        .from("artists")
        .select("id, name, user_id")
        .eq("id", paymentRequest.artist_id)
        .single();

      if (!artist) {
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

      // Generate PDF invoice
      const { generatePaymentRequestInvoicePDF } = await import("@/lib/pdfGenerator");
      const { getInvoiceSettingsAdmin } = await import("@/lib/invoiceSettings");
      const invoiceSettings = await getInvoiceSettingsAdmin();

      const invoiceDate = new Date(paymentRequest.created_at).toISOString().split("T")[0];

      const pdfInvoiceData = {
        id: paymentRequest.id,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        artist_name: artist.name || "Artist",
        artist_email: artistEmail,
        total_net: Number(paymentRequest.amount || 0),
        status: paymentRequest.status as "pending" | "approved" | "rejected",
        payment_request_id: paymentRequest.id,
      };

      const pdfDoc = await generatePaymentRequestInvoicePDF(pdfInvoiceData, {
        settings: invoiceSettings,
      });

      // Convert PDF to buffer
      const pdfArrayBuffer = pdfDoc.output("arraybuffer");
      const pdfBuffer = Buffer.from(pdfArrayBuffer);

      // Upload PDF to storage
      const fileName = `invoices/${paymentRequest.artist_id}/${invoiceNumber}.pdf`;
      let publicUrl = "";
      
      try {
        const { error: uploadError } = await adminClient.storage
          .from("invoices")
          .upload(fileName, pdfBuffer, {
            contentType: "application/pdf",
            upsert: true,
          });

        if (!uploadError) {
          const {
            data: { publicUrl: url },
          } = adminClient.storage.from("invoices").getPublicUrl(fileName);
          publicUrl = url;
        }
      } catch (error) {
        console.error("Error uploading PDF:", error);
      }

      // Create invoice record
      const { data: newInvoice, error: invoiceError } = await adminClient
        .from("invoices")
        .insert({
          artist_id: paymentRequest.artist_id,
          payment_request_id: paymentRequest.id,
          amount: paymentRequest.amount,
          invoice_number: invoiceNumber,
          mode_of_payment: "Bank Transfer",
          status: paymentRequest.status,
          file_url: publicUrl,
        })
        .select()
        .single();

      if (invoiceError || !newInvoice) {
        console.error("Error creating invoice:", invoiceError);
        // Return a temporary invoice object
        return NextResponse.json(
          {
            success: true,
            invoice: {
              id: paymentRequest.id,
              artist_id: paymentRequest.artist_id,
              payment_request_id: paymentRequest.id,
              amount: paymentRequest.amount,
              invoice_number: invoiceNumber,
              mode_of_payment: "Bank Transfer",
              status: paymentRequest.status,
              file_url: publicUrl,
            },
          },
          { status: 200 }
        );
      }

      finalInvoice = newInvoice;
    }

    // Check authorization - artists can only view their own invoices
    if (user.role !== "admin") {
      // Get payment request to check artist_id
      const { data: paymentRequest } = await adminClient
        .from("payment_requests")
        .select("artist_id")
        .eq("id", paymentRequestId)
        .single();

      if (paymentRequest) {
        // Get artist record
        const { data: artist } = await adminClient
          .from("artists")
          .select("user_id")
          .eq("id", paymentRequest.artist_id)
          .single();

        if (!artist || artist.user_id !== user.id) {
          return NextResponse.json(
            { success: false, error: "You don't have permission to view this invoice" },
            { status: 403 }
          );
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        invoice: finalInvoice,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Unexpected error in GET invoices:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
