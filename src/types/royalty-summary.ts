/**
 * Types for Royalty Summary System
 * 
 * This file defines interfaces for the precomputed royalties summary table
 * and related dashboard queries.
 */

// ============================================================================
// CSV Upload Types
// ============================================================================

/**
 * CSV upload metadata record
 */
export interface CsvUploadRecord {
  id: string;
  filename: string;
  storage_path: string;
  year: number;
  quarter: number;
  uploaded_by: string;
  artist_id: string;
  file_size?: number;
  row_count?: number;
  processed_at?: string;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  processing_error?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Request to upload a CSV with year/quarter metadata
 */
export interface CsvUploadRequest {
  artistId: string;
  year: number;
  quarter: number;
  storagePath: string;
  filename: string;
  fileSize: number;
}

// ============================================================================
// Royalty Summary Types
// ============================================================================

/**
 * Royalty summary record from the database
 */
export interface RoyaltySummaryRecord {
  id: string;
  artist_id: string;
  track_id: string;
  year: number;
  quarter: number;
  total_streams: number;
  total_revenue: number;
  total_net: number;
  total_gross: number;
  avg_per_stream: number;
  revenue_per_play: number;
  top_territory: string | null;
  top_platform: string | null;
  highest_revenue: number;
  platform_distribution: Record<string, number>;
  territory_distribution: Record<string, number>;
  monthly_breakdown: Record<string, number>;
  record_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Summary with track details for display
 */
export interface RoyaltySummaryWithTrack extends RoyaltySummaryRecord {
  track_title: string;
}

// ============================================================================
// Dashboard Data Types
// ============================================================================

/**
 * Quarter summary for list view
 */
export interface QuarterSummary {
  year: number;
  quarter: number;
  label: string;
  total_tracks: number;
  total_streams: number;
  total_revenue: number;
  total_net: number;
  storage_path?: string;
  csv_upload_id?: string;
}

/**
 * Artist dashboard overview data
 */
export interface ArtistDashboardOverview {
  total_earnings: number;
  total_streams: number;
  total_tracks: number;
  quarters_count: number;
  avg_per_stream: number;
  top_territory: string | null;
  top_platform: string | null;
  platform_distribution: Record<string, number>;
  territory_distribution: Record<string, number>;
}

/**
 * Quarterly trend data point
 */
export interface QuarterlyTrend {
  year: number;
  quarter: number;
  quarter_label: string;
  total_streams: number;
  total_revenue: number;
  total_net: number;
  track_count: number;
}

/**
 * Top track summary
 */
export interface TopTrack {
  track_id: string;
  track_title: string;
  total_streams: number;
  total_net: number;
  avg_per_stream: number;
  top_territory: string | null;
  top_platform: string | null;
}

/**
 * Admin totals for dashboard
 */
export interface AdminRoyaltiesTotals {
  total_revenue: number;
  total_net: number;
  total_streams: number;
  total_artists: number;
  total_tracks: number;
  total_quarters: number;
}

// ============================================================================
// Summary Processing Types
// ============================================================================

/**
 * Aggregated data for a single track during CSV processing
 */
export interface TrackAggregation {
  track_id: string;
  track_title: string;
  total_streams: number;
  total_revenue: string;  // String for Big.js precision
  total_net: string;      // String for Big.js precision
  total_gross: string;    // String for Big.js precision
  
  // Platform breakdown: platform -> { streams, revenue }
  platforms: Map<string, { streams: number; revenue: string }>;
  
  // Territory breakdown: territory -> { streams, revenue }
  territories: Map<string, { streams: number; revenue: string }>;
  
  // Monthly breakdown: month -> { streams, revenue }
  months: Map<string, { streams: number; revenue: string }>;
  
  record_count: number;
}

/**
 * Aggregation by artist/track/quarter for summary computation
 */
export interface AggregationKey {
  artist_id: string;
  track_id: string;
  year: number;
  quarter: number;
}

/**
 * Result of summary computation from CSV
 */
export interface SummaryComputationResult {
  success: boolean;
  summariesCreated: number;
  summariesUpdated: number;
  totalRows: number;
  errors: string[];
  duration_ms: number;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Response from get_artist_royalties_summary RPC
 */
export interface ArtistRoyaltiesSummaryResponse {
  track_id: string;
  track_title: string;
  total_streams: number;
  total_revenue: number;
  total_net: number;
  total_gross: number;
  avg_per_stream: number;
  revenue_per_play: number;
  top_territory: string | null;
  top_platform: string | null;
  highest_revenue: number;
  platform_distribution: Record<string, number>;
  territory_distribution: Record<string, number>;
  monthly_breakdown: Record<string, number>;
  record_count: number;
}

/**
 * Response from process-royalties-summary API
 */
export interface ProcessSummaryResponse {
  success: boolean;
  upload_id?: string;
  computation?: SummaryComputationResult;
  error?: string;
}

// ============================================================================
// Distribution Helpers
// ============================================================================

/**
 * Convert a map to distribution percentages
 */
export function toDistributionPercentages(
  data: Map<string, { streams: number; revenue: string }>,
  total: number
): Record<string, number> {
  const result: Record<string, number> = {};
  if (total <= 0) return result;
  
  data.forEach((value, key) => {
    result[key] = parseFloat(value.revenue) / total;
  });
  
  return result;
}

/**
 * Get the top item from a distribution map
 */
export function getTopFromDistribution(
  data: Map<string, { streams: number; revenue: string }>
): { key: string; revenue: string } | null {
  let topKey: string | null = null;
  let topRevenue = '0';
  
  data.forEach((value, key) => {
    if (parseFloat(value.revenue) > parseFloat(topRevenue)) {
      topKey = key;
      topRevenue = value.revenue;
    }
  });
  
  return topKey ? { key: topKey, revenue: topRevenue } : null;
}

// ============================================================================
// Quarter Utilities
// ============================================================================

/**
 * Get quarter number (1-4) from a date
 */
export function getQuarterFromDate(date: Date): number {
  return Math.floor(date.getMonth() / 3) + 1;
}

/**
 * Get month name from month number (0-11)
 */
export function getMonthName(month: number): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[month] || 'Unknown';
}

/**
 * Get quarter label string
 */
export function getQuarterLabel(year: number, quarter: number): string {
  return `Q${quarter} ${year}`;
}

/**
 * Parse a date string in various formats
 */
export function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  // Try ISO format first
  let date = new Date(dateStr);
  if (!isNaN(date.getTime())) return date;
  
  // Try common formats
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/,           // YYYY-MM-DD
    /^(\d{2})\/(\d{2})\/(\d{4})$/,          // MM/DD/YYYY or DD/MM/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,      // M/D/YYYY
  ];
  
  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      date = new Date(dateStr);
      if (!isNaN(date.getTime())) return date;
    }
  }
  
  return null;
}
