/**
 * Supabase Admin Client
 * 
 * This client uses the SERVICE_ROLE_KEY which bypasses Row Level Security (RLS).
 * ONLY use this on the server-side for administrative operations.
 * NEVER expose the service role key to the client.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nyxedsuflhvxzijjiktj.supabase.co";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceRoleKey) {
  console.warn("Missing SUPABASE_SERVICE_ROLE_KEY environment variable. Admin operations may fail.");
}

/**
 * Admin client with service role privileges
 * Use this for:
 * - Creating users via auth.admin
 * - Bypassing RLS policies
 * - Bulk operations requiring elevated privileges
 */
export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

// Helper function to get admin client or throw error
export function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not available. SUPABASE_SERVICE_ROLE_KEY is required.");
  }
  return supabaseAdmin;
}







