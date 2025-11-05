/**
 * Simplified Invoice API Routes
 * GET /api/invoices-simple - List invoices
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getCurrentUser } from "@/lib/authHelpers";

export async function GET(request: NextRequest) {
  try {
    // Try to get user from helper function
    let user = await getCurrentUser();
    
    // If that fails, try to get session from Authorization header or cookies
    if (!user) {
      const supabase = await createServerSupabaseClient();
      
      // Check for Authorization header
      const authHeader = request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        // Set the session using the token
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
        
        if (!authError && authUser) {
          // Get profile
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("*")
            .eq("id", authUser.id)
            .single();
          
          if (profile) {
            user = {
              id: authUser.id,
              email: authUser.email || profile.email,
              role: profile.role as any,
            };
          }
        }
      }
      
      // If still no user, try to get session from cookies
      if (!user) {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (!sessionError && session?.user) {
          // Get profile
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();
          
          if (profile) {
            user = {
              id: session.user.id,
              email: session.user.email || profile.email,
              role: profile.role as any,
            };
          }
        }
      }
    }
    
    if (!user) {
      // Log for debugging
      console.log("No user found in API route - cookies:", request.cookies.getAll().map(c => c.name));
      return NextResponse.json({ 
        error: "Unauthorized",
        details: "Authentication required. Please ensure you are logged in and refresh the page.",
        code: "AUTH_REQUIRED"
      }, { status: 401 });
    }

    const supabase = await createServerSupabaseClient();

    // Fetch invoices
    let query = supabase
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false });

    // Artists can only see their own invoices
    if (user.role !== "admin") {
      query = query.eq("artist_id", user.id);
    }

    const { data: invoices, error } = await query;

    if (error) {
      console.error("Error fetching invoices:", error);
      
      // Check if it's a table not found error
      if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        return NextResponse.json(
          { 
            error: "Table not found",
            details: "The invoices table does not exist. Please run the database migration first.",
            code: 'TABLE_NOT_FOUND'
          },
          { status: 500 }
        );
      }
      
      throw error;
    }

    // Fetch related data separately if needed
    const artistIds = [...new Set((invoices || []).map((inv: any) => inv.artist_id).filter(Boolean))];
    const paymentRequestIds = [...new Set((invoices || []).map((inv: any) => inv.payment_request_id).filter(Boolean))];

    // Fetch user profiles
    let userProfiles: any[] = [];
    if (artistIds.length > 0) {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, email")
        .in("id", artistIds);
      userProfiles = profiles || [];
    }

    // Fetch payment requests
    let paymentRequests: any[] = [];
    if (paymentRequestIds.length > 0) {
      const { data: requests } = await supabase
        .from("payment_requests")
        .select("id, amount, total_amount, status")
        .in("id", paymentRequestIds);
      paymentRequests = requests || [];
    }

    // Create maps for quick lookup
    const profilesMap = new Map(userProfiles.map((p: any) => [p.id, p]));
    const requestsMap = new Map(paymentRequests.map((r: any) => [r.id, r]));

    // Transform data structure
    const transformedInvoices = (invoices || []).map((invoice: any) => {
      const paymentRequest = invoice.payment_request_id ? (requestsMap.get(invoice.payment_request_id) || null) : null;
      // Ensure total_amount has a value - use from invoice (amount or total_amount), payment_request, or default to 0
      // Convert to number to ensure it's numeric (database might return as string)
      // Note: Database uses 'amount' but we standardize to 'total_amount' in the response
      const totalAmount = Number(
        invoice.total_amount ?? 
        invoice.amount ?? 
        paymentRequest?.total_amount ?? 
        paymentRequest?.amount ?? 
        0
      );
      
      console.log('API - Invoice transformation:', {
        invoice_id: invoice.id,
        invoice_amount: invoice.amount,
        invoice_total_amount: invoice.total_amount,
        payment_request_total: paymentRequest?.total_amount,
        payment_request_amount: paymentRequest?.amount,
        final_totalAmount: totalAmount
      });
      
      return {
        ...invoice,
        total_amount: totalAmount, // Standardize to total_amount - always a number
        amount: invoice.amount, // Keep original for backward compatibility
        user_profiles: profilesMap.get(invoice.artist_id) || null,
        payment_requests: paymentRequest,
      };
    });

    return NextResponse.json({ invoices: transformedInvoices });
  } catch (error: any) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch invoices",
        details: error?.message || String(error),
        code: error?.code || 'UNKNOWN_ERROR'
      },
      { status: 500 }
    );
  }
}

