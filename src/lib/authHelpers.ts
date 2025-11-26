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
 * Require Admin Access (from headers)
 * 
 * Verifies the user is authenticated via Authorization header and has admin role.
 * Used for API routes that receive headers.
 */
export async function requireAdmin(headers: Headers): Promise<AdminUser | null> {
  try {
    // Get authorization token from headers
    const authHeader = headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("No authorization header or invalid format");
      return null;
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Use admin client to verify the token
    const adminClient = getSupabaseAdmin();
    const { data: { user }, error } = await adminClient.auth.getUser(token);

    if (error || !user) {
      console.error("Invalid token or user not found:", error);
      return null;
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await adminClient
      .from("user_profiles")
      .select("id, role, email")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("Profile not found:", profileError);
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
 * Require Admin Access (from cookies)
 * 
 * Verifies the user is authenticated via cookies and has admin role.
 * Used for server components and pages.
 */
export async function requireAdminFromCookies(): Promise<AdminUser | null> {
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
    console.error("Error in requireAdminFromCookies:", error);
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