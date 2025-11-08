-- ============================================
-- PAYMENT REQUEST & INVOICE SYSTEM MIGRATION
-- Complete schema for payment requests with PDF invoices
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. ADD is_paid COLUMN TO ROYALTIES TABLE
-- ============================================

ALTER TABLE royalties 
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_royalties_is_paid ON royalties(is_paid);
CREATE INDEX IF NOT EXISTS idx_royalties_artist_id_is_paid ON royalties(artist_id, is_paid);

-- ============================================
-- 2. ENSURE PAYMENT_REQUESTS TABLE EXISTS
-- ============================================

CREATE TABLE IF NOT EXISTS payment_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id UUID NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  remarks TEXT,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add columns if they don't exist (for existing tables)
ALTER TABLE payment_requests 
ADD COLUMN IF NOT EXISTS remarks TEXT;

ALTER TABLE payment_requests 
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);

ALTER TABLE payment_requests 
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- Fix foreign key to reference artists table (not users)
DO $$
BEGIN
  -- Drop old constraint if exists
  ALTER TABLE payment_requests DROP CONSTRAINT IF EXISTS payment_requests_artist_id_fkey;
  
  -- Add correct constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'payment_requests_artist_id_fkey'
    AND table_name = 'payment_requests'
  ) THEN
    ALTER TABLE payment_requests 
    ADD CONSTRAINT payment_requests_artist_id_fkey 
    FOREIGN KEY (artist_id) 
    REFERENCES artists(id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payment_requests_artist_id ON payment_requests(artist_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_created_at ON payment_requests(created_at DESC);

-- ============================================
-- 3. CREATE FUNCTION TO GET UNPAID ROYALTIES TOTAL
-- ============================================

CREATE OR REPLACE FUNCTION get_unpaid_royalties_total(artist_uuid UUID)
RETURNS NUMERIC AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(net_amount) 
     FROM royalties 
     WHERE artist_id = artist_uuid 
     AND is_paid = FALSE),
    0
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. CREATE FUNCTION TO MARK ROYALTIES AS PAID
-- ============================================

CREATE OR REPLACE FUNCTION mark_royalties_as_paid(artist_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE royalties
  SET is_paid = TRUE
  WHERE artist_id = artist_uuid 
  AND is_paid = FALSE;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. CREATE FUNCTION TO RESTORE ROYALTIES ON REJECTION
-- ============================================

CREATE OR REPLACE FUNCTION restore_royalties_on_rejection(request_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  request_artist_id UUID;
  updated_count INTEGER;
BEGIN
  -- Get the artist_id from the payment request
  SELECT artist_id INTO request_artist_id
  FROM payment_requests
  WHERE id = request_uuid;
  
  IF request_artist_id IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Restore royalties (mark as unpaid)
  UPDATE royalties
  SET is_paid = FALSE
  WHERE artist_id = request_artist_id
  AND is_paid = TRUE;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. CREATE INVOICE SETTINGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS invoice_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_name TEXT DEFAULT 'Good Life Music S.L',
  address TEXT DEFAULT 'Profesor Hermida 6, 3-3C, 36960 Sanxenxo (Spain)',
  tax_id TEXT DEFAULT 'B72510704',
  phone TEXT DEFAULT '+34 693 43 25 06',
  email TEXT DEFAULT 'info@goodlifemusic.com',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings if none exist
INSERT INTO invoice_settings (id)
SELECT uuid_generate_v4()
WHERE NOT EXISTS (SELECT 1 FROM invoice_settings)
LIMIT 1;

-- ============================================
-- 7. UPDATE INVOICES TABLE
-- ============================================

-- Add payment_request_id if not exists
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS payment_request_id UUID REFERENCES payment_requests(id) ON DELETE SET NULL;

-- Add file_url if not exists
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS file_url TEXT;

-- Add invoice_number if not exists
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS invoice_number TEXT UNIQUE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invoices_payment_request_id ON invoices(payment_request_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);

-- ============================================
-- 8. DISABLE RLS FOR EASIER DEVELOPMENT
-- ============================================

ALTER TABLE payment_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE royalties DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 9. VERIFY SCHEMA
-- ============================================

SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'royalties'
AND column_name = 'is_paid';

SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'payment_requests'
ORDER BY ordinal_position;

SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'invoice_settings'
ORDER BY ordinal_position;

SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'invoices'
ORDER BY ordinal_position;

