import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/authHelpers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  sendPaymentApprovedEmailToArtist,
  sendPaymentRejectedEmailToArtist,
} from "@/lib/emailService";
import {
  notifyPaymentApproved,
  notifyPaymentRejected,
  notifyPaymentPaid,
} from "@/lib/notificationService";

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

    // Count royalties and calculate amounts for each request
    const detailedRequests = await Promise.all(
      requests.map(async (req) => {
        const artist = artistMap.get(req.artist_id);
        const profile = artist?.user_id ? profileMap.get(artist.user_id) : null;

        // Get summary data from royalties_summary for record count
        const { data: summaryData, count: royaltyCount } = await adminClient
          .from("royalties_summary")
          .select("record_count, total_net", { count: "exact" })
          .eq("artist_id", req.artist_id);

        // Sum up record_count from all summary records
        const totalRecordCount = (summaryData || []).reduce(
          (sum, row) => sum + (row.record_count || 0), 0
        );

        // If the stored amount is 0, recalculate from royalties_summary
        let totalAmount = parseFloat(req.amount || "0");
        if (totalAmount === 0 && summaryData && summaryData.length > 0) {
          // Calculate total earnings from royalties_summary
          const totalEarnings = summaryData.reduce(
            (sum, row) => sum + parseFloat(row.total_net || "0"), 0
          );

          // Get already paid amounts from other payment requests
          const { data: paidRequests } = await adminClient
            .from("payment_requests")
            .select("amount")
            .eq("artist_id", req.artist_id)
            .eq("status", "paid")
            .neq("id", req.id); // Exclude current request

          const paidAmount = (paidRequests || []).reduce(
            (sum, pr) => sum + parseFloat(pr.amount || "0"), 0
          );

          totalAmount = totalEarnings - paidAmount;

          // Update the payment request with the correct amount
          if (totalAmount > 0) {
            await adminClient
              .from("payment_requests")
              .update({ amount: totalAmount })
              .eq("id", req.id);

            // Also update the invoice if it exists
            await adminClient
              .from("invoices")
              .update({ amount: totalAmount })
              .eq("payment_request_id", req.id);
          }
        }

        return {
          id: req.id,
          artist_id: req.artist_id,
          artist_email: profile?.email || artist?.email || "Unknown",
          total_amount: totalAmount,
          status: req.status,
          remarks: req.remarks,
          royalty_count: totalRecordCount || royaltyCount || 0,
          created_at: req.created_at,
          updated_at: req.updated_at,
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
    const admin = await requireAdmin(request.headers);
    if (!admin) {
      return NextResponse.json({ success: false, error: "Unauthorized. Admin access required." }, { status: 403 });
    }

    const adminClient = getSupabaseAdmin();
    const body: UpdatePaymentRequestBody = await request.json();
    const { id, status, remarks } = body;

    if (!id || !status) {
      return NextResponse.json({ success: false, error: "Missing required fields: id, status" }, { status: 400 });
    }

    if (!["approved", "rejected", "paid"].includes(status)) {
      return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
    }

    const updateData: any = { status, updated_at: new Date().toISOString() };
    if (remarks !== undefined) updateData.remarks = remarks || null;

    const { data: paymentRequest, error: updateError } = await adminClient
      .from("payment_requests")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError || !paymentRequest) {
      console.error("Error updating payment request:", updateError);
      const errorMessage = updateError?.message || (paymentRequest ? "Unknown error" : "Payment request not found");
      return NextResponse.json({ success: false, error: `Failed to update payment request: ${errorMessage}` }, { status: 500 });
    }

    // If approved, generate PDF and recalculate amount if needed
    if (status === "approved") {
      try {
        const { data: artist } = await adminClient.from("artists").select("id, name, user_id, address, tax_id").eq("id", paymentRequest.artist_id).single();

        if (artist) {
          const { data: userProfile } = await adminClient.from("user_profiles").select("email").eq("id", artist.user_id).single();
          const artistEmail = userProfile?.email || "";

          const { data: existingInvoice } = await adminClient.from("invoices").select("*").eq("payment_request_id", id).maybeSingle();

          let invoiceNumber = existingInvoice?.invoice_number;
          if (!invoiceNumber) {
            invoiceNumber = `INV-${new Date().getFullYear()}-${paymentRequest.id.substring(0, 8).toUpperCase()}`;
          }

          // Recalculate amount from royalties_summary if 0
          let approvedAmount = Number(paymentRequest.amount || 0);
          if (approvedAmount === 0) {
            const { data: summaryData } = await adminClient.from("royalties_summary").select("total_net").eq("artist_id", paymentRequest.artist_id);
            const totalEarnings = (summaryData || []).reduce((sum: number, row: any) => sum + parseFloat(row.total_net || "0"), 0);
            const { data: paidRequests } = await adminClient.from("payment_requests").select("amount").eq("artist_id", paymentRequest.artist_id).eq("status", "paid").neq("id", id);
            const paidAmount = (paidRequests || []).reduce((sum: number, pr: any) => sum + parseFloat(pr.amount || "0"), 0);
            approvedAmount = totalEarnings - paidAmount;
            if (approvedAmount > 0) {
              await adminClient.from("payment_requests").update({ amount: approvedAmount }).eq("id", id);
            }
          }

          const { generatePaymentRequestInvoicePDF } = await import("@/lib/pdfGenerator");
          const { getInvoiceSettingsAdmin } = await import("@/lib/invoiceSettings");
          const invoiceSettings = await getInvoiceSettingsAdmin();

          const pdfDoc = await generatePaymentRequestInvoicePDF({
            id: paymentRequest.id,
            invoice_number: invoiceNumber,
            invoice_date: new Date().toISOString().split("T")[0],
            artist_name: artist.name || "Artist",
            artist_email: artistEmail,
            artist_address: artist.address || undefined,
            artist_tax_id: artist.tax_id || undefined,
            total_net: approvedAmount,
            status: "approved",
            payment_request_id: paymentRequest.id,
          }, { settings: invoiceSettings });

          const pdfBuffer = Buffer.from(pdfDoc.output("arraybuffer"));
          const fileName = `invoices/${paymentRequest.artist_id}/${invoiceNumber}.pdf`;
          await adminClient.storage.from("invoices").upload(fileName, pdfBuffer, { contentType: "application/pdf", upsert: true });
          const { data: { publicUrl } } = adminClient.storage.from("invoices").getPublicUrl(fileName);

          if (existingInvoice) {
            await adminClient.from("invoices").update({ status: "approved", file_url: publicUrl, amount: approvedAmount }).eq("id", existingInvoice.id);
          } else {
            await adminClient.from("invoices").insert({ artist_id: paymentRequest.artist_id, payment_request_id: id, amount: approvedAmount, invoice_number: invoiceNumber, mode_of_payment: "Bank Transfer", status: "approved", file_url: publicUrl });
          }
        }
      } catch (err) {
        console.error("Error generating approved invoice PDF:", err);
      }
    }

    // Get artist details for response
    const { data: artist } = await adminClient.from("artists").select("id, name, email, user_id").eq("id", paymentRequest.artist_id).single();
    let artistEmail = "Unknown";
    if (artist?.user_id) {
      const { data: profile } = await adminClient.from("user_profiles").select("email").eq("id", artist.user_id).single();
      artistEmail = profile?.email || artist.email || "Unknown";
    }

    // Send email and create notifications based on status
    if (artist && artistEmail !== "Unknown") {
      const { data: invoice } = await adminClient.from("invoices").select("invoice_number").eq("payment_request_id", id).maybeSingle();
      const invoiceNumber = invoice?.invoice_number || `INV-${new Date().getFullYear()}-${paymentRequest.id.substring(0, 8).toUpperCase()}`;
      const amount = Number(paymentRequest.amount || 0);

      if (status === "approved") {
        try {
          await sendPaymentApprovedEmailToArtist({
            artistName: artist.name || "Artist",
            artistEmail: artistEmail,
            amount: amount,
            invoiceNumber: invoiceNumber,
            approvalDate: new Date().toLocaleDateString(),
          });
          console.log("Approval email sent to:", artistEmail);
        } catch (emailErr) {
          console.error("Error sending approval email:", emailErr);
        }
        try {
          await notifyPaymentApproved(paymentRequest.artist_id, amount, invoiceNumber);
          console.log("Approval notification created");
        } catch (notifErr) {
          console.error("Error creating approval notification:", notifErr);
        }
      } else if (status === "rejected") {
        try {
          await sendPaymentRejectedEmailToArtist({
            artistName: artist.name || "Artist",
            artistEmail: artistEmail,
            amount: amount,
            invoiceNumber: invoiceNumber,
          });
          console.log("Rejection email sent to:", artistEmail);
        } catch (emailErr) {
          console.error("Error sending rejection email:", emailErr);
        }
        try {
          await notifyPaymentRejected(paymentRequest.artist_id, amount, invoiceNumber);
          console.log("Rejection notification created");
        } catch (notifErr) {
          console.error("Error creating rejection notification:", notifErr);
        }
      } else if (status === "paid") {
        try {
          await notifyPaymentPaid(paymentRequest.artist_id, amount, invoiceNumber);
          console.log("Payment notification created");
        } catch (notifErr) {
          console.error("Error creating payment notification:", notifErr);
        }
      }
    }

    // Get royalty count from royalties_summary
    const { data: summaryCount } = await adminClient.from("royalties_summary").select("record_count").eq("artist_id", paymentRequest.artist_id);
    const royaltyCount = (summaryCount || []).reduce((sum: number, r: any) => sum + (r.record_count || 0), 0);

    const detailed: PaymentRequestDetailed = {
      id: paymentRequest.id,
      artist_id: paymentRequest.artist_id,
      artist_email: artistEmail,
      total_amount: paymentRequest.amount,
      status: paymentRequest.status,
      remarks: paymentRequest.remarks,
      royalty_count: royaltyCount,
      created_at: paymentRequest.created_at,
      updated_at: paymentRequest.updated_at,
    };

    return NextResponse.json({ success: true, paymentRequest: detailed }, { status: 200 });
  } catch (error) {
    console.error("Unexpected error in POST payment requests:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}