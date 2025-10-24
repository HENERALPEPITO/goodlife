import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ulvxfugjzgrjmcfvybjx.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsdnhmdWdqemdyam1jZnZ5Ymp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMTEwMDcsImV4cCI6MjA3Njc4NzAwN30.EHZGnCR7hMsncMdQ6LSW5WOg-z3GZFCxpjCvOsqSj8I";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});


