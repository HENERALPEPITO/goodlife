import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
    // Create authenticated client using cookies
    const supabase = createRouteHandlerClient<any>({ cookies });
    
    // Get the URL parameters
    const { searchParams } = new URL(request.url);
    const paymentRequestId = searchParams.get("payment_request_id");

    if (!paymentRequestId) {
      return NextResponse.json(
        { success: false, error: "Payment request ID is required" },
        { status: 400 }
      );
    }

    // Query the invoices table with joins to get all required information
    const { data: invoices, error } = await supabase
      .from("invoices")
      .select(`
        *,
        user_profiles (
          email,
          full_name
        )
      `)
      .eq("payment_request_id", paymentRequestId)
      .single();

    if (error) {
      console.error("Error fetching invoice:", error);
      return NextResponse.json(
        { success: false, error: error.message || "Failed to fetch invoice" },
        { status: 500 }
      );
    }

    if (!invoices) {
      return NextResponse.json(
        { success: false, error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Format the response
    const formattedInvoices = [{
      ...invoices,
      artist_name: invoices.user_profiles?.full_name || "Unknown Artist",
      artist_email: invoices.user_profiles?.email
    }];

    return NextResponse.json({
      success: true,
      invoices: formattedInvoices
    });

  } catch (error) {
    console.error("Error in GET /api/invoices-simple:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Internal server error",
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}