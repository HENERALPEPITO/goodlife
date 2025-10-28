import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Proxy for route protection (Next.js 16+)
 * Protects admin routes and redirects unauthorized users
 */
export async function proxy(req: NextRequest) {
  const res = NextResponse.next();

  // Create Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Check if the route is an admin or artist route
  const isAdminRoute = req.nextUrl.pathname.startsWith("/admin");
  const isArtistRoute = req.nextUrl.pathname.startsWith("/artist");

  if (isAdminRoute || isArtistRoute) {
    // Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // If no user, redirect to login
    if (!user) {
      const redirectUrl = new URL("/login", req.url);
      redirectUrl.searchParams.set("redirect", req.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // Check user role
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    // Admin routes: only admins allowed
    if (isAdminRoute && (!profile || profile.role !== "admin")) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // Artist routes: artists and admins allowed
    // (no additional check needed as authenticated users can access)
  }

  return res;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/artist/:path*",
  ],
};

