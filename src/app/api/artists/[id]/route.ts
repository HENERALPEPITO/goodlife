import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getCurrentUser } from "@/lib/authHelpers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function createRequestSupabaseClient(request: NextRequest, response: NextResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nyxedsuflhvxzijjiktj.supabase.co";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55eGVkc3VmbGh2eHppamppa3RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDAzMjUsImV4cCI6MjA3NzkxNjMyNX0.Fm4MVU2rIO4IqMRUMAE_qUJQXqWn0WWZUMS0RuMKmDo";
  
  return createServerClient(
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
}

async function getUserFromRequest(request: NextRequest, response: NextResponse) {
  const supabase = createRequestSupabaseClient(request, response);
  
  // Try Authorization header first
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    
    if (!authError && authUser) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", authUser.id)
        .single();
      
      if (profile) {
        return {
          id: authUser.id,
          email: authUser.email || profile.email,
          role: profile.role as any,
        };
      }
    }
  }
  
  // Try session from cookies - call getUser first to refresh token
  await supabase.auth.getUser();
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (!sessionError && session?.user) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();
    
    if (profile) {
      return {
        id: session.user.id,
        email: session.user.email || profile.email,
        role: profile.role as any,
      };
    }
  }
  
  // Fallback to getCurrentUser
  return await getCurrentUser();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: artistId } = await params;

    const response = NextResponse.next();
    const user = await getUserFromRequest(request, response);
    
    if (!user) {
      return NextResponse.json(
        { 
          error: "Unauthorized",
          details: "Authentication required. Please ensure you are logged in.",
          code: "AUTH_REQUIRED"
        },
        { status: 401 }
      );
    }

    const supabase = createRequestSupabaseClient(request, response);

    // Use admin client for admin users to bypass RLS
    let supabaseClient = supabase;
    
    if (user.role === "admin") {
      try {
        supabaseClient = getSupabaseAdmin();
      } catch (adminError: any) {
        console.warn("Admin client not available, using regular client:", adminError);
        // Fall back to regular client
      }
    }

    const { data: artist, error } = await supabaseClient
      .from("artists")
      .select(`
        id,
        name,
        email,
        phone,
        address,
        address_locked,
        created_at,
        user_id
      `)
      .eq("id", artistId)
      .single();

    if (error) {
      console.error("Error fetching artist:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!artist) {
      return NextResponse.json({ error: "Artist not found" }, { status: 404 });
    }

    return NextResponse.json({ artist });
  } catch (error: any) {
    console.error("Error in GET /api/artists/[id]:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: artistId } = await params;
    
    console.log("PUT /api/artists/[id] - Artist ID:", artistId);
    console.log("PUT /api/artists/[id] - Request URL:", request.url);
    
    const response = NextResponse.next();
    const user = await getUserFromRequest(request, response);
    
    if (!user) {
      console.log("PUT /api/artists/[id] - Unauthorized: No user found");
      return NextResponse.json(
        { 
          error: "Unauthorized",
          details: "Authentication required. Please ensure you are logged in.",
          code: "AUTH_REQUIRED"
        },
        { status: 401 }
      );
    }

    console.log("PUT /api/artists/[id] - User:", { id: user.id, role: user.role, email: user.email });

    const supabase = createRequestSupabaseClient(request, response);

    const body = await request.json();
    const { name, email, phone, address, password } = body;

    // Validate password if provided (for updates)
    if (password && password.length < 6) {
      return NextResponse.json(
        { 
          error: "Invalid password",
          details: "Password must be at least 6 characters long"
        },
        { status: 400 }
      );
    }

    // Use admin client for admin users to bypass RLS
    let supabaseClient = supabase;
    let useAdminClient = false;
    
    if (user.role === "admin") {
      try {
        supabaseClient = getSupabaseAdmin();
        useAdminClient = true;
        console.log("PUT /api/artists/[id] - Using admin client to bypass RLS");
      } catch (adminError: any) {
        console.warn("PUT /api/artists/[id] - Admin client not available, using regular client:", adminError.message);
        // Fall back to regular client
      }
    }

    console.log("PUT /api/artists/[id] - Fetching artist with ID:", artistId);
    // Get the artist record to check permissions
    const { data: artist, error: fetchError } = await supabaseClient
      .from("artists")
      .select("user_id, address_locked")
      .eq("id", artistId)
      .single();

    if (fetchError) {
      console.error("PUT /api/artists/[id] - Error fetching artist:", {
        error: fetchError.message,
        code: fetchError.code,
        details: fetchError.details,
        hint: fetchError.hint,
        artistId,
        useAdminClient
      });
      return NextResponse.json(
        { 
          error: "Artist not found",
          details: fetchError.message || "The artist record could not be found",
          code: fetchError.code
        },
        { status: 404 }
      );
    }

    if (!artist) {
      console.error("PUT /api/artists/[id] - Artist not found (no data returned):", {
        artistId,
        useAdminClient
      });
      return NextResponse.json(
        { 
          error: "Artist not found",
          details: "The artist record does not exist",
          artistId
        },
        { status: 404 }
      );
    }

    console.log("PUT /api/artists/[id] - Artist found:", { id: artist.user_id, address_locked: artist.address_locked });

    // If artist is editing their own address and it's locked, reject
    if (
      user.role === "artist" &&
      artist.user_id === user.id &&
      address &&
      artist.address_locked
    ) {
      return NextResponse.json(
        { error: "Address is locked and cannot be edited" },
        { status: 403 }
      );
    }

    // Build update object
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;

    // Only allow address update if not locked or if admin is updating
    if (address !== undefined) {
      if (artist.address_locked && user.role !== "admin") {
        return NextResponse.json(
          { error: "Address is locked and cannot be edited" },
          { status: 403 }
        );
      }
      updateData.address = address;
      // If artist is updating their own address for the first time, lock it
      if (
        user.role === "artist" &&
        artist.user_id === user.id &&
        !artist.address_locked
      ) {
        updateData.address_locked = true;
      }
    }

    // Update password if provided (only admins can update passwords)
    if (password && user.role === "admin" && artist.user_id) {
      try {
        // Use admin client for password updates
        const adminClient = getSupabaseAdmin();
        const { error: passwordError } = await adminClient.auth.admin.updateUserById(
          artist.user_id,
          { password: password }
        );

        if (passwordError) {
          console.error("PUT /api/artists/[id] - Error updating password:", passwordError);
          return NextResponse.json(
            { 
              error: "Failed to update password",
              details: passwordError.message
            },
            { status: 500 }
          );
        }
        console.log("PUT /api/artists/[id] - Password updated successfully");
      } catch (passwordUpdateError: any) {
        console.error("PUT /api/artists/[id] - Error updating password:", passwordUpdateError);
        return NextResponse.json(
          { 
            error: "Failed to update password",
            details: passwordUpdateError?.message || "An error occurred while updating the password"
          },
          { status: 500 }
        );
      }
    }

    console.log("PUT /api/artists/[id] - Updating artist with data:", updateData);
    const { data: updatedArtist, error: updateError } = await supabaseClient
      .from("artists")
      .update(updateData)
      .eq("id", artistId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating artist:", updateError);
      return NextResponse.json(
        { error: "Failed to update artist" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      artist: updatedArtist,
      message: "Artist successfully updated" + (password ? " (password updated)" : ""),
    });
  } catch (error: any) {
    console.error("Error in PUT /api/artists/[id]:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: artistId } = await params;

    const response = NextResponse.next();
    const user = await getUserFromRequest(request, response);
    
    if (!user) {
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Use admin client for admin operations to bypass RLS
    let supabaseClient;
    try {
      supabaseClient = getSupabaseAdmin();
    } catch (adminError: any) {
      console.warn("Admin client not available, using regular client:", adminError);
      const response = NextResponse.next();
      supabaseClient = createRequestSupabaseClient(request, response);
    }

    const { error } = await supabaseClient
      .from("artists")
      .delete()
      .eq("id", artistId);

    if (error) {
      console.error("Error deleting artist:", error);
      return NextResponse.json(
        { error: "Failed to delete artist" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Artist successfully deleted" });
  } catch (error: any) {
    console.error("Error in DELETE /api/artists/[id]:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

