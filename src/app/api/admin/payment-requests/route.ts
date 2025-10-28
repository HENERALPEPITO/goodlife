/**
 * Admin Payment Requests Management API
 * GET/POST /api/admin/payment-requests
 * 
 * Allows admins to view and manage payment requests
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authHelpers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
    // Verify admin access
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const artistId = searchParams.get("artist_id");

    // Build query
    let query = supabaseAdmin
      .from("payment_requests_detailed")
      .select("*")
      .order("created_at", { ascending: false });

    // Apply filters
    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (artistId) {
      query = query.eq("artist_id", artistId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching payment requests:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch payment requests" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        paymentRequests: data as PaymentRequestDetailed[],
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
    // Verify admin access
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

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
    const updateData: any = {
      status,
      remarks: remarks || null,
      approved_by: admin.id,
      approved_at: new Date().toISOString(),
    };

    const { data: paymentRequest, error: updateError } = await supabaseAdmin
      .from("payment_requests")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError || !paymentRequest) {
      console.error("Error updating payment request:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update payment request" },
        { status: 500 }
      );
    }

    // If approved, mark royalties as paid and create receipt
    if (status === "approved" || status === "paid") {
      // Mark royalties as paid
      await supabaseAdmin.rpc("mark_royalties_paid", {
        request_uuid: id,
      });

      // Generate receipt number
      const { data: receiptNumber } = await supabaseAdmin
        .rpc("generate_receipt_number");

      // Create payment receipt
      await supabaseAdmin.from("payment_receipts").insert({
        payment_request_id: paymentRequest.id,
        artist_id: paymentRequest.artist_id,
        total_amount: paymentRequest.total_amount,
        receipt_number: receiptNumber,
      });
    }

    // If rejected, reset royalties to unpaid
    if (status === "rejected") {
      await supabaseAdmin
        .from("royalties")
        .update({
          paid_status: "unpaid",
          payment_request_id: null,
        })
        .eq("payment_request_id", id);
    }

    // Fetch updated detailed data
    const { data: detailed } = await supabaseAdmin
      .from("payment_requests_detailed")
      .select("*")
      .eq("id", id)
      .single();

    return NextResponse.json(
      {
        success: true,
        paymentRequest: detailed as PaymentRequestDetailed,
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

