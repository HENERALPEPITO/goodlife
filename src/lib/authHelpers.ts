/**
 * Authentication Helper Functions
 * Server-side utilities for verifying user roles and permissions
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { UserRole } from "@/types";

/**
 * Creates a Supabase client for server-side operations (API routes, Server Components)
 * This client respects RLS policies based on the authenticated user
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nyxedsuflhvxzijjiktj.supabase.co";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55eGVkc3VmbGh2eHppamppa3RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDAzMjUsImV4cCI6MjA3NzkxNjMyNX0.Fm4MVU2rIO4IqMRUMAE_qUJQXqWn0WWZUMS0RuMKmDo";

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.");
  }

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

/**
 * Gets the current authenticated user and their profile
 * Returns null if not authenticated
 */
export async function getCurrentUser() {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get user directly (getUser() reads from cookies automatically)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      // Log but don't throw - might be a cookie issue
      console.log("Auth error in getCurrentUser:", authError.message);
      return null;
    }
    
    if (!user) {
      console.log("No user found in getCurrentUser");
      return null;
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Profile error:", profileError);
      // If profile doesn't exist, that's okay - we'll return null
      return null;
    }
    
    if (!profile) {
      console.log("No profile found for user:", user.id);
      return null;
    }

    return {
      id: user.id,
      email: user.email || profile.email,
      role: profile.role as UserRole,
    };
  } catch (error) {
    console.error("Error in getCurrentUser:", error);
    return null;
  }
}

/**
 * Verifies that the current user is an admin
 * Returns the user object if admin, null otherwise
 */
export async function requireAdmin() {
  const user = await getCurrentUser();
  
  if (!user || user.role !== "admin") {
    return null;
  }
  
  return user;
}

/**
 * Checks if the current user has the specified role
 */
export async function hasRole(role: UserRole): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === role;
}





