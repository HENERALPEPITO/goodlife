-- 🧱 SAFE, NON-DESTRUCTIVE GOODLIFE SCHEMA FOR SUPABASE

-- Create user_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('artist', 'label', 'manager')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tracks table if not exists
CREATE TABLE IF NOT EXISTS public.tracks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  isrc TEXT NOT NULL,
  composers TEXT NOT NULL,
  release_date DATE NOT NULL,
  platform TEXT NOT NULL,
  territory TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create royalty_statements table if not exists
CREATE TABLE IF NOT EXISTS public.royalty_statements (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  track_title TEXT NOT NULL,
  platform TEXT NOT NULL,
  period TEXT NOT NULL,
  streams INTEGER NOT NULL,
  revenue_usd DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('paid', 'pending')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes if not exists
CREATE INDEX IF NOT EXISTS idx_tracks_created_at 
  ON public.tracks(created_at);
CREATE INDEX IF NOT EXISTS idx_royalty_statements_track_id 
  ON public.royalty_statements(track_id);
CREATE INDEX IF NOT EXISTS idx_royalty_statements_status 
  ON public.royalty_statements(status);
CREATE INDEX IF NOT EXISTS idx_royalty_statements_period 
  ON public.royalty_statements(period);

-- Insert sample data safely
INSERT INTO public.tracks (id, title, isrc, composers, release_date, platform, territory, created_at)
VALUES
  ('t1', 'Sunrise', 'US-ABC-25-00001', 'C. Elipan, A. Reyes', '2025-07-12', 'Spotify', 'Global', NOW()),
  ('t2', 'Ocean Drive', 'US-ABC-25-00002', 'C. Elipan', '2025-05-03', 'Apple Music', 'US', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.royalty_statements (id, track_id, track_title, platform, period, streams, revenue_usd, status, created_at)
VALUES
  ('r1', 't1', 'Sunrise', 'Spotify', '2025-Q1', 15000, 750.50, 'paid', NOW()),
  ('r2', 't1', 'Sunrise', 'Apple Music', '2025-Q1', 8500, 425.25, 'paid', NOW()),
  ('r3', 't2', 'Ocean Drive', 'Spotify', '2025-Q1', 22000, 1100.00, 'pending', NOW()),
  ('r4', 't2', 'Ocean Drive', 'YouTube', '2025-Q1', 12000, 600.00, 'paid', NOW())
ON CONFLICT (id) DO NOTHING;

-- ✅ Enable RLS (safe, will not overwrite)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.royalty_statements ENABLE ROW LEVEL SECURITY;

-- ✅ Create policies only if they don't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own profile' AND tablename = 'user_profiles'
  ) THEN
    CREATE POLICY "Users can view own profile"
      ON public.user_profiles
      FOR SELECT USING ((SELECT auth.uid()) = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own profile' AND tablename = 'user_profiles'
  ) THEN
    CREATE POLICY "Users can update own profile"
      ON public.user_profiles
      FOR UPDATE USING ((SELECT auth.uid()) = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own profile' AND tablename = 'user_profiles'
  ) THEN
    CREATE POLICY "Users can insert own profile"
      ON public.user_profiles
      FOR INSERT WITH CHECK ((SELECT auth.uid()) = id);
  END IF;

  -- Public access policies for tracks
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read access on tracks' AND tablename = 'tracks'
  ) THEN
    CREATE POLICY "Allow public read access on tracks"
      ON public.tracks FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow public insert on tracks' AND tablename = 'tracks'
  ) THEN
    CREATE POLICY "Allow public insert on tracks"
      ON public.tracks FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow public update on tracks' AND tablename = 'tracks'
  ) THEN
    CREATE POLICY "Allow public update on tracks"
      ON public.tracks FOR UPDATE USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow public delete on tracks' AND tablename = 'tracks'
  ) THEN
    CREATE POLICY "Allow public delete on tracks"
      ON public.tracks FOR DELETE USING (true);
  END IF;

  -- Public access policies for royalty_statements
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read access on royalty_statements' AND tablename = 'royalty_statements'
  ) THEN
    CREATE POLICY "Allow public read access on royalty_statements"
      ON public.royalty_statements FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow public insert on royalty_statements' AND tablename = 'royalty_statements'
  ) THEN
    CREATE POLICY "Allow public insert on royalty_statements"
      ON public.royalty_statements FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow public update on royalty_statements' AND tablename = 'royalty_statements'
  ) THEN
    CREATE POLICY "Allow public update on royalty_statements"
      ON public.royalty_statements FOR UPDATE USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow public delete on royalty_statements' AND tablename = 'royalty_statements'
  ) THEN
    CREATE POLICY "Allow public delete on royalty_statements"
      ON public.royalty_statements FOR DELETE USING (true);
  END IF;
END $$;
