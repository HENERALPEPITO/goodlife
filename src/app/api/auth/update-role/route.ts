/**
 * API Route: Update User Role
 * 
 * Admin-only endpoint to update a user's role.
 * Automatically syncs role to both user_profiles and user_metadata.
 */
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // Verify the requesting user is an admin
    const { data: { user: adminUser }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !adminUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check admin role from metadata
    const adminRole = adminUser.user_metadata?.role;
    if (adminRole !== "admin") {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    // Get request body
    const { userId, newRole } = await request.json();

    if (!userId || !newRole) {
      return NextResponse.json(
        { error: "Missing userId or newRole" },
        { status: 400 }
      );
    }

    if (newRole !== "admin" && newRole !== "artist") {
      return NextResponse.json(
        { error: "Invalid role. Must be 'admin' or 'artist'" },
        { status: 400 }
      );
    }

    // Update user_profiles table
    const { error: profileError } = await supabase
      .from("user_profiles")
      .update({ role: newRole })
      .eq("id", userId);

    if (profileError) {
      console.error("Error updating user_profiles:", profileError);
      return NextResponse.json(
        { error: "Failed to update user profile" },
        { status: 500 }
      );
    }

    // Note: The trigger created in the migration will auto-sync to user_metadata
    // If the trigger isn't set up, the role will sync on next login via getRoleFromUser()

    return NextResponse.json({ 
      success: true, 
      message: `User role updated to ${newRole}` 
    });
  } catch (error) {
    console.error("Error in update-role:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
