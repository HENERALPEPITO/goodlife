-- Invoice / Receipt System Migration
-- Run this SQL in your Supabase SQL Editor

-- ============================================
-- 1. CREATE INVOICES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  mode_of_payment TEXT NOT NULL,
  invoice_number TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. CREATE INDEXES FOR PERFORMANCE
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

DROP POLICY IF EXISTS "Artists can view own invoices" ON invoices;
DROP POLICY IF EXISTS "Artists can create own invoices" ON invoices;
DROP POLICY IF EXISTS "Admins can view all invoices" ON invoices;
DROP POLICY IF EXISTS "Admins can manage all invoices" ON invoices;

-- ============================================
-- 5. CREATE RLS POLICIES
-- ============================================

-- Artists can view their own invoices
CREATE POLICY "Artists can view own invoices" 
  ON invoices FOR SELECT 
  USING (artist_id = auth.uid());

-- Artists can create their own invoices
CREATE POLICY "Artists can create own invoices" 
  ON invoices FOR INSERT 
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

-- Admins can manage all invoices (update and delete)
CREATE POLICY "Admins can manage all invoices" 
  ON invoices FOR ALL 
  USING (
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
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. CREATE TRIGGER FOR AUTO-UPDATE
-- ============================================

DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. CREATE FUNCTION TO GENERATE INVOICE NUMBER
-- ============================================

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  current_year INT;
  next_number INT;
  invoice_num TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Get the highest invoice number for current year
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(invoice_number FROM 'INV-' || current_year::TEXT || '-(\d+)') 
        AS INTEGER
      )
    ), 0
  ) + 1 INTO next_number
  FROM invoices
  WHERE invoice_number LIKE 'INV-' || current_year::TEXT || '-%';
  
  -- Format: INV-2025-001
  invoice_num := 'INV-' || current_year || '-' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN invoice_num;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. SAMPLE DATA (OPTIONAL - for testing)
-- ============================================

-- You can insert sample invoices after creating test users
-- Example:
-- INSERT INTO invoices (artist_id, amount, mode_of_payment, invoice_number, status, remarks)
-- VALUES 
--   ('artist-uuid-here', 1250.50, 'Bank Transfer', generate_invoice_number(), 'pending', 'Q4 2024 royalties'),
--   ('artist-uuid-here', 850.75, 'PayPal', generate_invoice_number(), 'approved', 'October 2024');




