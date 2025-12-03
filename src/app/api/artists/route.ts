import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getCurrentUser } from "@/lib/authHelpers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  try {
    // Create Supabase client using request cookies (more reliable for API routes)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nyxedsuflhvxzijjiktj.supabase.co";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55eGVkc3VmbGh2eHppamppa3RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDAzMjUsImV4cCI6MjA3NzkxNjMyNX0.Fm4MVU2rIO4IqMRUMAE_qUJQXqWn0WWZUMS0RuMKmDo";
    
    const response = NextResponse.next();
    
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    // Try to get user from Authorization header first
    let user = null;
    const authHeader = request.headers.get('Authorization');
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // Verify token using regular client
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (!authError && authUser) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", authUser.id)
          .single();
        
        if (profile) {
          user = {
            id: authUser.id,
            email: authUser.email || profile.email,
            role: profile.role as any,
          };
        }
      }
    }
    
    // If no user from token, try to get session from cookies
    if (!user) {
      // Refresh session first
      await supabase.auth.getUser();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (!sessionError && session?.user) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        
        if (profile) {
          user = {
            id: session.user.id,
            email: session.user.email || profile.email,
            role: profile.role as any,
          };
        }
      }
    }
    
    // If still no user, try getCurrentUser as last resort
    if (!user) {
      user = await getCurrentUser();
    }
    
    if (!user) {
      console.log("No user found in /api/artists GET - cookies:", request.cookies.getAll().map(c => c.name));
      console.log("Authorization header:", authHeader ? "Present" : "Missing");
      return NextResponse.json(
        { 
          error: "Unauthorized",
          details: "Authentication required. Please ensure you are logged in and refresh the page.",
          code: "AUTH_REQUIRED"
        },
        { status: 401 }
      );
    }

    // Get userId from query params if provided (for artist fetching their own profile)
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (userId && user.role === "artist") {
      // Artist can only fetch their own profile
      if (userId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const { data: artist, error: artistError } = await supabase
        .from("artists")
        .select(`
          id,
          name,
          email,
          phone,
          address,
          tax_id,
          address_locked,
          created_at,
          user_id
        `)
        .eq("user_id", userId)
        .maybeSingle();

      if (artistError) {
        console.error("Error fetching artist:", artistError);
        // If table doesn't exist or column doesn't exist, return empty
        if (artistError.code === "42P01" || artistError.code === "42703") {
          return NextResponse.json({ artist: null });
        }
        return NextResponse.json(
          { error: artistError.message, code: artistError.code },
          { status: 500 }
        );
      }

      return NextResponse.json({ artist: artist || null });
    }

    // Admin can fetch all artists
    if (user.role !== "admin") {
      console.log("Non-admin user attempted to fetch all artists:", { userId: user.id, role: user.role });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.log("Admin user fetching all artists:", { userId: user.id, email: user.email });

    // Use admin client for admin queries to bypass RLS
    let supabaseAdmin;
    let useAdminClient = false;
    try {
      supabaseAdmin = getSupabaseAdmin();
      useAdminClient = true;
      console.log("Using admin client to fetch artists (bypasses RLS)");
    } catch (adminError: any) {
      console.error("Error getting admin client for GET /api/artists:", adminError);
      console.warn("Admin client not available. Using regular client (may be affected by RLS).");
      console.warn("This may cause issues if RLS policies are restrictive. Set SUPABASE_SERVICE_ROLE_KEY in .env.local");
    }

    // If using admin client, we don't need session check - admin client bypasses RLS
    // If using regular client, we already have the authenticated user, so RLS should work
    // The user was authenticated earlier in the function, so we can proceed
    if (!useAdminClient) {
      console.log("Using regular client - user already authenticated:", user.id);
      // Try to refresh session to ensure RLS sees us as admin
      try {
        await supabase.auth.getUser();
        console.log("Refreshed user context for RLS");
      } catch (refreshError) {
        console.warn("Could not refresh user context, but proceeding anyway:", refreshError);
      }
    }

    // Try admin client first, fallback to regular client if it fails
    let artists = null;
    let artistsError = null;
    
    if (useAdminClient && supabaseAdmin) {
      const result = await supabaseAdmin
        .from("artists")
        .select(`
          id,
          name,
          email,
          phone,
          address,
          tax_id,
          address_locked,
          created_at,
          user_id
        `)
        .order("created_at", { ascending: false });
      
      artists = result.data;
      artistsError = result.error;
      
      // If admin client fails with API key error, try regular client
      if (artistsError && (artistsError.message?.includes("Invalid API key") || artistsError.message?.includes("JWT"))) {
        console.warn("Admin client failed with API key error. Falling back to regular client...");
        useAdminClient = false;
      }
    }
    
    // If admin client failed or wasn't available, use regular client
    if (!useAdminClient || artistsError) {
      console.log("Using regular client with admin session for RLS");
      const result = await supabase
        .from("artists")
        .select(`
          id,
          name,
          email,
          phone,
          address,
          tax_id,
          address_locked,
          created_at,
          user_id
        `)
        .order("created_at", { ascending: false });
      
      artists = result.data;
      artistsError = result.error;
    }

    console.log("Artists query result:", { 
      count: artists?.length || 0, 
      hasError: !!artistsError,
      error: artistsError?.message,
      errorCode: artistsError?.code,
      usedAdminClient: useAdminClient
    });

    if (artistsError) {
      console.error("Error fetching artists:", artistsError);
      
      // Handle "Invalid API key" error from Supabase
      if (artistsError.message?.includes("Invalid API key") || artistsError.message?.includes("JWT")) {
        console.error("Invalid API key detected. SUPABASE_SERVICE_ROLE_KEY is likely incorrect or missing.");
        return NextResponse.json(
          { 
            error: "Server configuration error",
            details: "Invalid API key. Please check that SUPABASE_SERVICE_ROLE_KEY is set correctly in your .env.local file. Falling back to regular client also failed.",
            code: "INVALID_API_KEY"
          },
          { status: 500 }
        );
      }
      
      // If table doesn't exist or column doesn't exist, return empty array
      if (artistsError.code === "42P01" || artistsError.code === "42703") {
        console.warn("Artists table or columns may not exist yet. Run the migration first.");
        return NextResponse.json({ artists: [] });
      }
      
      return NextResponse.json(
        { 
          error: artistsError.message || "Failed to fetch artists",
          details: artistsError.details || artistsError.message,
          code: artistsError.code || "UNKNOWN_ERROR"
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ artists: artists || [] });
  } catch (error: any) {
    console.error("Error in GET /api/artists:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Create Supabase client using request cookies
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nyxedsuflhvxzijjiktj.supabase.co";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55eGVkc3VmbGh2eHppamppa3RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDAzMjUsImV4cCI6MjA3NzkxNjMyNX0.Fm4MVU2rIO4IqMRUMAE_qUJQXqWn0WWZUMS0RuMKmDo";
    
    const response = NextResponse.next();
    
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    // Try to get user from Authorization header first
    let user = null;
    const authHeader = request.headers.get('Authorization');
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // Verify token using regular client
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (!authError && authUser) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", authUser.id)
          .single();
        
        if (profile) {
          user = {
            id: authUser.id,
            email: authUser.email || profile.email,
            role: profile.role as any,
          };
        }
      }
    }
    
    // If no user from token, try to get session from cookies
    if (!user) {
      // Refresh session first
      await supabase.auth.getUser();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (!sessionError && session?.user) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        
        if (profile) {
          user = {
            id: session.user.id,
            email: session.user.email || profile.email,
            role: profile.role as any,
          };
        }
      }
    }
    
    // If still no user, try getCurrentUser as last resort
    if (!user) {
      user = await getCurrentUser();
    }
    
    if (!user) {
      console.log("No user found in /api/artists POST - cookies:", request.cookies.getAll().map(c => c.name));
      console.log("Authorization header:", authHeader ? "Present" : "Missing");
      return NextResponse.json(
        { 
          error: "Unauthorized",
          details: "Authentication required. Please ensure you are logged in.",
          code: "AUTH_REQUIRED"
        },
        { status: 401 }
      );
    }

    // Check if user is admin
    if (user.role !== "admin") {
      console.log("User role check failed:", { userId: user.id, role: user.role });
      return NextResponse.json(
        { 
          error: "Forbidden",
          details: "Only administrators can create artists. Your role: " + user.role
        }, 
        { status: 403 }
      );
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (parseError: any) {
      console.error("Error parsing request body:", parseError);
      return NextResponse.json(
        { 
          error: "Invalid request body",
          details: "The request body could not be parsed as JSON: " + (parseError?.message || "Unknown error")
        },
        { status: 400 }
      );
    }

    const { name, email, phone, address, tax_id, password } = body;

    // Validate required fields
    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    // Validate password if provided
    if (password && password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    // Password is required for new users
    if (!password) {
      return NextResponse.json(
        { error: "Password is required for new artists" },
        { status: 400 }
      );
    }

    // Get admin client
    let supabaseAdmin;
    try {
      supabaseAdmin = getSupabaseAdmin();
    } catch (adminError: any) {
      console.error("Error getting admin client:", adminError);
      return NextResponse.json(
        { 
          error: "Server configuration error",
          details: adminError?.message || "SUPABASE_SERVICE_ROLE_KEY is required for admin operations. Please check your environment variables."
        },
        { status: 500 }
      );
    }

    // Check if email already exists in user_profiles using admin client
    console.log("Checking if email already exists:", email);
    const { data: existingProfile, error: checkError } = await supabaseAdmin
      .from("user_profiles")
      .select("id, email, role")
      .eq("email", email)
      .maybeSingle();

    if (checkError) {
      console.error("Error checking existing profile:", checkError);
      return NextResponse.json(
        { 
          error: "Failed to check existing user",
          details: checkError.message
        },
        { status: 500 }
      );
    }

    console.log("Existing profile check result:", existingProfile);

    let userId: string;

    if (existingProfile) {
      // Use existing user - but ensure role is set to artist
      console.log("Using existing user:", existingProfile.id);
      userId = existingProfile.id;
      
      // Update role to artist if it's not already set
      if (existingProfile.role !== "artist") {
        console.log("Updating user role to artist:", userId);
        const { error: updateRoleError } = await supabaseAdmin
          .from("user_profiles")
          .update({ role: "artist" })
          .eq("id", userId);
        
        if (updateRoleError) {
          console.error("Error updating user role:", updateRoleError);
          return NextResponse.json(
            { 
              error: "Failed to update user role",
              details: updateRoleError.message
            },
            { status: 500 }
          );
        }
      }
    } else {
      // Create new auth user using admin client with provided password
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: password, // Use provided password
        email_confirm: true,
      });

      if (authError) {
        console.error("Error creating auth user:", authError);
        return NextResponse.json(
          { error: "Failed to create user account", details: authError.message },
          { status: 500 }
        );
      }

      if (!authData?.user) {
        return NextResponse.json(
          { error: "Failed to create user account - no user returned" },
          { status: 500 }
        );
      }

      userId = authData.user.id;

      // Create user profile using admin client
      console.log("Creating user profile with role 'artist':", { userId, email });
      const { error: profileError } = await supabaseAdmin
        .from("user_profiles")
        .insert({
          id: userId,
          email,
          role: "artist",
        });

      if (profileError) {
        console.error("Error creating user profile:", profileError);
        console.error("Profile error details:", JSON.stringify(profileError));
        // Rollback: delete the auth user if profile creation failed
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return NextResponse.json(
          { 
            error: "Failed to create user profile",
            details: profileError.message || "Unknown error creating user profile",
            code: profileError.code
          },
          { status: 500 }
        );
      }
      
      console.log("User profile created successfully with role 'artist'");
    }

    // Create artist record using admin client
    const defaultAddress = address || "Profesor Hermida 6, 3-3C, 36960 Sanxenxo, Spain";
    
    const { data: artist, error: artistError } = await supabaseAdmin
      .from("artists")
      .insert({
        user_id: userId,
        name,
        email,
        phone: phone || null,
        address: defaultAddress,
        tax_id: tax_id || null,
        address_locked: false,
      })
      .select()
      .single();

    if (artistError) {
      console.error("Error creating artist:", artistError);
      return NextResponse.json(
        { 
          error: "Failed to create artist",
          details: artistError.message || "Unknown error occurred while creating artist record"
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { artist, message: "Artist successfully created" },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("=== ERROR in POST /api/artists ===");
    console.error("Error message:", error?.message);
    console.error("Error name:", error?.name);
    console.error("Error constructor:", error?.constructor?.name);
    console.error("Error stack:", error?.stack);
    console.error("Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    console.error("==================================");
    
    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { 
          error: "Invalid request body",
          details: "The request body could not be parsed as JSON"
        },
        { status: 400 }
      );
    }
    
    // Handle other errors - ensure we always return a proper error object
    const errorMessage = error?.message || error?.toString() || "Internal server error";
    const errorDetails = error?.details || errorMessage;
    const errorType = error?.constructor?.name || error?.name || "UnknownError";
    
    // Ensure we never return an empty object
    const errorResponse = {
      error: errorMessage,
      details: errorDetails,
      type: errorType,
      timestamp: new Date().toISOString()
    };
    
    console.error("Returning error response:", errorResponse);
    
    return NextResponse.json(
      errorResponse,
      { status: 500 }
    );
  }
}

