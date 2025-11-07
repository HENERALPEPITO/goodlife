/**

 * Authentication Helper Functions
 * 
 * Contains helper functions for authentication and authorization.
 */

import { getSupabaseAdmin } from "./supabaseAdmin";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

interface AdminUser {
  id: string;
  role: string;
  email: string;
}

interface CurrentUser {
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

/**
 * Get Current User
 * 
 * Gets the current authenticated user from request headers.
 * Works for both admin and artist roles.
 */
export async function getCurrentUser(headers: Headers): Promise<CurrentUser | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing Supabase environment variables");
      return null;
    }

    // Get cookie store
    const cookieStore = await cookies();

    // Create server client with cookies
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            // Cookies are set automatically by Next.js
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Get user from session
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return null;
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, role, email")
      .eq("id", authUser.id)
      .single();

    if (profileError || !profile) {
      return null;
    }

    return {
      id: profile.id,
      role: profile.role,
      email: profile.email,
    };
  } catch (error) {
    console.error("Error in getCurrentUser:", error);
    return null;
  }
}