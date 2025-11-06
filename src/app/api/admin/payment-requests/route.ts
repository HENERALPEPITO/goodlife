import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/authHelpers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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
    const updateData = {
      status,
      remarks: remarks || null,
      approved_by: admin.id,
      approved_at: new Date().toISOString(),
    };

    const { data: paymentRequest, error: updateError } = await adminClient
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

    // If approved, create invoice
    if (status === "approved") {
      // Get artist info
      const { data: artist } = await adminClient
        .from("artists")
        .select("id, name, email")
        .eq("id", paymentRequest.artist_id)
        .single();

      if (artist) {
        // Check if invoice already exists
        const { data: existingInvoice } = await adminClient
          .from("invoices")
          .select("id")
          .eq("payment_request_id", id)
          .maybeSingle();

        if (!existingInvoice) {
          // Generate invoice reference
          let invoiceRef: string;
          try {
            const { data: refData } = await adminClient.rpc("generate_invoice_ref");
            invoiceRef = refData || `INV-${Date.now().toString(36).toUpperCase()}`;
          } catch {
            invoiceRef = `INV-${Date.now().toString(36).toUpperCase()}`;
          }
          
          // Generate invoice number
          const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;

          // Create invoice
          const { error: invoiceError } = await adminClient
            .from("invoices")
            .insert({
              artist_id: paymentRequest.artist_id,
              artist_name: artist.name || artist.email,
              total_net: paymentRequest.amount,
              amount: paymentRequest.amount,
              invoice_ref: invoiceRef,
              invoice_number: invoiceNumber,
              invoice_date: new Date().toISOString(),
              status: "pending",
              payment_request_id: id,
            });

          if (invoiceError) {
            console.error("Error creating invoice:", invoiceError);
          }
        }
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