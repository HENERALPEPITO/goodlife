-- Allow unmatched royalty rows without creating catalog tracks.
-- Upload Royalties must remain catalog-write free.
ALTER TABLE public.royalties_summary
  ALTER COLUMN track_id DROP NOT NULL;
