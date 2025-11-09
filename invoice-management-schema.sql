-- ============================================
-- INVOICE MANAGEMENT SYSTEM - DATABASE SCHEMA
-- Supports the new invoice format with statement numbers and periods
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. UPDATE INVOICES TABLE
-- ============================================

-- Add new columns if they don't exist
DO $$ 
BEGIN
  -- Statement information
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'statement_number') THEN
    ALTER TABLE invoices ADD COLUMN statement_number TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'period') THEN
    ALTER TABLE invoices ADD COLUMN period TEXT;
  END IF;
  
  -- Invoice reference (separate from invoice_number)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'invoice_ref') THEN
    ALTER TABLE invoices ADD COLUMN invoice_ref TEXT UNIQUE;
  END IF;
  
  -- Artist information
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'artist_name') THEN
    ALTER TABLE invoices ADD COLUMN artist_name TEXT;
  END IF;
  
  -- Total NET amount (separate from amount)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'total_net') THEN
    ALTER TABLE invoices ADD COLUMN total_net NUMERIC(12,2);
  END IF;
  
  -- Payment options
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'payment_options') THEN
    ALTER TABLE invoices ADD COLUMN payment_options TEXT;
  END IF;
  
  -- Invoice date (if not exists)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'invoice_date') THEN
    ALTER TABLE invoices ADD COLUMN invoice_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
  
  -- Update status constraint if needed
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'invoices_status_check'
  ) THEN
    ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
    ALTER TABLE invoices ADD CONSTRAINT invoices_status_check 
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
  
END $$;

-- Update artist_id foreign key to reference artists table (if not already fixed)
DO $$
BEGIN
  -- Check if foreign key exists and points to users
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu 
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'invoices'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND tc.constraint_name LIKE '%artist_id%'
      AND ccu.table_name = 'users'
  ) THEN
    -- Drop old constraint
    ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_artist_id_fkey;
    
    -- Add new constraint pointing to artists
    ALTER TABLE invoices 
    ADD CONSTRAINT invoices_artist_id_fkey 
    FOREIGN KEY (artist_id) 
    REFERENCES artists(id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invoices_statement_number ON invoices(statement_number);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_ref ON invoices(invoice_ref);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON invoices(period);
CREATE INDEX IF NOT EXISTS idx_invoices_artist_name ON invoices(artist_name);

-- Disable RLS for easier development (can be enabled later)
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. CREATE FUNCTION TO GENERATE INVOICE REF
-- ============================================

CREATE OR REPLACE FUNCTION generate_invoice_ref()
RETURNS TEXT AS $$
DECLARE
  new_ref TEXT;
  ref_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 8-character alphanumeric reference
    new_ref := UPPER(
      SUBSTRING(
        MD5(RANDOM()::TEXT || NOW()::TEXT) 
        FROM 1 FOR 8
      )
    );
    
    -- Check if it exists
    SELECT EXISTS(SELECT 1 FROM invoices WHERE invoice_ref = new_ref) INTO ref_exists;
    
    -- Exit loop if unique
    EXIT WHEN NOT ref_exists;
  END LOOP;
  
  RETURN new_ref;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. VERIFY SCHEMA
-- ============================================

SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'invoices'
ORDER BY ordinal_position;


