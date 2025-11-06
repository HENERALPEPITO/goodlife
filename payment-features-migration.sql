-- ============================================
-- PAYMENT FEATURES MIGRATION
-- Payment Requests & Receipts
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PAYMENT REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payment_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  total_amount NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','paid')),
  remarks TEXT,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for payment requests
CREATE INDEX IF NOT EXISTS idx_payment_requests_artist_id ON payment_requests(artist_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_created_at ON payment_requests(created_at DESC);

-- ============================================
-- 2. PAYMENT RECEIPTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payment_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_request_id UUID REFERENCES payment_requests(id) ON DELETE CASCADE,
  artist_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  total_amount NUMERIC(12,2) NOT NULL,
  pdf_url TEXT,
  receipt_number TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for payment receipts
CREATE INDEX IF NOT EXISTS idx_payment_receipts_payment_request_id ON payment_receipts(payment_request_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_artist_id ON payment_receipts(artist_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_receipt_number ON payment_receipts(receipt_number);

-- ============================================
-- 3. ROYALTY PAYMENT TRACKING
-- ============================================
-- Add payment tracking to royalties table
ALTER TABLE royalties 
  ADD COLUMN IF NOT EXISTS payment_request_id UUID REFERENCES payment_requests(id),
  ADD COLUMN IF NOT EXISTS paid_status TEXT DEFAULT 'unpaid' CHECK (paid_status IN ('unpaid','pending','paid'));

-- Index for payment tracking
CREATE INDEX IF NOT EXISTS idx_royalties_payment_request_id ON royalties(payment_request_id);
CREATE INDEX IF NOT EXISTS idx_royalties_paid_status ON royalties(paid_status);

-- ============================================
-- 4. ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on payment_requests
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

-- Artists can view their own payment requests
CREATE POLICY IF NOT EXISTS "Artists can view own payment requests"
  ON payment_requests FOR SELECT
  TO authenticated
  USING (artist_id = auth.uid());

-- Artists can create their own payment requests
CREATE POLICY IF NOT EXISTS "Artists can create own payment requests"
  ON payment_requests FOR INSERT
  TO authenticated
  WITH CHECK (artist_id = auth.uid());

-- Admins can view all payment requests
CREATE POLICY IF NOT EXISTS "Admins can view all payment requests"
  ON payment_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Admins can update payment requests
CREATE POLICY IF NOT EXISTS "Admins can update payment requests"
  ON payment_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Enable RLS on payment_receipts
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;

-- Artists can view their own receipts
CREATE POLICY IF NOT EXISTS "Artists can view own receipts"
  ON payment_receipts FOR SELECT
  TO authenticated
  USING (artist_id = auth.uid());

-- Admins can view all receipts
CREATE POLICY IF NOT EXISTS "Admins can view all receipts"
  ON payment_receipts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Admins can create receipts
CREATE POLICY IF NOT EXISTS "Admins can create receipts"
  ON payment_receipts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- ============================================
-- 5. HELPER FUNCTIONS
-- ============================================

-- Function to generate receipt number
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TEXT AS $$
DECLARE
  receipt_num TEXT;
  year_part TEXT;
  month_part TEXT;
  seq_num INTEGER;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  month_part := TO_CHAR(NOW(), 'MM');
  
  -- Get next sequence number for this month
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(receipt_number FROM 12) AS INTEGER)
  ), 0) + 1
  INTO seq_num
  FROM payment_receipts
  WHERE receipt_number LIKE 'RCP-' || year_part || month_part || '%';
  
  receipt_num := 'RCP-' || year_part || month_part || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN receipt_num;
END;
$$ LANGUAGE plpgsql;

-- Function to get artist unpaid royalties total
CREATE OR REPLACE FUNCTION get_unpaid_royalties_total(artist_uuid UUID)
RETURNS NUMERIC AS $$
DECLARE
  total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(net_amount), 0)
  INTO total
  FROM royalties
  WHERE artist_id = artist_uuid
    AND paid_status = 'unpaid'
    AND net_amount IS NOT NULL;
  
  RETURN total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark royalties as pending when payment requested
CREATE OR REPLACE FUNCTION mark_royalties_pending(artist_uuid UUID, request_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE royalties
  SET 
    paid_status = 'pending',
    payment_request_id = request_uuid
  WHERE artist_id = artist_uuid
    AND paid_status = 'unpaid'
    AND net_amount IS NOT NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark royalties as paid when request approved
CREATE OR REPLACE FUNCTION mark_royalties_paid(request_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE royalties
  SET paid_status = 'paid'
  WHERE payment_request_id = request_uuid
    AND paid_status = 'pending';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update payment request timestamp
CREATE OR REPLACE FUNCTION update_payment_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payment_request_update_timestamp ON payment_requests;
CREATE TRIGGER payment_request_update_timestamp
  BEFORE UPDATE ON payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_request_timestamp();

-- ============================================
-- 6. VIEWS FOR REPORTING
-- ============================================

-- View for payment request details with artist info
CREATE OR REPLACE VIEW payment_requests_detailed AS
SELECT 
  pr.*,
  up.email as artist_email,
  admin_up.email as approved_by_email,
  (
    SELECT COUNT(*)
    FROM royalties r
    WHERE r.payment_request_id = pr.id
  ) as royalty_count
FROM payment_requests pr
LEFT JOIN user_profiles up ON pr.artist_id = up.id
LEFT JOIN user_profiles admin_up ON pr.approved_by = admin_up.id;

-- Grant access to the view
GRANT SELECT ON payment_requests_detailed TO authenticated;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================











