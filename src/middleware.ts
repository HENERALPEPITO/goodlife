import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ulvxfugjzgrjmcfvybjx.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsdnhmdWdqemdyam1jZnZ5Ymp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMTEwMDcsImV4cCI6MjA3Njc4NzAwN30.EHZGnCR7hMsncMdQ6LSW5WOg-z3GZFCxpjCvOsqSj8I";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const publicPaths = ["/login", "/_next", "/api", "/favicon.ico"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    
    return NextResponse.next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/(.*)"],
};


