/**

 * Authentication Helper Functions
 * 
 * Contains helper functions for authentication and authorization.
 */

import { getSupabaseAdmin } from "./supabaseAdmin";

interface AdminUser {
  id: string;
  role: string;
  email: string;
}

/**
 * Require Admin Access
 * 
 * Verifies the user is authenticated and has the admin role.
 * Used as middleware for admin-only API routes.
 */
export async function requireAdmin(headers: Headers): Promise<AdminUser | null> {
  try {
    // Get auth token from request headers
    const authHeader = headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("No auth token provided");
      return null;
    }

    // Parse token
    const token = authHeader.replace("Bearer ", "");
    
    // Use admin client directly since we have the token
    const supabase = getSupabaseAdmin();

    // Verify token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error:", authError);
      return null;
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, role, email")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("Profile error:", profileError);
      return null;
    }

    // Verify admin role
    if (profile.role !== "admin") {
      console.error("User is not an admin:", profile.email);
      return null;
    }

    return {
      id: profile.id,
      role: profile.role,
      email: profile.email,
    };
  } catch (error) {
    console.error("Error in requireAdmin:", error);
    return null;
  }
}