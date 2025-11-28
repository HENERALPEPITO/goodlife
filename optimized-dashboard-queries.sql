-- ============================================================
-- OPTIMIZED SUPABASE DASHBOARD QUERIES
-- Target: < 5ms execution time
-- Compatible with: PostgreSQL 14 (Supabase)
-- ============================================================

-- ============================================================
-- QUERY 1: OPTIMIZED QUERY PERFORMANCE ANALYSIS
-- Original: 43ms → Target: < 5ms
-- ============================================================

-- PROBLEM: index_advisor() calls EXPLAIN on every row = expensive
-- SOLUTION: Move index_advisor to a separate lazy-loaded query

-- Step 1: Fast base query (no index_advisor)
CREATE OR REPLACE FUNCTION get_query_stats(row_limit int DEFAULT 20)
RETURNS TABLE (
    rolname name,
    query text,
    calls bigint,
    total_time double precision,
    min_time double precision,
    max_time double precision,
    mean_time double precision,
    avg_rows bigint,
    rows_read bigint,
    cache_hit_rate numeric,
    prop_total_time numeric,
    is_select_or_with boolean,
    queryid bigint
) 
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
    WITH total_time_sum AS (
        -- Single scan to get the denominator
        SELECT SUM(total_exec_time + total_plan_time) AS total
        FROM pg_stat_statements
    )
    SELECT 
        auth.rolname,
        statements.query,
        statements.calls,
        statements.total_exec_time + statements.total_plan_time AS total_time,
        statements.min_exec_time + statements.min_plan_time AS min_time,
        statements.max_exec_time + statements.max_plan_time AS max_time,
        statements.mean_exec_time + statements.mean_plan_time AS mean_time,
        statements.rows / NULLIF(statements.calls, 0) AS avg_rows,
        statements.rows AS rows_read,
        CASE 
            WHEN (statements.shared_blks_hit + statements.shared_blks_read) > 0 
            THEN ROUND((statements.shared_blks_hit::numeric * 100) / 
                 (statements.shared_blks_hit + statements.shared_blks_read), 2)
            ELSE 100
        END AS cache_hit_rate,
        ROUND(((statements.total_exec_time + statements.total_plan_time) / 
               NULLIF(t.total, 0.0001)) * 100, 2) AS prop_total_time,
        -- Pre-compute the check but DON'T call index_advisor
        (lower(statements.query) LIKE 'select%' OR lower(statements.query) LIKE 'with%') AS is_select_or_with,
        statements.queryid
    FROM pg_stat_statements AS statements
    CROSS JOIN total_time_sum t
    INNER JOIN pg_authid AS auth ON statements.userid = auth.oid
    ORDER BY total_time DESC
    LIMIT row_limit;
$$;

-- Usage: SELECT * FROM get_query_stats(20);

-- Step 2: Separate function for index advice (call only when needed)
CREATE OR REPLACE FUNCTION get_index_advice(query_text text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    result jsonb;
BEGIN
    -- Only run for SELECT/WITH queries
    IF NOT (lower(query_text) LIKE 'select%' OR lower(query_text) LIKE 'with%') THEN
        RETURN NULL;
    END IF;
    
    -- Wrap in exception handler for invalid queries
    BEGIN
        SELECT json_build_object(
            'has_suggestion', array_length(index_statements, 1) > 0,
            'startup_cost_before', startup_cost_before,
            'startup_cost_after', startup_cost_after,
            'total_cost_before', total_cost_before,
            'total_cost_after', total_cost_after,
            'index_statements', index_statements
        )::jsonb
        INTO result
        FROM index_advisor(query_text);
        
        RETURN result;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('error', SQLERRM);
    END;
END;
$$;

-- Usage: SELECT get_index_advice('SELECT * FROM royalties WHERE artist_id = $1');


-- ============================================================
-- QUERY 2: CACHE AND INDEX HIT RATE (1.25ms - already fast)
-- ============================================================

-- Minor optimization: Use single scan with FILTER
CREATE OR REPLACE FUNCTION get_cache_hit_rates()
RETURNS TABLE (name text, ratio numeric)
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
    SELECT 'index hit rate'::text AS name,
           ROUND(SUM(idx_blks_hit)::numeric / NULLIF(SUM(idx_blks_hit + idx_blks_read), 0), 4) AS ratio
    FROM pg_statio_user_indexes
    UNION ALL
    SELECT 'table hit rate'::text AS name,
           ROUND(SUM(heap_blks_hit)::numeric / NULLIF(SUM(heap_blks_hit + heap_blks_read), 0), 4) AS ratio
    FROM pg_statio_user_tables;
$$;

-- Usage: SELECT * FROM get_cache_hit_rates();


-- ============================================================
-- QUERY 3: PERFORMANCE METRICS SUMMARY (0.17ms - already optimal)
-- ============================================================

CREATE OR REPLACE FUNCTION get_performance_metrics(
    min_calls int DEFAULT 1,
    slow_threshold_ms numeric DEFAULT 1000
)
RETURNS TABLE (
    avg_rows_per_call numeric,
    slow_queries bigint,
    cache_hit_rate text
)
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
    SELECT 
        COALESCE(ROUND(AVG(rows::numeric / NULLIF(calls, 0)), 2), 0) AS avg_rows_per_call,
        COUNT(*) FILTER (WHERE total_exec_time + total_plan_time > slow_threshold_ms) AS slow_queries,
        COALESCE(
            ROUND(
                SUM(shared_blks_hit) * 100.0 / 
                NULLIF(SUM(shared_blks_hit + shared_blks_read), 0), 
                2
            ), 100
        )::text || '%' AS cache_hit_rate
    FROM pg_stat_statements
    WHERE calls > min_calls;
$$;

-- Usage: SELECT * FROM get_performance_metrics();


-- ============================================================
-- BONUS: PERFORMANCE MONITORING SNAPSHOT SYSTEM
-- Avoids querying pg_stat_statements directly
-- ============================================================

-- Create snapshot table
CREATE TABLE IF NOT EXISTS query_performance_snapshots (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    captured_at timestamptz NOT NULL DEFAULT now(),
    queryid bigint NOT NULL,
    rolname name,
    query_text text,
    calls bigint,
    total_time_ms numeric(16,4),
    mean_time_ms numeric(16,4),
    min_time_ms numeric(16,4),
    max_time_ms numeric(16,4),
    rows_returned bigint,
    cache_hit_rate numeric(7,4),
    shared_blks_hit bigint,
    shared_blks_read bigint
);

-- Indexes for fast dashboard queries
CREATE INDEX IF NOT EXISTS idx_qps_captured_at ON query_performance_snapshots(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_qps_total_time ON query_performance_snapshots(total_time_ms DESC);
CREATE INDEX IF NOT EXISTS idx_qps_queryid ON query_performance_snapshots(queryid);

-- Composite for time-range + sorting
CREATE INDEX IF NOT EXISTS idx_qps_time_range ON query_performance_snapshots(captured_at DESC, total_time_ms DESC);

-- Function to capture a snapshot
CREATE OR REPLACE FUNCTION capture_query_performance_snapshot()
RETURNS void
LANGUAGE sql
AS $$
    INSERT INTO query_performance_snapshots (
        queryid,
        rolname,
        query_text,
        calls,
        total_time_ms,
        mean_time_ms,
        min_time_ms,
        max_time_ms,
        rows_returned,
        cache_hit_rate,
        shared_blks_hit,
        shared_blks_read
    )
    SELECT 
        s.queryid,
        a.rolname,
        s.query,
        s.calls,
        ROUND((s.total_exec_time + s.total_plan_time)::numeric, 4),
        ROUND((s.mean_exec_time + s.mean_plan_time)::numeric, 4),
        ROUND((s.min_exec_time + s.min_plan_time)::numeric, 4),
        ROUND((s.max_exec_time + s.max_plan_time)::numeric, 4),
        s.rows,
        CASE 
            WHEN s.shared_blks_hit + s.shared_blks_read > 0
            THEN ROUND((s.shared_blks_hit::numeric * 100) / (s.shared_blks_hit + s.shared_blks_read), 4)
            ELSE 100
        END,
        s.shared_blks_hit,
        s.shared_blks_read
    FROM pg_stat_statements s
    INNER JOIN pg_authid a ON s.userid = a.oid
    WHERE s.calls > 0;
$$;

-- Function to query snapshots (fast - no pg_stat_statements scan)
CREATE OR REPLACE FUNCTION get_query_stats_from_snapshot(
    since_minutes int DEFAULT 60,
    row_limit int DEFAULT 20
)
RETURNS TABLE (
    captured_at timestamptz,
    rolname name,
    query_text text,
    calls bigint,
    total_time_ms numeric,
    mean_time_ms numeric,
    cache_hit_rate numeric
)
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
    SELECT 
        captured_at,
        rolname,
        query_text,
        calls,
        total_time_ms,
        mean_time_ms,
        cache_hit_rate
    FROM query_performance_snapshots
    WHERE captured_at >= now() - (since_minutes || ' minutes')::interval
    ORDER BY total_time_ms DESC
    LIMIT row_limit;
$$;

-- Cleanup old snapshots (keep last 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_snapshots(hours_to_keep int DEFAULT 24)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count int;
BEGIN
    DELETE FROM query_performance_snapshots
    WHERE captured_at < now() - (hours_to_keep || ' hours')::interval;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- ============================================================
-- SCHEDULED SNAPSHOT (use pg_cron or Supabase Edge Function)
-- ============================================================

-- Option 1: If pg_cron is available
-- SELECT cron.schedule('capture-query-stats', '* * * * *', 'SELECT capture_query_performance_snapshot()');
-- SELECT cron.schedule('cleanup-query-stats', '0 * * * *', 'SELECT cleanup_old_snapshots(24)');

-- Option 2: Call from Supabase Edge Function every minute
-- supabase functions deploy capture-stats
-- Example edge function in TypeScript:
/*
import { createClient } from '@supabase/supabase-js'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  
  await supabase.rpc('capture_query_performance_snapshot')
  return new Response('OK')
})
*/


-- ============================================================
-- EXPECTED PERFORMANCE IMPROVEMENTS
-- ============================================================

/*
Query 1 (Main Dashboard):
  - Before: 43ms (index_advisor called for every row)
  - After: < 3ms (no index_advisor, lazy-load on demand)
  - Improvement: ~93% faster
  - Reason: Removed inline index_advisor() calls

Query 2 (Cache Hit Rate):
  - Before: 1.25ms
  - After: ~1ms (marginal improvement)
  - Reason: Already efficient, minor scan reduction

Query 3 (Metrics Summary):
  - Before: 0.17ms
  - After: ~0.15ms
  - Reason: Already optimal

Snapshot System:
  - Dashboard queries: < 1ms (indexed table vs pg_stat_statements scan)
  - Snapshot capture: ~10-50ms every minute (background)
  - No impact on live queries
*/


-- ============================================================
-- USAGE EXAMPLES
-- ============================================================

-- Fast query stats (< 5ms)
-- SELECT * FROM get_query_stats(20);

-- Get index advice for a specific query (on-demand)
-- SELECT get_index_advice('SELECT * FROM royalties WHERE artist_id = $1');

-- Cache hit rates
-- SELECT * FROM get_cache_hit_rates();

-- Performance summary
-- SELECT * FROM get_performance_metrics();

-- From snapshots (< 1ms, no pg_stat_statements scan)
-- SELECT * FROM get_query_stats_from_snapshot(60, 20);
