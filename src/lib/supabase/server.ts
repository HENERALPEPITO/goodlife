/**
 * Supabase Server Client
 * 
 * Creates a Supabase client for server-side operations (Server Components, Route Handlers, Server Actions).
 * This client reads/writes cookies for session management.
 */
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function createClient() {
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
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );
}

/**
 * Get Current User with Role
 * 
 * Fetches the current user and their role from user_metadata.
 * Falls back to DB query only if metadata is missing (legacy users).
 */
export async function getCurrentUserWithRole() {
  const supabase = await createClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return { user: null, role: null, error: userError };
  }

  // First, check user_metadata for role (instant, no DB query)
  const metadataRole = user.user_metadata?.role as "admin" | "artist" | undefined;
  
  if (metadataRole) {
    return { 
      user, 
      role: metadataRole, 
      error: null 
    };
  }

  // Fallback: Query user_profiles table for legacy users without metadata
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    // Default to artist if no profile exists
    return { user, role: "artist" as const, error: profileError };
  }

  // Sync role to user_metadata for future instant access
  // This is a fire-and-forget operation - don't await
  supabase.auth.updateUser({
    data: { role: profile.role }
  }).catch(console.error);

  return { 
    user, 
    role: profile.role as "admin" | "artist", 
    error: null 
  };
}
