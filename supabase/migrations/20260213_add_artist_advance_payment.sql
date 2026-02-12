-- Add advance_payment column to artists table
ALTER TABLE artists ADD COLUMN IF NOT EXISTS advance_payment NUMERIC DEFAULT 0;
