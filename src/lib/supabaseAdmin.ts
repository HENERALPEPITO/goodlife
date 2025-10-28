/**
 * Supabase Admin Client
 * 
 * This client uses the SERVICE_ROLE_KEY which bypasses Row Level Security (RLS).
 * ONLY use this on the server-side for administrative operations.
 * NEVER expose the service role key to the client.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable");
}

if (!supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
}

/**
 * Admin client with service role privileges
 * Use this for:
 * - Creating users via auth.admin
 * - Bypassing RLS policies
 * - Bulk operations requiring elevated privileges
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

