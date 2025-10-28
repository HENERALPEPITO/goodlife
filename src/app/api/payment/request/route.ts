/**
 * Artist Payment Request API
 * POST /api/payment/request
 * 
 * Allows artists to request payment for their unpaid royalties
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getCurrentUser } from "@/lib/authHelpers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface PaymentRequestResponse {
  success: boolean;
  paymentRequest?: {
    id: string;
    total_amount: number;
    royalty_count: number;
  };
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<PaymentRequestResponse>> {
  try {
    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please login." },
        { status: 401 }
      );
    }

    // Artists can only create requests for themselves
    // Admins can create requests on behalf of artists (optional)
    const artistId = user.id;

    // Get total unpaid royalties for this artist
    const { data: totalData, error: totalError } = await supabaseAdmin
      .rpc("get_unpaid_royalties_total", { artist_uuid: artistId });

    if (totalError) {
      console.error("Error calculating unpaid royalties:", totalError);
      return NextResponse.json(
        { success: false, error: "Failed to calculate unpaid royalties" },
        { status: 500 }
      );
    }

    const totalAmount = parseFloat(totalData || "0");

    // Check if there are unpaid royalties
    if (totalAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "No unpaid royalties available for payment request" },
        { status: 400 }
      );
    }

    // Check if there's already a pending request
    const { data: existingRequest } = await supabaseAdmin
      .from("payment_requests")
      .select("id")
      .eq("artist_id", artistId)
      .eq("status", "pending")
      .single();

    if (existingRequest) {
      return NextResponse.json(
        { success: false, error: "You already have a pending payment request" },
        { status: 400 }
      );
    }

    // Create payment request
    const { data: paymentRequest, error: createError } = await supabaseAdmin
      .from("payment_requests")
      .insert({
        artist_id: artistId,
        total_amount: totalAmount,
        status: "pending",
      })
      .select()
      .single();

    if (createError || !paymentRequest) {
      console.error("Error creating payment request:", createError);
      return NextResponse.json(
        { success: false, error: "Failed to create payment request" },
        { status: 500 }
      );
    }

    // Mark associated royalties as pending
    const { data: royaltyCount, error: markError } = await supabaseAdmin
      .rpc("mark_royalties_pending", {
        artist_uuid: artistId,
        request_uuid: paymentRequest.id,
      });

    if (markError) {
      console.error("Error marking royalties as pending:", markError);
      // Rollback: delete the payment request
      await supabaseAdmin
        .from("payment_requests")
        .delete()
        .eq("id", paymentRequest.id);

      return NextResponse.json(
        { success: false, error: "Failed to process payment request" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        paymentRequest: {
          id: paymentRequest.id,
          total_amount: totalAmount,
          royalty_count: royaltyCount || 0,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error in payment request API:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}

