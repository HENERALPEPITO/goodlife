/**
 * DELETE /api/admin/royalties/delete-all/:artistId
 * 
 * Delete all royalty records for a specific artist
 * Admin-only endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ artistId: string }> }
): Promise<NextResponse> {
  try {
    const { artistId } = await params;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nyxedsuflhvxzijjiktj.supabase.co";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55eGVkc3VmbGh2eHppamppa3RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDAzMjUsImV4cCI6MjA3NzkxNjMyNX0.Fm4MVU2rIO4IqMRUMAE_qUJQXqWn0WWZUMS0RuMKmDo";

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

    // Get user session and check role
    let user = null;
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
        
        if (profile) {
          user = {
            id: authUser.id,
            email: authUser.email || profile.email,
            role: profile.role as string,
          };
        }
      }
    }
    
    // If no user from token, try to get session from cookies
    if (!user) {
      await supabase.auth.getUser();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (!sessionError && session?.user) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        
        if (profile) {
          user = {
            id: session.user.id,
            email: session.user.email || profile.email,
            role: profile.role as string,
          };
        }
      }
    }
    
    if (!user) {
      console.log("No user found in DELETE /api/admin/royalties/delete-all/:artistId - cookies:", request.cookies.getAll().map(c => c.name));
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin
    if (user.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    // Use admin client to delete all royalties for the artist
    const adminClient = getSupabaseAdmin();

    const { error } = await adminClient
      .from("royalties")
      .delete()
      .eq("artist_id", artistId);

    if (error) {
      console.error("Error deleting artist royalties:", error);
      return NextResponse.json(
        { error: "Failed to delete artist royalties" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error in delete artist royalties endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
