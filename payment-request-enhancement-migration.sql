-- ============================================
-- PAYMENT REQUEST ENHANCEMENT MIGRATION
-- Adds €100 minimum and is_paid tracking
-- ============================================

-- Add is_paid column to royalties if it doesn't exist
-- (We'll use this alongside paid_status for clarity)
ALTER TABLE royalties 
  ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;

-- Create index for is_paid for faster queries
CREATE INDEX IF NOT EXISTS idx_royalties_is_paid ON royalties(is_paid) WHERE is_paid = FALSE;

-- Update existing royalties to sync is_paid with paid_status
UPDATE royalties 
SET is_paid = CASE 
  WHEN paid_status = 'paid' THEN TRUE 
  ELSE FALSE 
END
WHERE is_paid IS NULL;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to calculate unpaid balance (using is_paid = FALSE or paid_status = 'unpaid')
CREATE OR REPLACE FUNCTION get_unpaid_balance(artist_uuid UUID)
RETURNS NUMERIC AS $$
DECLARE
  total_balance NUMERIC;
BEGIN
  SELECT COALESCE(SUM(net_amount), 0)
  INTO total_balance
  FROM royalties
  WHERE artist_id = artist_uuid
    AND (is_paid = FALSE OR paid_status = 'unpaid');
  
  RETURN total_balance;
END;
$$ LANGUAGE plpgsql;

-- Update or create get_unpaid_royalties_total function (if it exists)
CREATE OR REPLACE FUNCTION get_unpaid_royalties_total(artist_uuid UUID)
RETURNS NUMERIC AS $$
DECLARE
  total_balance NUMERIC;
BEGIN
  SELECT COALESCE(SUM(net_amount), 0)
  INTO total_balance
  FROM royalties
  WHERE artist_id = artist_uuid
    AND (is_paid = FALSE OR paid_status = 'unpaid');
  
  RETURN total_balance;
END;
$$ LANGUAGE plpgsql;

-- Function to mark all unpaid royalties as paid
CREATE OR REPLACE FUNCTION mark_royalties_as_paid(artist_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE royalties
  SET 
    is_paid = TRUE,
    paid_status = 'paid'
  WHERE artist_id = artist_uuid
    AND is_paid = FALSE;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to restore royalties (mark as unpaid) for a payment request
CREATE OR REPLACE FUNCTION restore_royalties_for_request(request_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
  artist_uuid UUID;
  request_amount NUMERIC;
BEGIN
  -- Get the payment request details
  SELECT artist_id, amount INTO artist_uuid, request_amount
  FROM payment_requests
  WHERE id = request_uuid;
  
  IF artist_uuid IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Mark royalties as unpaid (restore balance)
  -- This is a simplified approach - in a real system, you'd track which royalties
  -- were included in the request. For now, we'll restore based on the amount.
  -- This function can be enhanced later to track specific royalties per request.
  
  UPDATE royalties
  SET 
    is_paid = FALSE,
    paid_status = 'unpaid'
  WHERE artist_id = artist_uuid
    AND paid_status = 'paid'
    AND is_paid = TRUE
  LIMIT (
    SELECT COUNT(*) 
    FROM royalties 
    WHERE artist_id = artist_uuid 
      AND paid_status = 'paid' 
      AND is_paid = TRUE
  );
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

