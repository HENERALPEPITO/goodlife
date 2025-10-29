-- Migration to add invoices table
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. CREATE INVOICES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  mode_of_payment TEXT NOT NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_invoices_artist_id ON invoices(artist_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);

-- ============================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. DROP EXISTING POLICIES (if re-running)
-- ============================================

DROP POLICY IF EXISTS "Artist can view own invoices" ON invoices;
DROP POLICY IF EXISTS "Artist can create invoices" ON invoices;
DROP POLICY IF EXISTS "Artist can update own invoices" ON invoices;
DROP POLICY IF EXISTS "Admins can view all invoices" ON invoices;
DROP POLICY IF EXISTS "Admins can manage invoices" ON invoices;

-- ============================================
-- 5. CREATE RLS POLICIES
-- ============================================

-- Artists can view their own invoices
CREATE POLICY "Artist can view own invoices" 
  ON invoices FOR SELECT 
  USING (artist_id = auth.uid());

-- Artists can create their own invoices
CREATE POLICY "Artist can create invoices" 
  ON invoices FOR INSERT 
  WITH CHECK (artist_id = auth.uid());

-- Artists can update their own pending invoices
CREATE POLICY "Artist can update own invoices" 
  ON invoices FOR UPDATE
  USING (artist_id = auth.uid() AND status = 'pending')
  WITH CHECK (artist_id = auth.uid());

-- Admins can view all invoices
CREATE POLICY "Admins can view all invoices" 
  ON invoices FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can do everything with invoices
CREATE POLICY "Admins can manage invoices" 
  ON invoices FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 6. CREATE FUNCTION TO AUTO-UPDATE updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================
-- 7. CREATE TRIGGER FOR AUTO-UPDATE
-- ============================================

DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;

CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. CREATE FUNCTION TO GENERATE INVOICE NUMBERS
-- ============================================

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  current_year TEXT;
  current_month TEXT;
  sequence_num INTEGER;
BEGIN
  current_year := TO_CHAR(NOW(), 'YY');
  current_month := TO_CHAR(NOW(), 'MM');
  
  -- Get the next sequence number for this month
  SELECT COUNT(*) + 1 INTO sequence_num
  FROM invoices
  WHERE invoice_number LIKE 'INV-' || current_year || current_month || '%';
  
  -- Format: INV-YYMM-XXXX (e.g., INV-2410-0001)
  new_number := 'INV-' || current_year || current_month || '-' || LPAD(sequence_num::TEXT, 4, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;


