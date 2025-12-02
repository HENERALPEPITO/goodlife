/**
 * PUT /api/admin/royalties/record/:recordId
 * DELETE /api/admin/royalties/record/:recordId
 * 
 * Update or delete a specific royalty record
 * Admin-only endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

async function verifyAdmin(request: NextRequest, supabaseUrl: string, supabaseAnonKey: string) {
  const response = NextResponse.next();
  
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Try to get user from Authorization header first
  const authHeader = request.headers.get('Authorization');
  
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    
    if (!authError && authUser) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", authUser.id)
        .single();
      
      if (profile?.role === "admin") {
        return { isAdmin: true, userId: authUser.id };
      }
    }
  }
  
  // If no user from token, try to get session from cookies
  await supabase.auth.getUser();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session?.user) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();
    
    if (profile?.role === "admin") {
      return { isAdmin: true, userId: session.user.id };
    }
  }

  return { isAdmin: false, userId: null };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ recordId: string }> }
): Promise<NextResponse> {
  try {
    const { recordId } = await params;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nyxedsuflhvxzijjiktj.supabase.co";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55eGVkc3VmbGh2eHppamppa3RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDAzMjUsImV4cCI6MjA3NzkxNjMyNX0.Fm4MVU2rIO4IqMRUMAE_qUJQXqWn0WWZUMS0RuMKmDo";

    // Verify admin
    const { isAdmin } = await verifyAdmin(request, supabaseUrl, supabaseAnonKey);
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    
    // Use admin client to update the royalty record
    const adminClient = getSupabaseAdmin();

    const { data, error } = await adminClient
      .from("royalties")
      .update(body)
      .eq("id", recordId)
      .select()
      .single();

    if (error) {
      console.error("Error updating royalty record:", error);
      return NextResponse.json(
        { error: "Failed to update royalty record" },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("Error in royalty record update endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ recordId: string }> }
): Promise<NextResponse> {
  try {
    const { recordId } = await params;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nyxedsuflhvxzijjiktj.supabase.co";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55eGVkc3VmbGh2eHppamppa3RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDAzMjUsImV4cCI6MjA3NzkxNjMyNX0.Fm4MVU2rIO4IqMRUMAE_qUJQXqWn0WWZUMS0RuMKmDo";

    // Verify admin
    const { isAdmin } = await verifyAdmin(request, supabaseUrl, supabaseAnonKey);
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    // Use admin client to delete the royalty record
    const adminClient = getSupabaseAdmin();

    const { error } = await adminClient
      .from("royalties")
      .delete()
      .eq("id", recordId);

    if (error) {
      console.error("Error deleting royalty record:", error);
      return NextResponse.json(
        { error: "Failed to delete royalty record" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error in royalty record delete endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}