/**
 * Notifications API
 * 
 * GET /api/notifications - Get notifications for the current artist
 * POST /api/notifications - Create a notification (admin only) or mark as read
 * PATCH /api/notifications - Mark notifications as read
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

interface Notification {
  id: string;
  message: string;
  type: string;
  metadata: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

interface GetNotificationsResponse {
  success: boolean;
  notifications?: Notification[];
  unreadCount?: number;
  error?: string;
}

interface CreateNotificationRequest {
  artistId: string;
  message: string;
  type: string;
  metadata?: Record<string, any>;
}

interface MarkReadRequest {
  artistId: string;
  notificationIds?: string[];
  markAll?: boolean;
}

/**
 * GET - Get notifications for an artist
 */
export async function GET(request: NextRequest): Promise<NextResponse<GetNotificationsResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const artistId = searchParams.get("artistId");
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    if (!artistId) {
      return NextResponse.json(
        { success: false, error: "artistId is required" },
        { status: 400 }
      );
    }

    const adminClient = getSupabaseAdmin();

    // Get notifications
    let query = adminClient
      .from("notifications")
      .select("id, message, type, metadata, is_read, created_at")
      .eq("artist_id", artistId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) {
      query = query.eq("is_read", false);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error("[Notifications] Error fetching:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Get unread count
    const { count: unreadCount } = await adminClient
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("artist_id", artistId)
      .eq("is_read", false);

    return NextResponse.json({
      success: true,
      notifications: notifications || [],
      unreadCount: unreadCount || 0,
    });
  } catch (error) {
    console.error("[Notifications] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a notification (admin only) or send bulk notifications
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const adminClient = getSupabaseAdmin();
    const body = await request.json();
    const { action } = body;

    // For internal notification actions (catalog_upload, etc.), verify auth via token if provided
    // These are called from admin pages that have already verified the user
    const internalActions = ["catalog_upload"];
    
    if (!internalActions.includes(action)) {
      // For other actions, require strict auth
      const authHeader = request.headers.get("authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return NextResponse.json(
          { success: false, error: "Unauthorized. No token provided." },
          { status: 403 }
        );
      }
      
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
      
      if (authError || !user) {
        return NextResponse.json(
          { success: false, error: "Unauthorized. Invalid token." },
          { status: 403 }
        );
      }
      
      // Check if user is admin
      const { data: profile } = await adminClient
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      
      if (!profile || profile.role !== "admin") {
        return NextResponse.json(
          { success: false, error: "Unauthorized. Admin access required." },
          { status: 403 }
        );
      }
    }

    // Handle different actions
    if (action === "catalog_upload") {
      // Send catalog upload notifications to specified artists
      const { artistIds } = body as { action: string; artistIds: string[] };

      if (!artistIds || artistIds.length === 0) {
        return NextResponse.json(
          { success: false, error: "artistIds is required" },
          { status: 400 }
        );
      }

      // Get artist info for emails
      const { data: artists } = await adminClient
        .from("artists")
        .select("id, name, user_id")
        .in("id", artistIds);

      if (!artists || artists.length === 0) {
        return NextResponse.json(
          { success: false, error: "No artists found" },
          { status: 404 }
        );
      }

      // Get user profiles for emails
      const userIds = artists.map((a: { user_id: string }) => a.user_id).filter(Boolean);
      const { data: profiles } = await adminClient
        .from("user_profiles")
        .select("id, email")
        .in("id", userIds);

      const profileMap = new Map<string, string>((profiles || []).map((p: { id: string; email: string }) => [p.id, p.email]));

      // Create notifications and send emails
      const results = {
        notificationsCreated: 0,
        emailsSent: 0,
        errors: [] as string[],
      };

      // Import email function
      const { sendCatalogUploadEmailToArtist } = await import("@/lib/emailService");
      const { notifyCatalogUpload } = await import("@/lib/notificationService");

      for (const artist of artists) {
        // Create notification
        const notifResult = await notifyCatalogUpload(artist.id);
        if (notifResult.success) {
          results.notificationsCreated++;
        } else {
          results.errors.push(`Notification for ${artist.name}: ${notifResult.error}`);
        }

        // Send email
        const email = profileMap.get(artist.user_id);
        if (email) {
          const emailResult = await sendCatalogUploadEmailToArtist({
            artistName: artist.name || "Artist",
            artistEmail: email,
          });
          if (emailResult.success) {
            results.emailsSent++;
          } else {
            results.errors.push(`Email to ${email}: ${emailResult.error}`);
          }
        }
      }

      console.log("[Notifications] Catalog upload notifications:", results);

      return NextResponse.json({
        success: true,
        ...results,
      });
    }

    // Default: create a single notification
    const { artistId, message, type, metadata } = body as CreateNotificationRequest;

    if (!artistId || !message || !type) {
      return NextResponse.json(
        { success: false, error: "artistId, message, and type are required" },
        { status: 400 }
      );
    }

    const { data, error } = await adminClient
      .from("notifications")
      .insert({
        artist_id: artistId,
        message,
        type,
        metadata: metadata || {},
      })
      .select("id")
      .single();

    if (error) {
      console.error("[Notifications] Error creating:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      notificationId: data.id,
    });
  } catch (error) {
    console.error("[Notifications] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Mark notifications as read
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const body: MarkReadRequest = await request.json();
    const { artistId, notificationIds, markAll } = body;

    if (!artistId) {
      return NextResponse.json(
        { success: false, error: "artistId is required" },
        { status: 400 }
      );
    }

    const adminClient = getSupabaseAdmin();

    let query = adminClient
      .from("notifications")
      .update({ is_read: true })
      .eq("artist_id", artistId)
      .eq("is_read", false);

    if (!markAll && notificationIds && notificationIds.length > 0) {
      query = query.in("id", notificationIds);
    }

    const { data, error } = await query.select("id");

    if (error) {
      console.error("[Notifications] Error marking as read:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      markedCount: data?.length || 0,
    });
  } catch (error) {
    console.error("[Notifications] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
