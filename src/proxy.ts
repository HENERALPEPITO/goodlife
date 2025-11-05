import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Proxy for route protection (Next.js 16+)
 * Protects admin routes and redirects unauthorized users
 */
export async function proxy(req: NextRequest) {
  const res = NextResponse.next();

  // Create Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nyxedsuflhvxzijjiktj.supabase.co";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55eGVkc3VmbGh2eHppamppa3RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDAzMjUsImV4cCI6MjA3NzkxNjMyNX0.Fm4MVU2rIO4IqMRUMAE_qUJQXqWn0WWZUMS0RuMKmDo";
  
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Only set cookies on the response, not the request
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh session if expired - required for Supabase SSR
  // This ensures API routes can read the session cookies
  await supabase.auth.getUser();

  // Check if the route is an API route
  const isApiRoute = req.nextUrl.pathname.startsWith("/api");
  
  // For API routes, just refresh the session and return (don't do redirects)
  if (isApiRoute) {
    return res;
  }

  // Check if the route is an admin or artist route
  const isAdminRoute = req.nextUrl.pathname.startsWith("/admin");
  const isArtistRoute = req.nextUrl.pathname.startsWith("/artist");

  if (isAdminRoute || isArtistRoute) {
    try {
      // Get the current user session (lighter check)
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      // Only redirect if there's a clear session error and no session at all
      // Let page-level checks handle more complex auth logic
      if (sessionError && !session) {
        const redirectUrl = new URL("/login", req.url);
        redirectUrl.searchParams.set("redirect", req.nextUrl.pathname);
        return NextResponse.redirect(redirectUrl);
      }

      // For admin routes, do a light check but don't fail hard
      // The page component will handle detailed role checks
      if (isAdminRoute && session) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();

        // Only block if we're certain the user is not an admin
        if (profile && profile.role !== "admin") {
          return NextResponse.redirect(new URL("/", req.url));
        }
      }

      // Artist routes: let page-level checks handle access control
    } catch (error) {
      // On any error, let the request through - page will handle auth
      console.error("Proxy check error (allowing through):", error);
    }
  }

  return res;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/artist/:path*",
    "/api/:path*", // Include API routes to refresh session cookies
    "/invoices/:path*", // Include invoices route
  ],
};

