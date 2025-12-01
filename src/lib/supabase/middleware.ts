/**
 * Supabase Middleware Client
 * 
 * Creates a Supabase client for use in Next.js middleware.
 * Handles cookie-based session management with proper request/response handling.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make your app very slow.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Public routes that don't require authentication
  const publicRoutes = [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/privacy-policy",
    "/terms-and-conditions",
    "/privacy",
    "/terms",
  ];

  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  const isApiRoute = pathname.startsWith("/api");
  const isStaticAsset =
    pathname.startsWith("/_next") ||
    pathname.includes(".") ||
    pathname.startsWith("/favicon");

  // Allow static assets and API routes through
  if (isStaticAsset || isApiRoute) {
    return supabaseResponse;
  }

  // Redirect unauthenticated users to login (except public routes)
  if (!user && !isPublicRoute) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect authenticated users away from login page
  if (user && pathname === "/login") {
    // Both admin and artist go to root dashboard
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Role-based route protection
  if (user) {
    const role = user.user_metadata?.role as "admin" | "artist" | undefined;
    const isAdminRoute = pathname.startsWith("/admin");
    const isArtistRoute = pathname.startsWith("/artist");

    // Protect admin routes - only admins can access
    if (isAdminRoute && role !== "admin") {
      // For users without role metadata, we need to check DB
      if (!role) {
        // Let through - the page will handle the check
        // This is for legacy users whose metadata hasn't been synced
        return supabaseResponse;
      }
      // Artists trying to access admin routes get redirected
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Protect artist routes - only artists can access (not admins)
    if (isArtistRoute && role === "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return supabaseResponse;
}
