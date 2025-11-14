import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/authHelpers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  sendPaymentApprovedEmailToArtist,
  sendPaymentRejectedEmailToArtist,
} from "@/lib/emailService";

interface PaymentRequestDetailed {
  id: string;
  artist_id: string;
  artist_email: string;
  total_amount: number;
  status: string;
  remarks: string | null;
  royalty_count: number;
  created_at: string;
  updated_at: string;
  approved_by: string | null;
  approved_by_email: string | null;
  approved_at: string | null;
}

interface GetPaymentRequestsResponse {
  success: boolean;
  paymentRequests?: PaymentRequestDetailed[];
  error?: string;
}

interface UpdatePaymentRequestBody {
  id: string;
  status: "approved" | "rejected" | "paid";
  remarks?: string;
}

interface UpdatePaymentRequestResponse {
  success: boolean;
  paymentRequest?: PaymentRequestDetailed;
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<GetPaymentRequestsResponse>> {
  try {
    // Verify admin access with request headers
    const admin = await requireAdmin(request.headers);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    // Get admin client
    const adminClient = getSupabaseAdmin();

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const artistId = searchParams.get("artist_id");

    // Build query - fetch from payment_requests table directly
    let query = adminClient
      .from("payment_requests")
      .select("*")
      .order("created_at", { ascending: false });

    // Apply filters
    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (artistId) {
      query = query.eq("artist_id", artistId);
    }

    const { data: requests, error } = await query;

    if (error) {
      console.error("Error fetching payment requests:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch payment requests" },
        { status: 500 }
      );
    }

    if (!requests || requests.length === 0) {
      return NextResponse.json(
        {
          success: true,
          paymentRequests: [],
        },
        { status: 200 }
      );
    }

    // Fetch artist information for each request
    const artistIds = [...new Set(requests.map(r => r.artist_id).filter(Boolean))];
    const { data: artists } = await adminClient
      .from("artists")
      .select("id, name, email, user_id")
      .in("id", artistIds);

    if (!artists) {
      return NextResponse.json(
        {
          success: true,
          paymentRequests: [],
        },
        { status: 200 }
      );
    }

    // Get user profiles for each artist
    const userIds = artists.map(a => a.user_id).filter(Boolean);
    const { data: profiles } = await adminClient
      .from("user_profiles")
      .select("id, email")
      .in("id", userIds);

    // Create lookup maps
    const artistMap = new Map(artists.map(a => [a.id, a]));
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    // Count royalties for each request
    const detailedRequests = await Promise.all(
      requests.map(async (req) => {
        const artist = artistMap.get(req.artist_id);
        const profile = artist?.user_id ? profileMap.get(artist.user_id) : null;

        // Count royalties for this request (those marked as paid)
        const { count: royaltyCount } = await adminClient
          .from("royalties")
          .select("*", { count: "exact", head: true })
          .eq("artist_id", req.artist_id)
          .eq("is_paid", true);

        // Get approver info if exists
        let approverEmail = null;
        if (req.approved_by) {
          const { data: approver } = await adminClient
            .from("user_profiles")
            .select("email")
            .eq("id", req.approved_by)
            .single();
          approverEmail = approver?.email || null;
        }

        return {
          id: req.id,
          artist_id: req.artist_id,
          artist_email: profile?.email || artist?.email || "Unknown",
          total_amount: req.amount,
          status: req.status,
          remarks: req.remarks,
          royalty_count: royaltyCount || 0,
          created_at: req.created_at,
          updated_at: req.updated_at,
          approved_by: req.approved_by,
          approved_by_email: approverEmail,
          approved_at: req.approved_at,
        } as PaymentRequestDetailed;
      })
    );

    return NextResponse.json(
      {
        success: true,
        paymentRequests: detailedRequests,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Unexpected error in GET payment requests:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<UpdatePaymentRequestResponse>> {
  try {
    // Verify admin access with request headers
    const admin = await requireAdmin(request.headers);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    // Get admin client
    const adminClient = getSupabaseAdmin();

    // Parse request body
    const body: UpdatePaymentRequestBody = await request.json();
    const { id, status, remarks } = body;

    // Validation
    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: id, status" },
        { status: 400 }
      );
    }

    if (!["approved", "rejected", "paid"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "Invalid status. Must be 'approved', 'rejected', or 'paid'" },
        { status: 400 }
      );
    }

    // Update payment request
    // Build update data - try with approved_by/approved_at first, fallback if columns don't exist
    let updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    // Add remarks if provided
    if (remarks !== undefined) {
      updateData.remarks = remarks || null;
    }

    // Add approved_by and approved_at only if status is approved or rejected
    if (status === "approved" || status === "rejected") {
      updateData.approved_by = admin.id;
      updateData.approved_at = new Date().toISOString();
    }

    let paymentRequest: any = null;
    let updateError: any = null;

    // Try update with all fields
    const { data: updatedRequest, error: updateErr } = await adminClient
      .from("payment_requests")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    updateError = updateErr;
    paymentRequest = updatedRequest;

    // If error is about missing columns, try without approved_by/approved_at
    if (updateError && (updateError.message?.includes("column") || updateError.code === "42703" || updateError.message?.includes("approved_by") || updateError.message?.includes("approved_at"))) {
      console.warn("Columns approved_by/approved_at don't exist, updating without them");
      
      // Remove approved_by and approved_at and try again
      const fallbackData: any = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (remarks !== undefined) {
        fallbackData.remarks = remarks || null;
      }
      
      const { data: fallbackRequest, error: fallbackError } = await adminClient
        .from("payment_requests")
        .update(fallbackData)
        .eq("id", id)
        .select()
        .single();
      
      if (fallbackError || !fallbackRequest) {
        console.error("Error updating payment request (fallback):", fallbackError);
        return NextResponse.json(
          { 
            success: false, 
            error: `Failed to update payment request: ${fallbackError?.message || "Unknown error"}` 
          },
          { status: 500 }
        );
      }
      
      paymentRequest = fallbackRequest;
      updateError = null;
    }

    if (updateError || !paymentRequest) {
      console.error("Error updating payment request:", updateError);
      console.error("Update data:", JSON.stringify(updateData, null, 2));
      console.error("Payment request ID:", id);
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to update payment request: ${updateError?.message || "Unknown error"}` 
        },
        { status: 500 }
      );
    }

    // If approved, generate new PDF invoice with approved status
    if (status === "approved") {
      try {
        // Get artist info
        const { data: artist } = await adminClient
          .from("artists")
          .select("id, name, user_id")
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

          // Get existing invoice or create new one
          const { data: existingInvoice } = await adminClient
            .from("invoices")
            .select("*")
            .eq("payment_request_id", id)
            .maybeSingle();

          let invoiceNumber = existingInvoice?.invoice_number;
          if (!invoiceNumber) {
            // Generate invoice number: INV-[YEAR]-[AUTO_ID]
            const year = new Date().getFullYear();
            const autoId = paymentRequest.id.substring(0, 8).toUpperCase();
            invoiceNumber = `INV-${year}-${autoId}`;
          }

          // Generate approved PDF invoice
          const { generatePaymentRequestInvoicePDF } = await import("@/lib/pdfGenerator");
          const { getInvoiceSettingsAdmin } = await import("@/lib/invoiceSettings");
          const invoiceSettings = await getInvoiceSettingsAdmin();

          const invoiceDate = existingInvoice?.created_at
            ? new Date(existingInvoice.created_at).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0];

          const invoice = {
            id: paymentRequest.id,
            invoice_number: invoiceNumber,
            invoice_date: invoiceDate,
            artist_name: artist.name || "Artist",
            artist_email: artistEmail,
            total_net: paymentRequest.amount,
            status: "approved" as const,
            payment_request_id: paymentRequest.id,
          };

          const pdfDoc = await generatePaymentRequestInvoicePDF(invoice, {
            settings: invoiceSettings,
          });

          // Convert PDF to buffer (server-side compatible)
          const pdfArrayBuffer = pdfDoc.output("arraybuffer");
          const pdfBuffer = Buffer.from(pdfArrayBuffer);

          const fileName = `invoices/${paymentRequest.artist_id}/${invoiceNumber}.pdf`;
          const { error: uploadError } = await adminClient.storage
            .from("invoices")
            .upload(fileName, pdfBuffer, {
              contentType: "application/pdf",
              upsert: true,
            });

          if (uploadError) {
            console.error("Error uploading PDF:", uploadError);
          }

          // Get public URL
          const {
            data: { publicUrl },
          } = adminClient.storage.from("invoices").getPublicUrl(fileName);

          // Update or create invoice record
          if (existingInvoice) {
            await adminClient
              .from("invoices")
              .update({
                status: "approved",
                file_url: publicUrl,
              })
              .eq("id", existingInvoice.id);
          } else {
            await adminClient.from("invoices").insert({
              artist_id: paymentRequest.artist_id,
              payment_request_id: id,
              amount: paymentRequest.amount,
              invoice_number: invoiceNumber,
              mode_of_payment: "Bank Transfer",
              status: "approved",
              file_url: publicUrl,
            });
          }
        }
      } catch (error) {
        console.error("Error generating approved invoice PDF:", error);
        // Continue even if PDF generation fails
      }
    }

    // If rejected, restore balance by calling database function
    if (status === "rejected") {
      const { error: restoreError } = await adminClient.rpc("restore_royalties_on_rejection", {
        request_uuid: id,
      });

      if (restoreError) {
        console.error("Error restoring royalties:", restoreError);
      }
    }

    // Get artist details for response
    const { data: artist } = await adminClient
      .from("artists")
      .select("id, name, email, user_id")
      .eq("id", paymentRequest.artist_id)
      .single();

    let artistEmail = "Unknown";
    if (artist?.user_id) {
      const { data: profile } = await adminClient
        .from("user_profiles")
        .select("email")
        .eq("id", artist.user_id)
        .single();
      artistEmail = profile?.email || artist.email || "Unknown";
    }

    // Send email notification for approval or rejection
    if ((status === "approved" || status === "rejected") && artistEmail !== "Unknown") {
      try {
        // Get invoice details for the email
        const { data: invoice } = await adminClient
          .from("invoices")
          .select("invoice_number")
          .eq("payment_request_id", id)
          .maybeSingle();

        const invoiceNumber = invoice?.invoice_number || `INV-${new Date().getFullYear()}-${paymentRequest.id.substring(0, 8).toUpperCase()}`;

        // Try to fetch PDF from storage for attachment
        let pdfBuffer: Buffer | undefined;
        try {
          const fileName = `invoices/${paymentRequest.artist_id}/${invoiceNumber}.pdf`;
          const { data: pdfData, error: downloadError } = await adminClient.storage
            .from("invoices")
            .download(fileName);

          if (!downloadError && pdfData) {
            pdfBuffer = Buffer.from(await pdfData.arrayBuffer());
          }
        } catch (error) {
          console.error("Error fetching PDF for email:", error);
          // Continue without PDF attachment
        }

        if (status === "approved") {
          const approvalDate = new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });

          await sendPaymentApprovedEmailToArtist({
            artistName: artist?.name || "Artist",
            artistEmail: artistEmail,
            amount: paymentRequest.amount,
            invoiceNumber: invoiceNumber,
            approvalDate: approvalDate,
            pdfBuffer: pdfBuffer,
          });
        } else if (status === "rejected") {
          await sendPaymentRejectedEmailToArtist({
            artistName: artist?.name || "Artist",
            artistEmail: artistEmail,
            amount: paymentRequest.amount,
            invoiceNumber: invoiceNumber,
            pdfBuffer: pdfBuffer,
          });
        }
      } catch (emailError) {
        console.error("Error sending payment status email:", emailError);
        // Don't fail the request if email fails
      }
    }

    // Count royalties
    const { count: royaltyCount } = await adminClient
      .from("royalties")
      .select("*", { count: "exact", head: true })
      .eq("artist_id", paymentRequest.artist_id)
      .eq("is_paid", true);

    // Get approver email
    let approverEmail = null;
    if (paymentRequest.approved_by) {
      const { data: approver } = await adminClient
        .from("user_profiles")
        .select("email")
        .eq("id", paymentRequest.approved_by)
        .single();
      approverEmail = approver?.email || null;
    }

    const detailed: PaymentRequestDetailed = {
      id: paymentRequest.id,
      artist_id: paymentRequest.artist_id,
      artist_email: artistEmail,
      total_amount: paymentRequest.amount,
      status: paymentRequest.status,
      remarks: paymentRequest.remarks,
      royalty_count: royaltyCount || 0,
      created_at: paymentRequest.created_at,
      updated_at: paymentRequest.updated_at,
      approved_by: paymentRequest.approved_by,
      approved_by_email: approverEmail,
      approved_at: paymentRequest.approved_at,
    };

    return NextResponse.json(
      {
        success: true,
        paymentRequest: detailed,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unexpected error in POST payment requests:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}