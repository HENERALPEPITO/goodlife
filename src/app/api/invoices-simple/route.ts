import { NextResponse } from "next/server";import { NextResponse } from "next/server";

import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { cookies } from "next/headers";import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { createClient } from "@/lib/supabase-server";

export async function GET(request: Request) {

  try {export async function GET(request: Request) {

    // Get the URL parameters  try {

    const { searchParams } = new URL(request.url);    // Get the URL parameters

    const paymentRequestId = searchParams.get("payment_request_id");    const { searchParams } = new URL(request.url);

    const paymentRequestId = searchParams.get("payment_request_id");

    if (!paymentRequestId) {

      return NextResponse.json(    if (!paymentRequestId) {

        { success: false, error: "Payment request ID is required" },      return NextResponse.json(

        { status: 400 }        { success: false, error: "Payment request ID is required" },

      );        { status: 400 }

    }      );

    }

    // Create a Supabase client with cookies for authentication

    const supabase = createRouteHandlerClient({ cookies });    // Create authenticated Supabase client

    const supabase = createClient();

    // Query the invoices table with joins to get all required information

    const { data: invoices, error } = await supabase    // Query the invoices table with joins to get all required information

      .from("invoices")    const { data: invoices, error } = await supabase

      .select(`      .from("invoices")

        *,      .select(`

        user_profiles (        *,

          email,        user_profiles (

          full_name          email,

        )          full_name

      `)        )

      .eq("payment_request_id", paymentRequestId)      `)

      .single();      .eq("payment_request_id", paymentRequestId)

      .single();

    if (error) {

      console.error("Error fetching invoice:", error);    if (error) {

      return NextResponse.json(      console.error("Error fetching invoice:", error);

        { success: false, error: "Failed to fetch invoice" },      return NextResponse.json(

        { status: 500 }        { success: false, error: "Failed to fetch invoice" },

      );        { status: 500 }

    }      );

    }

    if (!invoices) {

      return NextResponse.json(    if (!invoices) {

        { success: false, error: "Invoice not found" },      return NextResponse.json(

        { status: 404 }        { success: false, error: "Invoice not found" },

      );        { status: 404 }

    }      );

    }

    // Format the response

    const formattedInvoices = [{    // Format the response

      ...invoices,    const formattedInvoices = [{

      artist_name: invoices.user_profiles?.full_name || "Unknown Artist",      ...invoices,

      artist_email: invoices.user_profiles?.email      artist_name: invoices.user_profiles?.full_name || "Unknown Artist",

    }];      artist_email: invoices.user_profiles?.email

    }];

    return NextResponse.json({

      success: true,    return NextResponse.json({

      invoices: formattedInvoices      success: true,

    });      invoices: formattedInvoices

    });

  } catch (error) {

    console.error("Error in GET /api/invoices-simple:", error);  } catch (error) {

    return NextResponse.json(    console.error("Error in GET /api/invoices-simple:", error);

      { success: false, error: "Internal server error" },    return NextResponse.json(

      { status: 500 }      { success: false, error: "Internal server error" },

    );      { status: 500 }

  }    );

}  }
}