/**
 * Legacy Supabase Client
 * 
 * @deprecated Use createClient from @/lib/supabase/client instead
 * This file is kept for backward compatibility with existing code.
 * 
 * Key fix: Using localStorage instead of sessionStorage for persistent sessions
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Use localStorage for persistent sessions (survives browser close)
    // sessionStorage was causing sessions to be lost on page reload in some browsers
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  }
});


