import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getCurrentUser } from "@/lib/authHelpers";

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
  
  // Try session from cookies
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
  { params }: { params: { id: string } }
) {
  try {
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

    const { data: artist, error } = await supabase
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
      .eq("id", params.id)
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
  { params }: { params: { id: string } }
) {
  try {
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

    const body = await request.json();
    const { name, email, phone, address } = body;

    // Get the artist record to check permissions
    const { data: artist, error: fetchError } = await supabase
      .from("artists")
      .select("user_id, address_locked")
      .eq("id", params.id)
      .single();

    if (fetchError || !artist) {
      return NextResponse.json(
        { error: "Artist not found" },
        { status: 404 }
      );
    }

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

    const { data: updatedArtist, error: updateError } = await supabase
      .from("artists")
      .update(updateData)
      .eq("id", params.id)
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
      message: "Artist successfully updated",
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
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle both sync and async params (Next.js 15 compatibility)
    const resolvedParams = await Promise.resolve(params);
    const artistId = resolvedParams.id;
    
    console.log("DELETE /api/artists/[id] - Artist ID:", artistId);
    console.log("DELETE /api/artists/[id] - Request URL:", request.url);
    
    const response = NextResponse.next();
    const user = await getUserFromRequest(request, response);
    
    if (!user) {
      console.log("DELETE /api/artists/[id] - Unauthorized: No user found");
      return NextResponse.json(
        { 
          error: "Unauthorized",
          details: "Authentication required. Please ensure you are logged in.",
          code: "AUTH_REQUIRED"
        },
        { status: 401 }
      );
    }

    console.log("DELETE /api/artists/[id] - User:", { id: user.id, role: user.role, email: user.email });

    // Check if user is admin
    if (user.role !== "admin") {
      console.log("DELETE /api/artists/[id] - Forbidden: User is not admin");
      return NextResponse.json(
        { 
          error: "Forbidden",
          details: "Only administrators can delete artists"
        },
        { status: 403 }
      );
    }

    // Use admin client for admin operations to bypass RLS
    let supabaseClient;
    try {
      supabaseClient = getSupabaseAdmin();
      console.log("DELETE /api/artists/[id] - Using admin client to bypass RLS");
    } catch (adminError: any) {
      console.warn("DELETE /api/artists/[id] - Admin client not available, using regular client:", adminError.message);
      supabaseClient = createRequestSupabaseClient(request, response);
    }

    console.log("DELETE /api/artists/[id] - Deleting artist with ID:", artistId);
    const { data, error } = await supabaseClient
      .from("artists")
      .delete()
      .eq("id", artistId)
      .select();

    if (error) {
      console.error("DELETE /api/artists/[id] - Error deleting artist:", {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        artistId
      });
      return NextResponse.json(
        { 
          error: "Failed to delete artist",
          details: error.message || "An error occurred while deleting the artist",
          code: error.code
        },
        { status: 500 }
      );
    }

    console.log("DELETE /api/artists/[id] - Artist deleted successfully:", { artistId, deletedRows: data?.length || 0 });

    return NextResponse.json({ 
      message: "Artist successfully deleted",
      artistId
    });
  } catch (error: any) {
    console.error("DELETE /api/artists/[id] - Unexpected error:", {
      message: error?.message || "Unknown error",
      name: error?.name,
      stack: error?.stack
    });
    return NextResponse.json(
      { 
        error: error?.message || "Internal server error",
        details: "An unexpected error occurred while deleting the artist"
      },
      { status: 500 }
    );
  }
}

