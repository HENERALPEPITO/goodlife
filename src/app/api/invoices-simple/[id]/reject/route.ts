/**
 * Reject Invoice API Route
 * POST /api/invoices-simple/[id]/reject
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getCurrentUser } from "@/lib/authHelpers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(
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

    // Get invoice and payment request
    const { data: invoice } = await supabase
      .from("invoices")
      .select("payment_request_id, status")
      .eq("id", params.id)
      .single();

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status !== "pending") {
      return NextResponse.json(
        { error: "Can only reject pending invoices" },
        { status: 400 }
      );
    }

    // Update invoice status
    const { error: invoiceError } = await supabase
      .from("invoices")
      .update({ status: "rejected" })
      .eq("id", params.id);

    if (invoiceError) throw invoiceError;

    // Update payment request status if linked
    if (invoice.payment_request_id) {
      const { error: requestError } = await supabaseAdmin
        .from("payment_requests")
        .update({ status: "rejected" })
        .eq("id", invoice.payment_request_id);

      if (requestError) {
        console.error("Error updating payment request:", requestError);
        // Don't fail the request, invoice is already rejected
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error rejecting invoice:", error);
    return NextResponse.json(
      { error: "Failed to reject invoice" },
      { status: 500 }
    );
  }
}







