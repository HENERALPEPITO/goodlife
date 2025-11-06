-- ============================================
-- INVOICE MANAGEMENT SYSTEM MIGRATION
-- Extended invoice schema for full CRUD operations
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. CREATE INVOICE LINE ITEMS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);

-- ============================================
-- 2. EXTEND INVOICES TABLE
-- ============================================

-- Add new columns if they don't exist
DO $$ 
BEGIN
  -- Invoice metadata
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'invoice_date') THEN
    ALTER TABLE invoices ADD COLUMN invoice_date TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'due_date') THEN
    ALTER TABLE invoices ADD COLUMN due_date TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Recipient/Company information
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'recipient_name') THEN
    ALTER TABLE invoices ADD COLUMN recipient_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'recipient_email') THEN
    ALTER TABLE invoices ADD COLUMN recipient_email TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'recipient_phone') THEN
    ALTER TABLE invoices ADD COLUMN recipient_phone TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'recipient_address') THEN
    ALTER TABLE invoices ADD COLUMN recipient_address TEXT;
  END IF;

  -- Financial information
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'subtotal') THEN
    ALTER TABLE invoices ADD COLUMN subtotal NUMERIC(12,2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'tax_rate') THEN
    ALTER TABLE invoices ADD COLUMN tax_rate NUMERIC(5,2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'tax_amount') THEN
    ALTER TABLE invoices ADD COLUMN tax_amount NUMERIC(12,2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'currency') THEN
    ALTER TABLE invoices ADD COLUMN currency TEXT DEFAULT '€';
  END IF;

  -- Additional fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'notes') THEN
    ALTER TABLE invoices ADD COLUMN notes TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'logo_url') THEN
    ALTER TABLE invoices ADD COLUMN logo_url TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'created_by') THEN
    ALTER TABLE invoices ADD COLUMN created_by UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- Update existing records to have default values
UPDATE invoices 
SET 
  invoice_date = created_at,
  subtotal = amount,
  currency = '€'
WHERE invoice_date IS NULL;

-- ============================================
-- 3. ROW LEVEL SECURITY FOR LINE ITEMS
-- ============================================

ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;

-- Artists can view line items for their invoices
CREATE POLICY IF NOT EXISTS "Artists can view own invoice line items"
  ON invoice_line_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = invoice_line_items.invoice_id
      AND i.artist_id = auth.uid()
    )
  );

-- Admins can view all line items
CREATE POLICY IF NOT EXISTS "Admins can view all invoice line items"
  ON invoice_line_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Admins can manage all line items
CREATE POLICY IF NOT EXISTS "Admins can manage invoice line items"
  ON invoice_line_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- ============================================
-- 4. UPDATE INVOICE RLS POLICIES
-- ===========================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Artists can view own invoices" ON invoices;
DROP POLICY IF EXISTS "Artists can create own invoices" ON invoices;
DROP POLICY IF EXISTS "Admins can view all invoices" ON invoices;
DROP POLICY IF EXISTS "Admins can update invoices" ON invoices;

-- Artists can view their own invoices
CREATE POLICY "Artists can view own invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (artist_id = auth.uid());

-- Admins can view all invoices
CREATE POLICY "Admins can view all invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Admins can create invoices
CREATE POLICY "Admins can create invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Admins can update invoices
CREATE POLICY "Admins can update invoices"
  ON invoices FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Admins can delete invoices
CREATE POLICY "Admins can delete invoices"
  ON invoices FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- ============================================
-- 5. HELPER FUNCTIONS
-- ============================================

-- Function to calculate invoice total from line items
CREATE OR REPLACE FUNCTION calculate_invoice_total(invoice_uuid UUID)
RETURNS NUMERIC AS $$
DECLARE
  total_subtotal NUMERIC;
  tax_rate_val NUMERIC;
  tax_amount_val NUMERIC;
  final_total NUMERIC;
BEGIN
  -- Calculate subtotal from line items
  SELECT COALESCE(SUM(subtotal), 0) INTO total_subtotal
  FROM invoice_line_items
  WHERE invoice_id = invoice_uuid;
  
  -- Get tax rate from invoice
  SELECT COALESCE(tax_rate, 0), COALESCE(subtotal, total_subtotal) INTO tax_rate_val, total_subtotal
  FROM invoices
  WHERE id = invoice_uuid;
  
  -- Calculate tax
  tax_amount_val := total_subtotal * (tax_rate_val / 100);
  
  -- Calculate total
  final_total := total_subtotal + tax_amount_val;
  
  -- Update invoice
  UPDATE invoices
  SET 
    subtotal = total_subtotal,
    tax_amount = tax_amount_val,
    amount = final_total
  WHERE id = invoice_uuid;
  
  RETURN final_total;
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate total when line items change
CREATE OR REPLACE FUNCTION recalculate_invoice_on_line_item_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM calculate_invoice_total(OLD.invoice_id);
    RETURN OLD;
  ELSE
    PERFORM calculate_invoice_total(NEW.invoice_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_recalculate_invoice ON invoice_line_items;
CREATE TRIGGER trigger_recalculate_invoice
  AFTER INSERT OR UPDATE OR DELETE ON invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_invoice_on_line_item_change();

-- ============================================
-- MIGRATION COMPLETE
-- ============================================







