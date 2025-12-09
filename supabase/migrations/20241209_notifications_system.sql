-- ============================================
-- NOTIFICATIONS SYSTEM
-- No RLS - Using service role for all operations
-- ============================================

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL,
  message text NOT NULL,
  type text NOT NULL CHECK (type IN ('catalog_upload', 'royalty_upload', 'catalog_deleted', 'payment_approved', 'payment_rejected', 'payment_paid', 'admin_action')),
  metadata jsonb DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES public.artists(id) ON DELETE CASCADE
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_notifications_artist_id ON public.notifications(artist_id);
CREATE INDEX IF NOT EXISTS idx_notifications_artist_unread ON public.notifications(artist_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

-- Add comment to table
COMMENT ON TABLE public.notifications IS 'Artist notifications for various events like uploads, payments, etc.';

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to create a notification
CREATE OR REPLACE FUNCTION create_notification(
  p_artist_id uuid,
  p_message text,
  p_type text,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid AS $$
DECLARE
  v_notification_id uuid;
BEGIN
  INSERT INTO public.notifications (artist_id, message, type, metadata)
  VALUES (p_artist_id, p_message, p_type, p_metadata)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread notification count for an artist
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_artist_id uuid)
RETURNS integer AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::integer 
    FROM public.notifications 
    WHERE artist_id = p_artist_id AND is_read = false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notifications as read
CREATE OR REPLACE FUNCTION mark_notifications_read(
  p_artist_id uuid,
  p_notification_ids uuid[] DEFAULT NULL
) RETURNS integer AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_notification_ids IS NULL THEN
    -- Mark all as read
    UPDATE public.notifications
    SET is_read = true
    WHERE artist_id = p_artist_id AND is_read = false;
  ELSE
    -- Mark specific ones as read
    UPDATE public.notifications
    SET is_read = true
    WHERE artist_id = p_artist_id AND id = ANY(p_notification_ids) AND is_read = false;
  END IF;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get notifications for an artist with pagination
CREATE OR REPLACE FUNCTION get_artist_notifications(
  p_artist_id uuid,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_unread_only boolean DEFAULT false
) RETURNS TABLE (
  id uuid,
  message text,
  type text,
  metadata jsonb,
  is_read boolean,
  created_at timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.id,
    n.message,
    n.type,
    n.metadata,
    n.is_read,
    n.created_at
  FROM public.notifications n
  WHERE n.artist_id = p_artist_id
    AND (NOT p_unread_only OR n.is_read = false)
  ORDER BY n.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Notifications system created successfully';
END $$;
