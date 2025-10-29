/**
 * Payment Receipt Data API
 * GET /api/payment/receipt
 * 
 * Returns detailed receipt data for PDF generation
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/authHelpers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface RoyaltyItem {
  id: string;
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
  success: boolean;
  receipt?: {
    receipt_number: string;
    payment_request_id: string;
    artist_id: string;
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
  };
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<ReceiptData>> {
  try {
    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please login." },
        { status: 401 }
      );
    }

    // Get payment request ID from query params
    const { searchParams } = new URL(request.url);
    const paymentRequestId = searchParams.get("payment_request_id");

    if (!paymentRequestId) {
      return NextResponse.json(
        { success: false, error: "Missing payment_request_id parameter" },
        { status: 400 }
      );
    }

    // Fetch payment request with details
    const { data: paymentRequest, error: prError } = await supabaseAdmin
      .from("payment_requests_detailed")
      .select("*")
      .eq("id", paymentRequestId)
      .single();

    if (prError || !paymentRequest) {
      console.error("Error fetching payment request:", prError);
      return NextResponse.json(
        { success: false, error: "Payment request not found" },
        { status: 404 }
      );
    }

    // Check authorization
    if (user.role !== "admin" && paymentRequest.artist_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "You don't have permission to view this receipt" },
        { status: 403 }
      );
    }

    // Fetch associated royalties
    const { data: royalties, error: royaltiesError } = await supabaseAdmin
      .from("royalties")
      .select("*")
      .eq("payment_request_id", paymentRequestId)
      .order("broadcast_date", { ascending: false });

    if (royaltiesError) {
      console.error("Error fetching royalties:", royaltiesError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch royalty details" },
        { status: 500 }
      );
    }

    // Calculate totals
    const totals = (royalties || []).reduce(
      (acc, royalty) => {
        acc.total_gross += parseFloat(royalty.gross_amount || "0");
        acc.total_admin_fee += parseFloat(royalty.gross_amount || "0") * (parseFloat(royalty.admin_percent || "0") / 100);
        acc.total_net += parseFloat(royalty.net_amount || "0");
        acc.royalty_count += 1;
        return acc;
      },
      {
        total_gross: 0,
        total_admin_fee: 0,
        total_net: 0,
        royalty_count: 0,
      }
    );

    // Fetch receipt number if exists
    const { data: receiptData } = await supabaseAdmin
      .from("payment_receipts")
      .select("receipt_number")
      .eq("payment_request_id", paymentRequestId)
      .single();

    return NextResponse.json(
      {
        success: true,
        receipt: {
          receipt_number: receiptData?.receipt_number || "PENDING",
          payment_request_id: paymentRequest.id,
          artist_id: paymentRequest.artist_id,
          artist_email: paymentRequest.artist_email,
          total_amount: parseFloat(paymentRequest.total_amount),
          status: paymentRequest.status,
          created_at: paymentRequest.created_at,
          approved_at: paymentRequest.approved_at,
          approved_by_email: paymentRequest.approved_by_email,
          royalties: (royalties || []).map((r) => ({
            id: r.id,
            track_title: r.track_title || "Unknown",
            usage_count: r.usage_count || 0,
            gross_amount: parseFloat(r.gross_amount || "0"),
            admin_percent: parseFloat(r.admin_percent || "0"),
            net_amount: parseFloat(r.net_amount || "0"),
            broadcast_date: r.broadcast_date || "",
            platform: r.platform || "",
            territory: r.territory || "",
          })),
          totals,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unexpected error in receipt API:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}



