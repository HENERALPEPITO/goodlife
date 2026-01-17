/**
 * Authentication Helper Functions
 * 
 * Contains helper functions for authentication and authorization.
 * 
 * Key optimization: Uses user_metadata for instant role access
 * without database queries.
 */

import { getSupabaseAdmin } from "./supabaseAdmin";
import { createClient as createServerClientNew, getCurrentUserWithRole } from "./supabase/server";
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
 * 
 * OPTIMIZED: Checks user_metadata first, falls back to DB query.
 */
export async function requireAdmin(headers: Headers): Promise<AdminUser | null> {
  try {
    // Get authorization token from headers
    const authHeader = headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("[requireAdmin] No authorization header or invalid format");
      console.error("[requireAdmin] Headers available:", Array.from(headers.keys()));
      return null;
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("[requireAdmin] Token provided, length:", token.length);
    
    // Use admin client to verify the token
    let adminClient;
    try {
      adminClient = getSupabaseAdmin();
    } catch (adminError) {
      console.error("[requireAdmin] Failed to initialize admin client:", adminError);
      return null;
    }

    const { data: { user }, error } = await adminClient.auth.getUser(token);

    if (error || !user) {
      console.error("[requireAdmin] Invalid token or user not found:", error?.message);
      return null;
    }

    console.log("[requireAdmin] User found:", user.email, "| metadata role:", user.user_metadata?.role);

    // FAST PATH: Check user_metadata first (no DB query)
    const metadataRole = user.user_metadata?.role as string | undefined;
    if (metadataRole === "admin") {
      console.log("[requireAdmin] Admin verified via user_metadata");
      return {
        id: user.id,
        role: "admin",
        email: user.email || "",
      };
    }

    // SLOW PATH: Fall back to user_profiles table for legacy users
    const { data: profile, error: profileError } = await adminClient
      .from("user_profiles")
      .select("id, role, email")
      .eq("id", user.id)
      .single();

    console.log("[requireAdmin] Profile from DB:", profile?.email, "| role:", profile?.role, "| error:", profileError?.message);

    if (profileError || !profile) {
      console.error("[requireAdmin] Profile not found:", profileError?.message);
      return null;
    }

    // Verify admin role
    if (profile.role !== "admin") {
      console.error("[requireAdmin] User is not an admin:", profile.email, "| role:", profile.role);
      return null;
    }

    // Sync role to user_metadata for future instant access
    adminClient.auth.admin.updateUserById(user.id, {
      user_metadata: { role: profile.role }
    }).catch(console.error);

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
 * 
 * OPTIMIZED: Uses user_metadata for instant role access.
 * Falls back to DB query only for legacy users without metadata.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    // Use the optimized server client
    const { user, role, error } = await getCurrentUserWithRole();
    
    if (error || !user || !role) {
      return null;
    }

    return {
      id: user.id,
      role: role,
      email: user.email || "",
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