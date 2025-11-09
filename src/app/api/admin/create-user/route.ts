/**
 * Admin API Route: Create User
 * POST /api/admin/create-user
 * 
 * Creates a new user with specified role using admin privileges.
 * Only accessible by authenticated admin users.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/authHelpers";
import type { UserRole } from "@/types";

interface CreateUserRequest {
  email: string;
  password: string;
  role: UserRole;
}

interface CreateUserResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<CreateUserResponse>> {
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
    const body: CreateUserRequest = await request.json();
    const { email, password, role } = body;

    // Validation
    if (!email || !password || !role) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: email, password, or role" },
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

    // Password validation (minimum 6 characters as per Supabase default)
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    // Create user in auth.users using admin client
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
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

    // Create user profile in user_profiles table
    const { error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .insert({
        id: authData.user.id,
        email: authData.user.email,
        role,
      });

    if (profileError) {
      console.error("Error creating user profile:", profileError);
      
      // Rollback: delete the auth user if profile creation failed
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      
      return NextResponse.json(
        { success: false, error: "Failed to create user profile" },
        { status: 500 }
      );
    }

    // Return success response
    return NextResponse.json(
      {
        success: true,
        user: {
          id: authData.user.id,
          email: authData.user.email!,
          role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error in create-user API:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Ensure only POST is allowed
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}















