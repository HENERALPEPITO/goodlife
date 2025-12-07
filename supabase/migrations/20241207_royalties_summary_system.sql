-- ============================================
-- ROYALTIES SUMMARY SYSTEM MIGRATION
-- ============================================
-- This migration creates a precomputed summary table for royalties
-- and metadata tracking for CSV uploads. Dashboards will query
-- only from the summary table for instant performance.
--
-- Key changes:
-- 1. csv_uploads: Metadata table for tracking CSV file uploads
-- 2. royalties_summary: Precomputed metrics per artist/track/quarter
-- 3. RPC functions for efficient dashboard queries
-- 4. Optimized indexes for fast lookups
-- ============================================

-- ============================================
-- 1. CSV UPLOADS METADATA TABLE
-- ============================================
-- Tracks all CSV uploads for audit and reprocessing capabilities

CREATE TABLE IF NOT EXISTS public.csv_uploads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    filename text NOT NULL,
    storage_path text NOT NULL,
    year int NOT NULL CHECK (year >= 2000 AND year <= 2100),
    quarter int NOT NULL CHECK (quarter >= 1 AND quarter <= 4),
    uploaded_by uuid NOT NULL REFERENCES auth.users(id),
    artist_id uuid NOT NULL REFERENCES public.artists(id),
    file_size bigint,
    row_count int,
    processed_at timestamp with time zone,
    processing_status text DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    processing_error text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Index for querying uploads by artist and period
CREATE INDEX IF NOT EXISTS idx_csv_uploads_artist_period 
ON public.csv_uploads(artist_id, year, quarter);

-- Index for querying by upload status
CREATE INDEX IF NOT EXISTS idx_csv_uploads_status 
ON public.csv_uploads(processing_status);

-- Index for querying by uploader
CREATE INDEX IF NOT EXISTS idx_csv_uploads_uploaded_by 
ON public.csv_uploads(uploaded_by);

-- RLS policies for csv_uploads
ALTER TABLE public.csv_uploads ENABLE ROW LEVEL SECURITY;

-- Admins can view and manage all uploads
CREATE POLICY "Admins can manage csv_uploads" ON public.csv_uploads
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Service role has full access
CREATE POLICY "Service role full access to csv_uploads" ON public.csv_uploads
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================
-- 2. ROYALTIES SUMMARY TABLE
-- ============================================
-- Precomputed aggregated metrics per artist/track/quarter
-- This is the ONLY table dashboards should query

CREATE TABLE IF NOT EXISTS public.royalties_summary (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
    track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
    year int NOT NULL CHECK (year >= 2000 AND year <= 2100),
    quarter int NOT NULL CHECK (quarter >= 1 AND quarter <= 4),
    
    -- Core metrics with high precision
    total_streams bigint NOT NULL DEFAULT 0,
    total_revenue numeric(20, 10) NOT NULL DEFAULT 0,
    total_net numeric(20, 10) NOT NULL DEFAULT 0,
    total_gross numeric(20, 10) NOT NULL DEFAULT 0,
    
    -- Computed metrics
    avg_per_stream numeric(20, 10) NOT NULL DEFAULT 0,
    revenue_per_play numeric(20, 10) NOT NULL DEFAULT 0,
    
    -- Top performers
    top_territory text,
    top_platform text,
    highest_revenue numeric(20, 10) DEFAULT 0,
    
    -- Distribution data (JSONB for flexibility)
    platform_distribution jsonb DEFAULT '{}'::jsonb,   -- e.g., {"Spotify": 0.4, "Apple Music": 0.3}
    territory_distribution jsonb DEFAULT '{}'::jsonb,  -- e.g., {"US": 0.5, "UK": 0.2}
    monthly_breakdown jsonb DEFAULT '{}'::jsonb,       -- e.g., {"Jan": 1000, "Feb": 1200}
    
    -- Record counts for reference
    record_count int NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    -- Ensure unique combination of artist/track/year/quarter
    CONSTRAINT unique_summary_entry UNIQUE (artist_id, track_id, year, quarter)
);

-- Add comments for documentation
COMMENT ON TABLE public.royalties_summary IS 'Precomputed royalty metrics per artist/track/quarter for fast dashboard queries';
COMMENT ON COLUMN public.royalties_summary.total_revenue IS 'Sum of all gross_amount values';
COMMENT ON COLUMN public.royalties_summary.total_net IS 'Sum of all net_amount values';
COMMENT ON COLUMN public.royalties_summary.avg_per_stream IS 'Average revenue per stream (total_net / total_streams)';
COMMENT ON COLUMN public.royalties_summary.platform_distribution IS 'JSON object with platform names as keys and percentage of revenue as values';
COMMENT ON COLUMN public.royalties_summary.territory_distribution IS 'JSON object with territory codes as keys and percentage of revenue as values';

-- ============================================
-- 3. INDEXES FOR ROYALTIES SUMMARY
-- ============================================

-- Primary lookup index: artist + year + quarter
CREATE INDEX IF NOT EXISTS idx_royalties_summary_artist_quarter 
ON public.royalties_summary(artist_id, year DESC, quarter DESC);

-- Track-based lookups
CREATE INDEX IF NOT EXISTS idx_royalties_summary_track 
ON public.royalties_summary(track_id);

-- Year + Quarter index for dashboard time filters
CREATE INDEX IF NOT EXISTS idx_royalties_summary_period 
ON public.royalties_summary(year DESC, quarter DESC);

-- GIN indexes for JSONB columns (for filtering by platform/territory)
CREATE INDEX IF NOT EXISTS idx_royalties_summary_platform_gin 
ON public.royalties_summary USING gin (platform_distribution);

CREATE INDEX IF NOT EXISTS idx_royalties_summary_territory_gin 
ON public.royalties_summary USING gin (territory_distribution);

-- Covering index for common aggregation queries
CREATE INDEX IF NOT EXISTS idx_royalties_summary_metrics 
ON public.royalties_summary(artist_id, year, quarter) 
INCLUDE (total_streams, total_revenue, total_net, total_gross);

-- ============================================
-- 4. RLS POLICIES FOR ROYALTIES SUMMARY
-- ============================================

ALTER TABLE public.royalties_summary ENABLE ROW LEVEL SECURITY;

-- Artists can view their own summary data
CREATE POLICY "Artists can view own royalties_summary" ON public.royalties_summary
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.artists
            WHERE artists.id = royalties_summary.artist_id
            AND artists.user_id = auth.uid()
        )
    );

-- Admins can view and manage all summaries
CREATE POLICY "Admins can manage royalties_summary" ON public.royalties_summary
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Service role has full access
CREATE POLICY "Service role full access to royalties_summary" ON public.royalties_summary
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================
-- 5. RPC FUNCTIONS FOR DASHBOARD QUERIES
-- ============================================

-- 5.1 Get summary for a specific artist and quarter
CREATE OR REPLACE FUNCTION get_artist_royalties_summary(
    _artist_id uuid,
    _year int,
    _quarter int
)
RETURNS TABLE(
    track_id uuid,
    track_title text,
    total_streams bigint,
    total_revenue numeric,
    total_net numeric,
    total_gross numeric,
    avg_per_stream numeric,
    revenue_per_play numeric,
    top_territory text,
    top_platform text,
    highest_revenue numeric,
    platform_distribution jsonb,
    territory_distribution jsonb,
    monthly_breakdown jsonb,
    record_count int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT 
        rs.track_id,
        t.title as track_title,
        rs.total_streams,
        rs.total_revenue,
        rs.total_net,
        rs.total_gross,
        rs.avg_per_stream,
        rs.revenue_per_play,
        rs.top_territory,
        rs.top_platform,
        rs.highest_revenue,
        rs.platform_distribution,
        rs.territory_distribution,
        rs.monthly_breakdown,
        rs.record_count
    FROM public.royalties_summary rs
    JOIN public.tracks t ON t.id = rs.track_id
    WHERE rs.artist_id = _artist_id 
      AND rs.year = _year 
      AND rs.quarter = _quarter
    ORDER BY rs.total_net DESC;
$$;

-- 5.2 Get all quarters available for an artist
CREATE OR REPLACE FUNCTION get_artist_available_quarters(_artist_id uuid)
RETURNS TABLE(
    year int,
    quarter int,
    total_tracks int,
    total_streams bigint,
    total_revenue numeric,
    total_net numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT 
        rs.year,
        rs.quarter,
        COUNT(DISTINCT rs.track_id)::int as total_tracks,
        SUM(rs.total_streams)::bigint as total_streams,
        SUM(rs.total_revenue)::numeric as total_revenue,
        SUM(rs.total_net)::numeric as total_net
    FROM public.royalties_summary rs
    WHERE rs.artist_id = _artist_id
    GROUP BY rs.year, rs.quarter
    ORDER BY rs.year DESC, rs.quarter DESC;
$$;

-- 5.3 Get artist dashboard overview (aggregated across all quarters)
CREATE OR REPLACE FUNCTION get_artist_dashboard_overview(_artist_id uuid)
RETURNS TABLE(
    total_earnings numeric,
    total_streams bigint,
    total_tracks int,
    quarters_count int,
    avg_per_stream numeric,
    top_territory text,
    top_platform text,
    platform_distribution jsonb,
    territory_distribution jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    _total_earnings numeric;
    _total_streams bigint;
    _platform_agg jsonb;
    _territory_agg jsonb;
    _top_platform text;
    _top_territory text;
BEGIN
    -- Calculate totals
    SELECT 
        COALESCE(SUM(rs.total_net), 0),
        COALESCE(SUM(rs.total_streams), 0)
    INTO _total_earnings, _total_streams
    FROM public.royalties_summary rs
    WHERE rs.artist_id = _artist_id;
    
    -- Aggregate platform distribution
    SELECT jsonb_object_agg(
        platform,
        platform_total
    )
    INTO _platform_agg
    FROM (
        SELECT 
            key as platform,
            SUM((value::text)::numeric) as platform_total
        FROM public.royalties_summary rs,
             jsonb_each(rs.platform_distribution)
        WHERE rs.artist_id = _artist_id
        GROUP BY key
        ORDER BY platform_total DESC
    ) platform_totals;
    
    -- Get top platform
    SELECT key INTO _top_platform
    FROM (
        SELECT 
            key,
            SUM((value::text)::numeric) as total
        FROM public.royalties_summary rs,
             jsonb_each(rs.platform_distribution)
        WHERE rs.artist_id = _artist_id
        GROUP BY key
        ORDER BY total DESC
        LIMIT 1
    ) top_plat;
    
    -- Aggregate territory distribution
    SELECT jsonb_object_agg(
        territory,
        territory_total
    )
    INTO _territory_agg
    FROM (
        SELECT 
            key as territory,
            SUM((value::text)::numeric) as territory_total
        FROM public.royalties_summary rs,
             jsonb_each(rs.territory_distribution)
        WHERE rs.artist_id = _artist_id
        GROUP BY key
        ORDER BY territory_total DESC
    ) territory_totals;
    
    -- Get top territory
    SELECT key INTO _top_territory
    FROM (
        SELECT 
            key,
            SUM((value::text)::numeric) as total
        FROM public.royalties_summary rs,
             jsonb_each(rs.territory_distribution)
        WHERE rs.artist_id = _artist_id
        GROUP BY key
        ORDER BY total DESC
        LIMIT 1
    ) top_terr;
    
    RETURN QUERY
    SELECT 
        _total_earnings as total_earnings,
        _total_streams as total_streams,
        (SELECT COUNT(DISTINCT track_id)::int FROM public.royalties_summary WHERE artist_id = _artist_id) as total_tracks,
        (SELECT COUNT(DISTINCT (year, quarter))::int FROM public.royalties_summary WHERE artist_id = _artist_id) as quarters_count,
        CASE WHEN _total_streams > 0 THEN _total_earnings / _total_streams ELSE 0 END as avg_per_stream,
        _top_territory as top_territory,
        _top_platform as top_platform,
        COALESCE(_platform_agg, '{}'::jsonb) as platform_distribution,
        COALESCE(_territory_agg, '{}'::jsonb) as territory_distribution;
END;
$$;

-- 5.4 Get quarterly revenue trends for an artist
CREATE OR REPLACE FUNCTION get_artist_quarterly_trends(
    _artist_id uuid,
    _limit int DEFAULT 8
)
RETURNS TABLE(
    year int,
    quarter int,
    quarter_label text,
    total_streams bigint,
    total_revenue numeric,
    total_net numeric,
    track_count int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT 
        rs.year,
        rs.quarter,
        'Q' || rs.quarter || ' ' || rs.year as quarter_label,
        SUM(rs.total_streams)::bigint as total_streams,
        SUM(rs.total_revenue)::numeric as total_revenue,
        SUM(rs.total_net)::numeric as total_net,
        COUNT(DISTINCT rs.track_id)::int as track_count
    FROM public.royalties_summary rs
    WHERE rs.artist_id = _artist_id
    GROUP BY rs.year, rs.quarter
    ORDER BY rs.year DESC, rs.quarter DESC
    LIMIT _limit;
$$;

-- 5.5 Get top performing tracks for an artist
CREATE OR REPLACE FUNCTION get_artist_top_tracks(
    _artist_id uuid,
    _year int DEFAULT NULL,
    _quarter int DEFAULT NULL,
    _limit int DEFAULT 10
)
RETURNS TABLE(
    track_id uuid,
    track_title text,
    total_streams bigint,
    total_net numeric,
    avg_per_stream numeric,
    top_territory text,
    top_platform text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT 
        rs.track_id,
        t.title as track_title,
        SUM(rs.total_streams)::bigint as total_streams,
        SUM(rs.total_net)::numeric as total_net,
        CASE WHEN SUM(rs.total_streams) > 0 
             THEN SUM(rs.total_net) / SUM(rs.total_streams) 
             ELSE 0 
        END as avg_per_stream,
        (SELECT rs2.top_territory 
         FROM public.royalties_summary rs2 
         WHERE rs2.track_id = rs.track_id AND rs2.artist_id = _artist_id
         ORDER BY rs2.total_net DESC LIMIT 1) as top_territory,
        (SELECT rs2.top_platform 
         FROM public.royalties_summary rs2 
         WHERE rs2.track_id = rs.track_id AND rs2.artist_id = _artist_id
         ORDER BY rs2.total_net DESC LIMIT 1) as top_platform
    FROM public.royalties_summary rs
    JOIN public.tracks t ON t.id = rs.track_id
    WHERE rs.artist_id = _artist_id
      AND (_year IS NULL OR rs.year = _year)
      AND (_quarter IS NULL OR rs.quarter = _quarter)
    GROUP BY rs.track_id, t.title
    ORDER BY total_net DESC
    LIMIT _limit;
$$;

-- 5.6 Admin function: Get totals across all artists
CREATE OR REPLACE FUNCTION get_admin_royalties_totals()
RETURNS TABLE(
    total_revenue numeric,
    total_net numeric,
    total_streams bigint,
    total_artists int,
    total_tracks int,
    total_quarters int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT 
        COALESCE(SUM(total_revenue), 0)::numeric as total_revenue,
        COALESCE(SUM(total_net), 0)::numeric as total_net,
        COALESCE(SUM(total_streams), 0)::bigint as total_streams,
        COUNT(DISTINCT artist_id)::int as total_artists,
        COUNT(DISTINCT track_id)::int as total_tracks,
        COUNT(DISTINCT (year, quarter))::int as total_quarters
    FROM public.royalties_summary;
$$;

-- 5.7 Upsert function for summary records (used during processing)
CREATE OR REPLACE FUNCTION upsert_royalty_summary(
    _artist_id uuid,
    _track_id uuid,
    _year int,
    _quarter int,
    _total_streams bigint,
    _total_revenue numeric,
    _total_net numeric,
    _total_gross numeric,
    _top_territory text,
    _top_platform text,
    _highest_revenue numeric,
    _platform_distribution jsonb,
    _territory_distribution jsonb,
    _monthly_breakdown jsonb,
    _record_count int
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _summary_id uuid;
    _avg_per_stream numeric;
    _revenue_per_play numeric;
BEGIN
    -- Calculate derived metrics
    _avg_per_stream := CASE WHEN _total_streams > 0 THEN _total_net / _total_streams ELSE 0 END;
    _revenue_per_play := CASE WHEN _total_streams > 0 THEN _total_revenue / _total_streams ELSE 0 END;
    
    INSERT INTO public.royalties_summary (
        artist_id,
        track_id,
        year,
        quarter,
        total_streams,
        total_revenue,
        total_net,
        total_gross,
        avg_per_stream,
        revenue_per_play,
        top_territory,
        top_platform,
        highest_revenue,
        platform_distribution,
        territory_distribution,
        monthly_breakdown,
        record_count,
        updated_at
    )
    VALUES (
        _artist_id,
        _track_id,
        _year,
        _quarter,
        _total_streams,
        _total_revenue,
        _total_net,
        _total_gross,
        _avg_per_stream,
        _revenue_per_play,
        _top_territory,
        _top_platform,
        _highest_revenue,
        _platform_distribution,
        _territory_distribution,
        _monthly_breakdown,
        _record_count,
        now()
    )
    ON CONFLICT (artist_id, track_id, year, quarter)
    DO UPDATE SET
        total_streams = EXCLUDED.total_streams,
        total_revenue = EXCLUDED.total_revenue,
        total_net = EXCLUDED.total_net,
        total_gross = EXCLUDED.total_gross,
        avg_per_stream = EXCLUDED.avg_per_stream,
        revenue_per_play = EXCLUDED.revenue_per_play,
        top_territory = EXCLUDED.top_territory,
        top_platform = EXCLUDED.top_platform,
        highest_revenue = EXCLUDED.highest_revenue,
        platform_distribution = EXCLUDED.platform_distribution,
        territory_distribution = EXCLUDED.territory_distribution,
        monthly_breakdown = EXCLUDED.monthly_breakdown,
        record_count = EXCLUDED.record_count,
        updated_at = now()
    RETURNING id INTO _summary_id;
    
    RETURN _summary_id;
END;
$$;

-- ============================================
-- 6. GRANT PERMISSIONS
-- ============================================

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_artist_royalties_summary(uuid, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_artist_royalties_summary(uuid, int, int) TO service_role;

GRANT EXECUTE ON FUNCTION get_artist_available_quarters(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_artist_available_quarters(uuid) TO service_role;

GRANT EXECUTE ON FUNCTION get_artist_dashboard_overview(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_artist_dashboard_overview(uuid) TO service_role;

GRANT EXECUTE ON FUNCTION get_artist_quarterly_trends(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_artist_quarterly_trends(uuid, int) TO service_role;

GRANT EXECUTE ON FUNCTION get_artist_top_tracks(uuid, int, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_artist_top_tracks(uuid, int, int, int) TO service_role;

GRANT EXECUTE ON FUNCTION get_admin_royalties_totals() TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_royalties_totals() TO service_role;

GRANT EXECUTE ON FUNCTION upsert_royalty_summary(uuid, uuid, int, int, bigint, numeric, numeric, numeric, text, text, numeric, jsonb, jsonb, jsonb, int) TO service_role;

-- ============================================
-- 7. UPDATE TRIGGERS
-- ============================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_royalties_summary_modtime
    BEFORE UPDATE ON public.royalties_summary
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_csv_uploads_modtime
    BEFORE UPDATE ON public.csv_uploads
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- ============================================
-- 8. ANALYZE TABLES FOR QUERY OPTIMIZATION
-- ============================================

ANALYZE public.royalties_summary;
ANALYZE public.csv_uploads;
