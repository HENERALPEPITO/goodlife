/**
 * Simplified Invoice API Routes
 * GET, PUT /api/invoices-simple/[id] - Get/Update invoice
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getCurrentUser } from "@/lib/authHelpers";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createServerSupabaseClient();

    // Fetch invoice
    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) {
      console.error("Error fetching invoice:", error);
      throw error;
    }

    // Check permissions
    if (user.role !== "admin" && invoice.artist_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch related data
    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("id, email")
      .eq("id", invoice.artist_id)
      .single();

    let paymentRequest = null;
    if (invoice.payment_request_id) {
      const { data: request } = await supabase
        .from("payment_requests")
        .select("id, total_amount, status")
        .eq("id", invoice.payment_request_id)
        .single();
      paymentRequest = request;
    }

    const transformedInvoice = {
      ...invoice,
      user_profiles: userProfile || null,
      payment_requests: paymentRequest,
    };

    return NextResponse.json({ invoice: transformedInvoice });
  } catch (error) {
    console.error("Error fetching invoice:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = await createServerSupabaseClient();

    const body = await request.json();
    const {
      artist_name,
      artist_address,
      artist_email,
      artist_phone,
      // total_amount is fixed and comes from payment_request - not editable
      payment_method,
      notes,
    } = body;

    // Only allow editing if invoice is still pending
    const { data: currentInvoice } = await supabase
      .from("invoices")
      .select("status, payment_request_id")
      .eq("id", params.id)
      .single();

    if (currentInvoice?.status !== "pending") {
      return NextResponse.json(
        { error: "Can only edit pending invoices" },
        { status: 400 }
      );
    }

    // total_amount is fixed and comes from payment_request - it cannot be changed

    // Update invoice (total_amount is fixed and comes from payment_request)
    const { data: invoice, error } = await supabase
      .from("invoices")
      .update({
        artist_name,
        artist_address,
        artist_email,
        artist_phone,
        // total_amount is NOT updated - it's fixed to the payment request amount
        payment_method,
        notes,
      })
      .eq("id", params.id)
      .select("*")
      .single();

    if (error) {
      console.error("Error updating invoice:", error);
      throw error;
    }

    // Fetch related data
    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("id, email")
      .eq("id", invoice.artist_id)
      .single();

    let paymentRequest = null;
    if (invoice.payment_request_id) {
      const { data: request } = await supabase
        .from("payment_requests")
        .select("id, total_amount, status")
        .eq("id", invoice.payment_request_id)
        .single();
      paymentRequest = request;
    }

    const transformedInvoice = {
      ...invoice,
      user_profiles: userProfile || null,
      payment_requests: paymentRequest,
    };

    return NextResponse.json({ invoice: transformedInvoice });
  } catch (error) {
    console.error("Error updating invoice:", error);
    return NextResponse.json(
      { error: "Failed to update invoice" },
      { status: 500 }
    );
  }
}

