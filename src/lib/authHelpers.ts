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
export async function requireAdmin(): Promise<AdminUser | null> {
  try {
    // Get current user from cookies
    const user = await getCurrentUser();
    
    if (!user) {
      console.error("No authenticated user");
      return null;
    }

    // Verify admin role
    if (user.role !== "admin") {
      console.error("User is not an admin:", user.email);
      return null;
    }

    return {
      id: user.id,
      role: user.role,
      email: user.email,
    };
  } catch (error) {
    console.error("Error in requireAdmin:", error);
    return null;
  }
}

/**
 * Get Current User
 * 
 * Gets the current authenticated user from cookies.
 * Works for both admin and artist roles.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
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

/**
 * Create Server Supabase Client
 * 
 * Creates a server-side Supabase client with cookie support.
 * Used in API routes to interact with Supabase.
 */
export async function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  const cookieStore = await cookies();

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}