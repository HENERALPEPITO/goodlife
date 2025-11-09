/**
 * Admin API Route: Bulk Delete Royalties
 * POST /api/admin/delete-royalties
 * 
 * Deletes multiple royalty records by ID.
 * Only accessible by authenticated admin users.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/authHelpers";

interface DeleteRoyaltiesRequest {
  ids: string[];
}

interface DeleteRoyaltiesResponse {
  success: boolean;
  count?: number;
  error?: string;
}

// Maximum number of IDs to delete in a single request (safety limit)
const MAX_DELETE_BATCH_SIZE = 1000;

export async function POST(request: NextRequest): Promise<NextResponse<DeleteRoyaltiesResponse>> {
  try {
    // Verify that the requesting user is an admin
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    // Parse request body
    const body: DeleteRoyaltiesRequest = await request.json();
    const { ids } = body;

    // Validation
    if (!ids || !Array.isArray(ids)) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid 'ids' array" },
        { status: 400 }
      );
    }

    if (ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "No IDs provided for deletion" },
        { status: 400 }
      );
    }

    // Check batch size limit
    if (ids.length > MAX_DELETE_BATCH_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete more than ${MAX_DELETE_BATCH_SIZE} records at once. Please batch your requests.`,
        },
        { status: 400 }
      );
    }

    // Validate all IDs are valid UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const invalidIds = ids.filter(id => !uuidRegex.test(id));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid UUID format for ${invalidIds.length} ID(s)`,
        },
        { status: 400 }
      );
    }

    // Perform bulk delete using parameterized query (safe from SQL injection)
    const { error: deleteError, count } = await supabaseAdmin
      .from("royalties")
      .delete()
      .in("id", ids);

    if (deleteError) {
      console.error("Error deleting royalties:", deleteError);
      return NextResponse.json(
        { success: false, error: "Failed to delete royalties" },
        { status: 500 }
      );
    }

    // Return success with count of deleted records
    return NextResponse.json(
      {
        success: true,
        count: count || 0,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unexpected error in delete-royalties API:", error);
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















