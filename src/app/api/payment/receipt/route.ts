/**
 * Payment Receipt Data API
 * GET /api/payment/receipt
 * 
 * Returns detailed receipt data for PDF generation
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/authHelpers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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
    artist_name: string;
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
  };
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<ReceiptData>> {
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

    // Get payment request ID from query params
    const { searchParams } = new URL(request.url);
    const paymentRequestId = searchParams.get("payment_request_id");

    if (!paymentRequestId) {
      return NextResponse.json(
        { success: false, error: "Missing payment_request_id parameter" },
        { status: 400 }
      );
    }

    // Get admin client
    const admin = getSupabaseAdmin();

    // Fetch payment request
    const { data: paymentRequest, error: prError } = await admin
      .from("payment_requests")
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

    // Get artist info
    const { data: artist, error: artistError } = await admin
      .from("artists")
      .select("id, name, user_id, address, tax_id")
      .eq("id", paymentRequest.artist_id)
      .single();

    if (artistError || !artist) {
      return NextResponse.json(
        { success: false, error: "Artist not found" },
        { status: 404 }
      );
    }

    // Get user profile for email
    const { data: userProfile } = await admin
      .from("user_profiles")
      .select("email")
      .eq("id", artist.user_id)
      .single();

    const artistEmail = userProfile?.email || "";

    // Check authorization - artist can only view their own receipts
    if (user.role !== "admin" && artist.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "You don't have permission to view this receipt" },
        { status: 403 }
      );
    }

    // Fetch royalty summaries from royalties_summary table
    const { data: summaries, error: summariesError } = await admin
      .from("royalties_summary")
      .select(`
        *,
        tracks:track_id (title)
      `)
      .eq("artist_id", paymentRequest.artist_id)
      .order("year", { ascending: false })
      .order("quarter", { ascending: false });

    if (summariesError) {
      console.error("Error fetching royalties_summary:", summariesError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch royalty details" },
        { status: 500 }
      );
    }

    // Calculate totals from royalties_summary
    const totals = (summaries || []).reduce(
      (acc: {
        total_gross: number;
        total_admin_fee: number;
        total_net: number;
        royalty_count: number;
      }, summary: any) => {
        acc.total_gross += parseFloat(summary.total_gross || "0");
        // Estimate admin fee as difference between gross and net
        acc.total_admin_fee += parseFloat(summary.total_gross || "0") - parseFloat(summary.total_net || "0");
        acc.total_net += parseFloat(summary.total_net || "0");
        acc.royalty_count += summary.record_count || 1;
        return acc;
      },
      {
        total_gross: 0,
        total_admin_fee: 0,
        total_net: 0,
        royalty_count: 0,
      }
    );

    // Recalculate total_amount if it's 0
    let totalAmount = Number(paymentRequest.amount || 0);
    if (totalAmount === 0 && totals.total_net > 0) {
      // Get already paid amounts from other payment requests
      const { data: paidRequests } = await admin
        .from("payment_requests")
        .select("amount")
        .eq("artist_id", paymentRequest.artist_id)
        .eq("status", "paid")
        .neq("id", paymentRequestId);

      const paidAmount = (paidRequests || []).reduce(
        (sum: number, pr: any) => sum + parseFloat(pr.amount || "0"), 0
      );

      totalAmount = totals.total_net - paidAmount;

      // Update the payment request with the correct amount
      if (totalAmount > 0) {
        await admin
          .from("payment_requests")
          .update({ amount: totalAmount })
          .eq("id", paymentRequestId);

        // Also update the invoice if it exists
        await admin
          .from("invoices")
          .update({ amount: totalAmount })
          .eq("payment_request_id", paymentRequestId);
      }
    }

    // Transform summaries to royalty items format
    const royalties = (summaries || []).map((s: any) => ({
      id: s.id,
      track_title: s.tracks?.title || `Track ${s.track_id?.substring(0, 8) || 'Unknown'}`,
      usage_count: s.total_streams || 0,
      gross_amount: parseFloat(s.total_gross || "0"),
      admin_percent: s.total_gross > 0 ? ((parseFloat(s.total_gross || "0") - parseFloat(s.total_net || "0")) / parseFloat(s.total_gross || "1")) * 100 : 0,
      net_amount: parseFloat(s.total_net || "0"),
      broadcast_date: `${s.year}-Q${s.quarter}`,
      platform: s.top_platform || "",
      territory: s.top_territory || "",
    }));

    // Get invoice number if exists
    const { data: invoice } = await admin
      .from("invoices")
      .select("invoice_number")
      .eq("payment_request_id", paymentRequestId)
      .maybeSingle();

    return NextResponse.json(
      {
        success: true,
        receipt: {
          receipt_number: invoice?.invoice_number || `INV-${paymentRequest.id.substring(0, 8).toUpperCase()}`,
          payment_request_id: paymentRequest.id,
          artist_id: paymentRequest.artist_id,
          artist_name: artist.name || "Artist",
          artist_email: artistEmail,
          artist_address: artist.address || undefined,
          artist_tax_id: artist.tax_id || undefined,
          total_amount: totalAmount,
          status: paymentRequest.status,
          created_at: paymentRequest.created_at,
          updated_at: paymentRequest.updated_at,
          royalties: royalties,
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












