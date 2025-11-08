-- ============================================
-- SIMPLIFIED INVOICE SYSTEM MIGRATION
-- Linked to payment_requests, no line items
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. CREATE SIMPLIFIED INVOICES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_request_id UUID REFERENCES payment_requests(id) ON DELETE CASCADE,
  artist_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Invoice reference
  invoice_number TEXT UNIQUE NOT NULL,
  
  -- Artist/Recipient information (editable by admin)
  artist_name TEXT,
  artist_address TEXT,
  artist_email TEXT,
  artist_phone TEXT,
  
  -- Invoice details
  invoice_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_amount NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  
  -- Payment information
  payment_method TEXT,
  notes TEXT,
  
  -- PDF storage
  pdf_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_payment_request_id ON invoices(payment_request_id);
CREATE INDEX IF NOT EXISTS idx_invoices_artist_id ON invoices(artist_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);

-- ============================================
-- 2. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Artists can view their own invoices
CREATE POLICY IF NOT EXISTS "Artists can view own invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (artist_id = auth.uid());

-- Admins can view all invoices
CREATE POLICY IF NOT EXISTS "Admins can view all invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Admins can insert invoices
CREATE POLICY IF NOT EXISTS "Admins can insert invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Admins can update invoices
CREATE POLICY IF NOT EXISTS "Admins can update invoices"
  ON invoices FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Admins can delete invoices
CREATE POLICY IF NOT EXISTS "Admins can delete invoices"
  ON invoices FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- ============================================
-- 3. HELPER FUNCTIONS
-- ============================================

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  invoice_num TEXT;
  year_part TEXT;
  seq_num INTEGER;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  
  -- Get next sequence number for this year
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(invoice_number FROM 5 FOR 4) AS INTEGER)
  ), 0) + 1
  INTO seq_num
  FROM invoices
  WHERE invoice_number LIKE 'INV-' || year_part || '%';
  
  invoice_num := 'INV-' || year_part || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN invoice_num;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-generate invoice when payment request is created
CREATE OR REPLACE FUNCTION auto_create_invoice_from_payment_request()
RETURNS TRIGGER AS $$
DECLARE
  invoice_num TEXT;
  artist_name_val TEXT;
  artist_email_val TEXT;
  artist_address_val TEXT;
  artist_phone_val TEXT;
BEGIN
  -- Only create invoice if payment request is created
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    -- Generate invoice number
    SELECT generate_invoice_number() INTO invoice_num;
    
    -- Get artist information from user_profiles
    SELECT 
      up.email,
      '' -- address and phone would need to be added to user_profiles
    INTO artist_email_val, artist_address_val
    FROM user_profiles up
    WHERE up.id = NEW.artist_id;
    
    -- Create invoice
    INSERT INTO invoices (
      payment_request_id,
      artist_id,
      invoice_number,
      artist_name,
      artist_email,
      artist_address,
      artist_phone,
      total_amount,
      status,
      invoice_date
    ) VALUES (
      NEW.id,
      NEW.artist_id,
      invoice_num,
      artist_email_val, -- Use email as name initially
      artist_email_val,
      artist_address_val,
      '',
      NEW.total_amount,
      'pending',
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create invoice when payment request is created
DROP TRIGGER IF EXISTS trigger_auto_create_invoice ON payment_requests;
CREATE TRIGGER trigger_auto_create_invoice
  AFTER INSERT ON payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_invoice_from_payment_request();

-- Trigger to sync invoice status when payment request status changes
CREATE OR REPLACE FUNCTION sync_invoice_status_from_payment_request()
RETURNS TRIGGER AS $$
BEGIN
  -- Update invoice status when payment request status changes
  IF OLD.status != NEW.status THEN
    UPDATE invoices
    SET 
      status = NEW.status,
      updated_at = NOW()
    WHERE payment_request_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_invoice_status ON payment_requests;
CREATE TRIGGER trigger_sync_invoice_status
  AFTER UPDATE ON payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION sync_invoice_status_from_payment_request();

-- Trigger to auto-update invoice timestamp
CREATE OR REPLACE FUNCTION update_invoice_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoice_update_timestamp ON invoices;
CREATE TRIGGER invoice_update_timestamp
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_timestamp();

-- ============================================
-- MIGRATION COMPLETE
-- ============================================










