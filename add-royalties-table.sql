-- Add royalties table to existing Supabase database
-- Run this in your Supabase SQL Editor

-- Create royalties table for CSV uploads
CREATE TABLE IF NOT EXISTS public.royalties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  song_title TEXT,
  iswc TEXT,
  song_composers TEXT,
  broadcast_date DATE,
  territory TEXT,
  exploitation_source_name TEXT,
  usage_count INTEGER,
  gross_amount NUMERIC(12,6),
  administration_percent NUMERIC(5,2),
  net_amount NUMERIC(12,6),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_royalties_user_id 
  ON public.royalties(user_id);
CREATE INDEX IF NOT EXISTS idx_royalties_created_at 
  ON public.royalties(created_at);

-- Enable RLS
ALTER TABLE public.royalties ENABLE ROW LEVEL SECURITY;

-- Create policies for royalties table
DO $$
BEGIN
  -- Allow all users to view all royalties (you can restrict this later)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read access on royalties' AND tablename = 'royalties'
  ) THEN
    CREATE POLICY "Allow public read access on royalties"
      ON public.royalties FOR SELECT USING (true);
  END IF;

  -- Allow all users to insert royalties (you can restrict this later)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow public insert on royalties' AND tablename = 'royalties'
  ) THEN
    CREATE POLICY "Allow public insert on royalties"
      ON public.royalties FOR INSERT WITH CHECK (true);
  END IF;

  -- Allow all users to update royalties (you can restrict this later)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow public update on royalties' AND tablename = 'royalties'
  ) THEN
    CREATE POLICY "Allow public update on royalties"
      ON public.royalties FOR UPDATE USING (true);
  END IF;

  -- Allow all users to delete royalties (you can restrict this later)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow public delete on royalties' AND tablename = 'royalties'
  ) THEN
    CREATE POLICY "Allow public delete on royalties"
      ON public.royalties FOR DELETE USING (true);
  END IF;
END $$;


