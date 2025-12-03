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
      user = await getCurrentUser();
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
        .select("id, name, user_id, address, tax_id")
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
        artist_address: artist.address || undefined,
        artist_tax_id: artist.tax_id || undefined,
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

    // If invoice exists but has no file_url, generate and upload PDF
    if (finalInvoice && !finalInvoice.file_url) {
      try {
        // Get payment request
        const { data: paymentRequest } = await adminClient
          .from("payment_requests")
          .select("*")
          .eq("id", paymentRequestId)
          .single();

        if (paymentRequest) {
          // Get artist info
          const { data: artist } = await adminClient
            .from("artists")
            .select("id, name, user_id, address, tax_id")
            .eq("id", paymentRequest.artist_id)
            .single();

          if (artist) {
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
            const invoiceNumber = finalInvoice.invoice_number || `INV-${new Date().getFullYear()}-${paymentRequest.id.substring(0, 8).toUpperCase()}`;

            const pdfInvoiceData = {
              id: paymentRequest.id,
              invoice_number: invoiceNumber,
              invoice_date: invoiceDate,
              artist_name: artist.name || "Artist",
              artist_email: artistEmail,
              artist_address: artist.address || undefined,
              artist_tax_id: artist.tax_id || undefined,
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

                // Update invoice with file_url
                await adminClient
                  .from("invoices")
                  .update({ file_url: publicUrl })
                  .eq("id", finalInvoice.id);

                finalInvoice.file_url = publicUrl;
              }
            } catch (error) {
              console.error("Error uploading PDF:", error);
            }
          }
        }
      } catch (error) {
        console.error("Error generating PDF for existing invoice:", error);
        // Continue even if PDF generation fails
      }
    }

    // Get payment request to fetch artist details
    const { data: paymentRequest } = await adminClient
      .from("payment_requests")
      .select("artist_id, amount, created_at")
      .eq("id", paymentRequestId)
      .single();

    let artistDetails = {
      artist_name: "Artist",
      artist_email: "",
      artist_address: undefined as string | undefined,
      artist_tax_id: undefined as string | undefined,
    };

    if (paymentRequest) {
      // Get artist record with full details
      const { data: artist } = await adminClient
        .from("artists")
        .select("id, name, user_id, address, tax_id")
        .eq("id", paymentRequest.artist_id)
        .single();

      // Check authorization - artists can only view their own invoices
      if (user.role !== "admin") {
        if (!artist || artist.user_id !== user.id) {
          return NextResponse.json(
            { success: false, error: "You don't have permission to view this invoice" },
            { status: 403 }
          );
        }
      }

      if (artist) {
        // Get user profile for email
        const { data: userProfile } = await adminClient
          .from("user_profiles")
          .select("email")
          .eq("id", artist.user_id)
          .single();

        artistDetails = {
          artist_name: artist.name || "Artist",
          artist_email: userProfile?.email || "",
          artist_address: artist.address || undefined,
          artist_tax_id: artist.tax_id || undefined,
        };
      }
    }

    // Include artist details in the response
    const invoiceWithArtist = {
      ...finalInvoice,
      ...artistDetails,
      invoice_date: paymentRequest?.created_at ? new Date(paymentRequest.created_at).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      total_net: Number(finalInvoice?.amount || paymentRequest?.amount || 0),
    };

    return NextResponse.json(
      {
        success: true,
        invoice: invoiceWithArtist,
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
