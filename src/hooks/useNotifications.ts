/**
 * useNotifications Hook
 * 
 * Manages notifications for artists including fetching, marking as read,
 * and real-time updates.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface Notification {
  id: string;
  message: string;
  type: string;
  metadata: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

interface UseNotificationsOptions {
  artistId: string | null;
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markAsRead: (notificationIds?: string[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export function useNotifications(options: UseNotificationsOptions): UseNotificationsReturn {
  const { artistId, limit = 20, autoRefresh = false, refreshInterval = 30000 } = options;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!artistId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/notifications?artistId=${artistId}&limit=${limit}`
      );
      const data = await response.json();

      if (data.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      } else {
        setError(data.error || "Failed to fetch notifications");
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [artistId, limit]);

  const markAsRead = useCallback(async (notificationIds?: string[]) => {
    if (!artistId) return;

    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistId,
          notificationIds,
          markAll: false,
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Update local state
        if (notificationIds) {
          setNotifications((prev) =>
            prev.map((n) =>
              notificationIds.includes(n.id) ? { ...n, is_read: true } : n
            )
          );
          setUnreadCount((prev) => Math.max(0, prev - (data.markedCount || 0)));
        }
      }
    } catch (err) {
      console.error("Error marking notifications as read:", err);
    }
  }, [artistId]);

  const markAllAsRead = useCallback(async () => {
    if (!artistId) return;

    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistId,
          markAll: true,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
    }
  }, [artistId]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !artistId) return;

    const interval = setInterval(fetchNotifications, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, artistId, refreshInterval, fetchNotifications]);

  // Real-time subscription (optional - uses Supabase realtime)
  useEffect(() => {
    if (!artistId) return;

    const channel = supabase
      .channel(`notifications:${artistId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `artist_id=eq.${artistId}`,
        },
        (payload) => {
          console.log("New notification:", payload);
          const newNotification = payload.new as Notification;
          setNotifications((prev) => [newNotification, ...prev]);
          setUnreadCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [artistId]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refresh: fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
}
