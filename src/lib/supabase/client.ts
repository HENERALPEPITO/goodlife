/**
 * Supabase Browser Client
 * 
 * Creates a Supabase client for client-side operations.
 * Uses localStorage for persistent session storage.
 */
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nyxedsuflhvxzijjiktj.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55eGVkc3VmbGh2eHppamppa3RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDAzMjUsImV4cCI6MjA3NzkxNjMyNX0.Fm4MVU2rIO4IqMRUMAE_qUJQXqWn0WWZUMS0RuMKmDo";

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
