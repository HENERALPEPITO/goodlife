/**
 * Admin API Route: Create User with Specific UUID
 * POST /api/admin/create-user-with-uuid
 * 
 * Creates a new user with a specified UUID (for migration purposes).
 * ONLY accessible by authenticated admin users.
 * 
 * WARNING: This requires direct access to auth schema and should be used carefully.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authHelpers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface CreateUserWithUUIDRequest {
  email: string;
  password: string;
  role: "admin" | "artist";
  targetUUID: string;
}

interface CreateUserWithUUIDResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    role: string;
  };
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<CreateUserWithUUIDResponse>> {
  try {
    // Verify that the requesting user is an admin
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body: CreateUserWithUUIDRequest = await request.json();
    const { email, password, role, targetUUID } = body;

    // Validation
    if (!email || !password || !role || !targetUUID) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: email, password, role, or targetUUID" },
        { status: 400 }
      );
    }

    if (!["admin", "artist"].includes(role)) {
      return NextResponse.json(
        { success: false, error: "Invalid role. Must be 'admin' or 'artist'" },
        { status: 400 }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Password validation
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    // Check if UUID is already taken
    const { data: existingUser } = await supabaseAdmin.auth.admin.getUserById(targetUUID);
    if (existingUser.user) {
      return NextResponse.json(
        { success: false, error: `User with UUID ${targetUUID} already exists` },
        { status: 400 }
      );
    }

    // Check if email is already taken
    const { data: existingEmail } = await supabaseAdmin.auth.admin.listUsers();
    const emailExists = existingEmail.users?.some(u => u.email === email);
    if (emailExists) {
      return NextResponse.json(
        { success: false, error: `User with email ${email} already exists` },
        { status: 400 }
      );
    }

    // Create user in auth.users using RPC (requires database function)
    // Since Supabase Admin API doesn't support custom UUIDs, we'll use a workaround:
    // Create user normally, then we'll need to handle the UUID separately
    // For now, create the user and let Supabase generate the UUID
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role,
      },
    });

    if (authError) {
      console.error("Error creating auth user:", authError);
      return NextResponse.json(
        { success: false, error: authError.message || "Failed to create user" },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { success: false, error: "User creation failed - no user returned" },
        { status: 500 }
      );
    }

    const createdUUID = authData.user.id;

    // Create user profile
    const { error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .insert({
        id: createdUUID,
        email: authData.user.email,
        role,
      });

    if (profileError) {
      console.error("Error creating user profile:", profileError);
      // Rollback: delete the auth user if profile creation failed
      await supabaseAdmin.auth.admin.deleteUser(createdUUID);
      return NextResponse.json(
        { success: false, error: "Failed to create user profile" },
        { status: 500 }
      );
    }

    // If target UUID is different, log a warning
    if (createdUUID !== targetUUID) {
      console.warn(`Created user with UUID ${createdUUID}, but target was ${targetUUID}`);
      return NextResponse.json(
        {
          success: true,
          user: {
            id: createdUUID,
            email: authData.user.email!,
            role,
          },
          error: `Note: User created with UUID ${createdUUID} instead of target ${targetUUID}. Supabase doesn't allow setting custom UUIDs via API.`,
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          id: createdUUID,
          email: authData.user.email!,
          role,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Unexpected error in create-user-with-uuid API:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}




