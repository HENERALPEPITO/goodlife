/**
 * Notification Service
 * 
 * Handles creating notifications for various events.
 * Uses admin client to bypass RLS.
 */

import { getSupabaseAdmin } from "./supabaseAdmin";

export type NotificationType = 
  | "catalog_upload"
  | "royalty_upload"
  | "catalog_deleted"
  | "payment_approved"
  | "payment_rejected"
  | "payment_paid"
  | "admin_action";

interface CreateNotificationParams {
  artistId: string;
  message: string;
  type: NotificationType;
  metadata?: Record<string, any>;
}

interface NotificationResult {
  success: boolean;
  notificationId?: string;
  error?: string;
}

/**
 * Create a notification for an artist
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<NotificationResult> {
  try {
    const admin = getSupabaseAdmin();
    
    const { data, error } = await admin
      .from("notifications")
      .insert({
        artist_id: params.artistId,
        message: params.message,
        type: params.type,
        metadata: params.metadata || {},
      })
      .select("id")
      .single();

    if (error) {
      console.error("[Notification] Error creating notification:", error);
      return { success: false, error: error.message };
    }

    console.log("[Notification] Created notification:", data.id, "for artist:", params.artistId);
    return { success: true, notificationId: data.id };
  } catch (error) {
    console.error("[Notification] Unexpected error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create notifications for multiple artists
 */
export async function createBulkNotifications(
  notifications: CreateNotificationParams[]
): Promise<{ success: boolean; created: number; errors: number }> {
  let created = 0;
  let errors = 0;

  for (const notification of notifications) {
    const result = await createNotification(notification);
    if (result.success) {
      created++;
    } else {
      errors++;
    }
  }

  console.log(`[Notification] Bulk create complete: ${created} created, ${errors} errors`);
  return { success: errors === 0, created, errors };
}

/**
 * Create catalog upload notification
 */
export async function notifyCatalogUpload(artistId: string, trackCount?: number): Promise<NotificationResult> {
  return createNotification({
    artistId,
    message: "A new catalog has been uploaded. Please check your dashboard to view the updates.",
    type: "catalog_upload",
    metadata: trackCount ? { trackCount } : undefined,
  });
}

/**
 * Create royalty upload notification
 */
export async function notifyRoyaltyUpload(
  artistId: string,
  quarter: number,
  year: number
): Promise<NotificationResult> {
  return createNotification({
    artistId,
    message: `New royalties have been uploaded for Q${quarter} ${year}. Please check your dashboard to submit your invoice.`,
    type: "royalty_upload",
    metadata: { quarter, year },
  });
}

/**
 * Create catalog deleted notification
 */
export async function notifyCatalogDeleted(
  artistId: string,
  trackCount: number
): Promise<NotificationResult> {
  return createNotification({
    artistId,
    message: `${trackCount} track(s) have been removed from your catalog by an administrator.`,
    type: "catalog_deleted",
    metadata: { trackCount },
  });
}

/**
 * Create payment approved notification
 */
export async function notifyPaymentApproved(
  artistId: string,
  amount: number,
  invoiceNumber: string
): Promise<NotificationResult> {
  return createNotification({
    artistId,
    message: `Your payment request of $${amount.toFixed(2)} has been approved. Invoice: ${invoiceNumber}`,
    type: "payment_approved",
    metadata: { amount, invoiceNumber },
  });
}

/**
 * Create payment rejected notification
 */
export async function notifyPaymentRejected(
  artistId: string,
  amount: number,
  invoiceNumber: string
): Promise<NotificationResult> {
  return createNotification({
    artistId,
    message: `Your payment request of $${amount.toFixed(2)} has been rejected. Invoice: ${invoiceNumber}`,
    type: "payment_rejected",
    metadata: { amount, invoiceNumber },
  });
}

/**
 * Create payment paid notification
 */
export async function notifyPaymentPaid(
  artistId: string,
  amount: number,
  invoiceNumber: string
): Promise<NotificationResult> {
  return createNotification({
    artistId,
    message: `Your payment of $${amount.toFixed(2)} has been processed. Invoice: ${invoiceNumber}`,
    type: "payment_paid",
    metadata: { amount, invoiceNumber },
  });
}

/**
 * Get unread notification count for an artist
 */
export async function getUnreadCount(artistId: string): Promise<number> {
  try {
    const admin = getSupabaseAdmin();
    
    const { count, error } = await admin
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("artist_id", artistId)
      .eq("is_read", false);

    if (error) {
      console.error("[Notification] Error getting unread count:", error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error("[Notification] Unexpected error getting unread count:", error);
    return 0;
  }
}

/**
 * Mark notifications as read
 */
export async function markAsRead(
  artistId: string,
  notificationIds?: string[]
): Promise<{ success: boolean; count: number }> {
  try {
    const admin = getSupabaseAdmin();
    
    let query = admin
      .from("notifications")
      .update({ is_read: true })
      .eq("artist_id", artistId)
      .eq("is_read", false);

    if (notificationIds && notificationIds.length > 0) {
      query = query.in("id", notificationIds);
    }

    const { data, error } = await query.select("id");

    if (error) {
      console.error("[Notification] Error marking as read:", error);
      return { success: false, count: 0 };
    }

    return { success: true, count: data?.length || 0 };
  } catch (error) {
    console.error("[Notification] Unexpected error marking as read:", error);
    return { success: false, count: 0 };
  }
}
