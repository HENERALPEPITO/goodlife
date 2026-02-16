-- ============================================
-- EXCLUDE ADVANCE PAYMENTS FROM ANALYTICS
-- ============================================
-- This migration updates the dashboard and analytics RPC functions
-- to exclude advance payment records from calculations and displays.
-- Advance payments have top_platform = 'Advance Payment' in royalties_summary.

-- 1. Update get_artist_royalties_summary (if used anywhere, mostly for consistency)
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
      AND rs.top_platform != 'Advance Payment' -- Exclude advance
    ORDER BY rs.total_net DESC;
$$;

-- 2. Update get_artist_available_quarters
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
      AND rs.top_platform != 'Advance Payment' -- Exclude advance
    GROUP BY rs.year, rs.quarter
    ORDER BY rs.year DESC, rs.quarter DESC;
$$;

-- 3. Update get_artist_dashboard_overview
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
    WHERE rs.artist_id = _artist_id
      AND rs.top_platform != 'Advance Payment'; -- Exclude advance
    
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
          AND rs.top_platform != 'Advance Payment' -- Exclude advance
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
          AND rs.top_platform != 'Advance Payment' -- Exclude advance
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
          AND rs.top_platform != 'Advance Payment' -- Exclude advance
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
          AND rs.top_platform != 'Advance Payment' -- Exclude advance
        GROUP BY key
        ORDER BY total DESC
        LIMIT 1
    ) top_terr;
    
    RETURN QUERY
    SELECT 
        _total_earnings as total_earnings,
        _total_streams as total_streams,
        (SELECT COUNT(DISTINCT track_id)::int FROM public.royalties_summary WHERE artist_id = _artist_id AND top_platform != 'Advance Payment') as total_tracks,
        (SELECT COUNT(DISTINCT (year, quarter))::int FROM public.royalties_summary WHERE artist_id = _artist_id AND top_platform != 'Advance Payment') as quarters_count,
        CASE WHEN _total_streams > 0 THEN _total_earnings / _total_streams ELSE 0 END as avg_per_stream,
        _top_territory as top_territory,
        _top_platform as top_platform,
        COALESCE(_platform_agg, '{}'::jsonb) as platform_distribution,
        COALESCE(_territory_agg, '{}'::jsonb) as territory_distribution;
END;
$$;

-- 4. Update get_artist_quarterly_trends
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
      AND rs.top_platform != 'Advance Payment' -- Exclude advance
    GROUP BY rs.year, rs.quarter
    ORDER BY rs.year DESC, rs.quarter DESC
    LIMIT _limit;
$$;

-- 5. Update get_artist_top_tracks
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
      AND rs.top_platform != 'Advance Payment' -- Exclude advance
    GROUP BY rs.track_id, t.title
    ORDER BY total_net DESC
    LIMIT _limit;
$$;

-- 6. Update get_admin_royalties_totals
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
    FROM public.royalties_summary
    WHERE top_platform != 'Advance Payment'; -- Exclude advance
$$;
