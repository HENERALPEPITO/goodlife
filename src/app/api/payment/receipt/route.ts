/**
 * Payment Receipt Data API
 * GET /api/payment/receipt
 * 
 * Returns detailed receipt data for PDF generation
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/authHelpers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

interface Royalty {
  id: string;
  track_title: string;
  usage_count: number;
  gross_amount: string;
  admin_percent: string;
  net_amount: string;
  broadcast_date: string;
  platform: string;
  territory: string;
}

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

    // Fetch associated royalties (those marked as paid for this artist)
    const { data: royalties, error: royaltiesError } = await admin
      .from("royalties")
      .select("*")
      .eq("artist_id", paymentRequest.artist_id)
      .eq("is_paid", true)
      .order("broadcast_date", { ascending: false });

    if (royaltiesError) {
      console.error("Error fetching royalties:", royaltiesError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch royalty details" },
        { status: 500 }
      );
    }

    // Calculate totals
    const totals = (royalties as Royalty[] || []).reduce(
      (acc: {
        total_gross: number;
        total_admin_fee: number;
        total_net: number;
        royalty_count: number;
      }, royalty: Royalty) => {
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

    // Get invoice number if exists
    const { data: invoice } = await admin
      .from("invoices")
      .select("invoice_number")
      .eq("payment_request_id", paymentRequestId)
      .maybeSingle();

    // Get approver email if exists
    let approvedByEmail = null;
    if (paymentRequest.approved_by) {
      const { data: approver } = await admin
        .from("user_profiles")
        .select("email")
        .eq("id", paymentRequest.approved_by)
        .single();
      approvedByEmail = approver?.email || null;
    }

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
          total_amount: Number(paymentRequest.amount || 0),
          status: paymentRequest.status,
          created_at: paymentRequest.created_at,
          approved_at: paymentRequest.approved_at || null,
          approved_by_email: approvedByEmail,
          royalties: (royalties as any[] || []).map((r: any) => {
            // Get track title from track_id if available
            let trackTitle = "Unknown";
            if (r.track_id) {
              // We could fetch track title here, but for now use a placeholder
              trackTitle = `Track ${r.track_id.substring(0, 8)}`;
            }
            
            return {
              id: r.id,
              track_title: trackTitle,
              usage_count: r.usage_count || 0,
              gross_amount: parseFloat(r.gross_amount || "0"),
              admin_percent: parseFloat(r.admin_percent || "0"),
              net_amount: parseFloat(r.net_amount || "0"),
              broadcast_date: r.broadcast_date || "",
              platform: r.exploitation_source_name || r.platform || "",
              territory: r.territory || "",
            };
          }),
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












