-- ============================================
-- DATABASE FUNCTION: Get artist-specific royalty totals with precision
-- Uses PostgreSQL SUM for accurate decimal calculations
-- ============================================

-- Function to get totals for a specific artist
CREATE OR REPLACE FUNCTION get_artist_royalty_totals(p_artist_id UUID)
RETURNS TABLE(
  total_gross NUMERIC,
  total_net NUMERIC,
  total_usage BIGINT,
  unpaid_balance NUMERIC,
  record_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(r.gross_amount::NUMERIC), 0)::NUMERIC as total_gross,
    COALESCE(SUM(r.net_amount::NUMERIC), 0)::NUMERIC as total_net,
    COALESCE(SUM(r.usage_count), 0)::BIGINT as total_usage,
    COALESCE(SUM(CASE WHEN r.is_paid = false THEN r.net_amount::NUMERIC ELSE 0 END), 0)::NUMERIC as unpaid_balance,
    COUNT(*)::BIGINT as record_count
  FROM royalties r
  WHERE r.artist_id = p_artist_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_artist_royalty_totals(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_artist_royalty_totals(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_artist_royalty_totals(UUID) TO service_role;

-- ============================================
-- Update the global totals function to include gross
-- ============================================
CREATE OR REPLACE FUNCTION get_royalty_totals()
RETURNS TABLE(
  total_gross NUMERIC,
  total_net NUMERIC,
  total_usage BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(gross_amount::NUMERIC), 0)::NUMERIC as total_gross,
    COALESCE(SUM(net_amount::NUMERIC), 0)::NUMERIC as total_net,
    COALESCE(SUM(usage_count), 0)::BIGINT as total_usage
  FROM royalties;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_royalty_totals() TO authenticated;
GRANT EXECUTE ON FUNCTION get_royalty_totals() TO anon;
GRANT EXECUTE ON FUNCTION get_royalty_totals() TO service_role;
