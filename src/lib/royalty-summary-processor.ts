/**
 * Royalty Summary Processor
 * 
 * This module handles the computation of aggregated metrics from raw CSV data
 * and inserts/updates records in the royalties_summary table.
 * 
 * Key features:
 * - Streams CSV in chunks for memory efficiency
 * - Uses Big.js for high-precision numeric calculations
 * - Aggregates data per track/platform/territory
 * - Computes distribution percentages
 * - Upserts summary records via RPC function
 */

import Big from 'big.js';
import Papa from 'papaparse';
import { getSupabaseAdmin } from './supabaseAdmin';
import type { 
  TrackAggregation, 
  SummaryComputationResult 
} from '@/types/royalty-summary';
import type {
  ColumnMapping,
  NormalizedRoyaltyRow,
  ValidatedRoyaltyRow,
  FailedRowRecord,
} from '@/types/royalty-processing';

// ============================================================================
// Column Mapping (same as existing processor)
// ============================================================================

const COLUMN_VARIATIONS_MAP: Record<keyof ColumnMapping, string[]> = {
  songTitle: ["Song Title", "song title", "title", "Title", "SongTitle", "song_title"],
  iswc: ["ISWC", "iswc", "Iswc", "ISWC Code", "iswc_code"],
  composer: ["Composer", "composer", "Composer Name", "Song Composer(s)", "Song Composers", "composer_name"],
  date: ["Date", "date", "Broadcast Date", "broadcast_date", "BroadcastDate"],
  territory: ["Territory", "territory", "Country", "country", "Region"],
  source: ["Source", "source", "Platform", "platform", "Exploitation Source", "exploitation_source"],
  usageCount: ["Usage Count", "usage count", "Usage Cou", "Usage", "usage", "usage_count", "UsageCount"],
  gross: ["Gross", "gross", "Gross Amount", "gross_amount", "GrossAmount"],
  adminPercent: ["Admin %", "admin %", "Admin Percent", "admin_percent", "AdminPercent", "Admin"],
  net: ["Net", "net", "Net Amount", "net_amount", "NetAmount"],
};

/**
 * Build column mapping from CSV headers
 * Handles empty column headers by checking position
 */
function buildColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    songTitle: null,
    iswc: null,
    composer: null,
    date: null,
    territory: null,
    source: null,
    usageCount: null,
    gross: null,
    adminPercent: null,
    net: null,
  };

  const headerLowerMap = new Map<string, string>();
  headers.forEach(h => headerLowerMap.set(h.toLowerCase().trim(), h));

  for (const [field, variations] of Object.entries(COLUMN_VARIATIONS_MAP)) {
    const key = field as keyof ColumnMapping;
    
    for (const variation of variations) {
      if (headers.includes(variation)) {
        mapping[key] = variation;
        break;
      }
    }

    if (!mapping[key]) {
      for (const variation of variations) {
        const found = headerLowerMap.get(variation.toLowerCase());
        if (found) {
          mapping[key] = found;
          break;
        }
      }
    }
  }

  // Handle empty column headers - check for blank/empty headers that might be usage count
  // Common pattern: empty header between Source and Gross columns contains usage data
  if (!mapping.usageCount) {
    const emptyHeaders = headers.filter(h => h.trim() === '' || h.trim() === ' ');
    if (emptyHeaders.length > 0) {
      // Use the first empty header as usage count
      mapping.usageCount = emptyHeaders[0];
      console.log(`   Auto-detected empty column "${emptyHeaders[0]}" as usageCount`);
    }
  }

  return mapping;
}

// ============================================================================
// Numeric Parsing with Big.js
// ============================================================================

/**
 * Parse a string to Big.js with high precision
 */
function parseBig(value: string): Big {
  try {
    const cleaned = value.replace(/[,\s$€£]/g, '').trim();
    if (!cleaned || cleaned === '' || cleaned === '-') {
      return new Big(0);
    }
    return new Big(cleaned);
  } catch {
    return new Big(0);
  }
}

/**
 * Parse integer from string
 */
function parseIntSafe(value: string): number {
  const cleaned = value.replace(/[,\s]/g, '').trim();
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Get month name from date
 */
function getMonthFromDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[date.getMonth()];
  } catch {
    return null;
  }
}

// ============================================================================
// CSV Parsing and Aggregation
// ============================================================================

interface ParsedCSVResult {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

/**
 * Parse CSV content using PapaParse
 */
function parseCSV(csvContent: string): ParsedCSVResult {
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  return {
    headers: result.meta.fields || [],
    rows: result.data,
    totalRows: result.data.length,
  };
}

/**
 * Aggregate CSV data by track
 */
async function aggregateByTrack(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  artistId: string,
  year: number,
  quarter: number
): Promise<{
  aggregations: Map<string, TrackAggregation>;
  failedRows: FailedRowRecord[];
  trackTitleToId: Map<string, string>;
}> {
  const supabaseAdmin = getSupabaseAdmin();
  const aggregations = new Map<string, TrackAggregation>();
  const failedRows: FailedRowRecord[] = [];
  const trackTitles = new Set<string>();

  // First pass: collect all unique track titles
  rows.forEach((row, index) => {
    const songTitle = mapping.songTitle ? (row[mapping.songTitle] || '').trim() : '';
    if (songTitle) {
      trackTitles.add(songTitle);
    }
  });

  // Get or create tracks for all titles
  const trackTitleToId = new Map<string, string>();
  
  if (trackTitles.size > 0) {
    // Fetch existing tracks
    const { data: existingTracks } = await supabaseAdmin
      .from('tracks')
      .select('id, title')
      .eq('artist_id', artistId)
      .in('title', Array.from(trackTitles));

    if (existingTracks) {
      existingTracks.forEach(track => {
        trackTitleToId.set(track.title, track.id);
      });
    }

    // Create missing tracks
    const missingTitles = Array.from(trackTitles).filter(title => !trackTitleToId.has(title));
    
    if (missingTitles.length > 0) {
      // Get artist name for new tracks
      const { data: artist } = await supabaseAdmin
        .from('artists')
        .select('name')
        .eq('id', artistId)
        .single();

      const newTracks = missingTitles.map(title => ({
        artist_id: artistId,
        title: title,
        song_title: title,
        artist_name: artist?.name || 'Unknown',
        split: '100',
      }));

      const { data: createdTracks, error } = await supabaseAdmin
        .from('tracks')
        .insert(newTracks)
        .select('id, title');

      if (createdTracks) {
        createdTracks.forEach(track => {
          trackTitleToId.set(track.title, track.id);
        });
      }

      if (error) {
        console.error('Error creating tracks:', error);
      }
    }
  }

  // Second pass: aggregate data
  rows.forEach((row, index) => {
    try {
      const songTitle = mapping.songTitle ? (row[mapping.songTitle] || '').trim() : '';
      
      if (!songTitle) {
        failedRows.push({
          rowIndex: index + 2, // +2 for 1-based + header
          originalData: row,
          errorMessage: 'Missing song title',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const trackId = trackTitleToId.get(songTitle);
      if (!trackId) {
        failedRows.push({
          rowIndex: index + 2,
          originalData: row,
          errorMessage: `Track not found: ${songTitle}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const territory = mapping.territory ? (row[mapping.territory] || 'Unknown').trim() : 'Unknown';
      const source = mapping.source ? (row[mapping.source] || 'Unknown').trim() : 'Unknown';
      const dateStr = mapping.date ? (row[mapping.date] || '').trim() : '';
      const usageCount = mapping.usageCount ? parseIntSafe(row[mapping.usageCount] || '0') : 0;
      const gross = mapping.gross ? parseBig(row[mapping.gross] || '0') : new Big(0);
      const net = mapping.net ? parseBig(row[mapping.net] || '0') : new Big(0);

      const month = getMonthFromDate(dateStr) || 'Unknown';

      // Get or create aggregation for this track
      let agg = aggregations.get(trackId);
      if (!agg) {
        agg = {
          track_id: trackId,
          track_title: songTitle,
          total_streams: 0,
          total_revenue: '0',
          total_net: '0',
          total_gross: '0',
          platforms: new Map(),
          territories: new Map(),
          months: new Map(),
          record_count: 0,
        };
        aggregations.set(trackId, agg);
      }

      // Update aggregation
      agg.total_streams += usageCount;
      agg.total_revenue = new Big(agg.total_revenue).plus(gross).toString();
      agg.total_net = new Big(agg.total_net).plus(net).toString();
      agg.total_gross = new Big(agg.total_gross).plus(gross).toString();
      agg.record_count += 1;

      // Platform breakdown
      const platformData = agg.platforms.get(source) || { streams: 0, revenue: '0' };
      platformData.streams += usageCount;
      platformData.revenue = new Big(platformData.revenue).plus(net).toString();
      agg.platforms.set(source, platformData);

      // Territory breakdown
      const territoryData = agg.territories.get(territory) || { streams: 0, revenue: '0' };
      territoryData.streams += usageCount;
      territoryData.revenue = new Big(territoryData.revenue).plus(net).toString();
      agg.territories.set(territory, territoryData);

      // Monthly breakdown
      const monthData = agg.months.get(month) || { streams: 0, revenue: '0' };
      monthData.streams += usageCount;
      monthData.revenue = new Big(monthData.revenue).plus(net).toString();
      agg.months.set(month, monthData);

    } catch (error: any) {
      failedRows.push({
        rowIndex: index + 2,
        originalData: row,
        errorMessage: error?.message || 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  return { aggregations, failedRows, trackTitleToId };
}

/**
 * Convert platform/territory maps to distribution percentages
 */
function computeDistributions(
  data: Map<string, { streams: number; revenue: string }>,
  totalNet: Big
): Record<string, number> {
  const distribution: Record<string, number> = {};
  
  if (totalNet.eq(0)) return distribution;

  data.forEach((value, key) => {
    const revenue = new Big(value.revenue);
    distribution[key] = parseFloat(revenue.div(totalNet).toFixed(6));
  });

  return distribution;
}

/**
 * Get top item from a distribution map
 */
function getTopItem(
  data: Map<string, { streams: number; revenue: string }>
): { key: string; revenue: string } | null {
  let topKey: string | null = null;
  let topRevenue = new Big(0);

  data.forEach((value, key) => {
    const revenue = new Big(value.revenue);
    if (revenue.gt(topRevenue)) {
      topKey = key;
      topRevenue = revenue;
    }
  });

  return topKey ? { key: topKey, revenue: topRevenue.toString() } : null;
}

/**
 * Convert monthly map to JSON object
 */
function monthsToJson(
  data: Map<string, { streams: number; revenue: string }>
): Record<string, number> {
  const result: Record<string, number> = {};
  data.forEach((value, key) => {
    result[key] = parseFloat(new Big(value.revenue).toFixed(2));
  });
  return result;
}

// ============================================================================
// Summary Upsert
// ============================================================================

/**
 * Upsert summary records using batch operations
 * Uses Supabase upsert with onConflict for efficient bulk insert/update
 */
async function upsertSummaries(
  aggregations: Map<string, TrackAggregation>,
  artistId: string,
  year: number,
  quarter: number
): Promise<{ created: number; updated: number; errors: string[] }> {
  const supabaseAdmin = getSupabaseAdmin();
  const errors: string[] = [];

  // Prepare all records for batch upsert
  const records: any[] = [];
  
  for (const [trackId, agg] of aggregations) {
    try {
      const totalNet = new Big(agg.total_net);
      const totalGross = new Big(agg.total_gross);
      const totalRevenue = new Big(agg.total_revenue);

      const topTerritory = getTopItem(agg.territories);
      const topPlatform = getTopItem(agg.platforms);

      const platformDistribution = computeDistributions(agg.platforms, totalNet);
      const territoryDistribution = computeDistributions(agg.territories, totalNet);
      const monthlyBreakdown = monthsToJson(agg.months);

      // Debug: Log first record's distribution data
      if (records.length === 0) {
        console.log('[CSV Processor Debug] First track distributions:', {
          trackId,
          trackTitle: agg.track_title,
          platformsCount: agg.platforms.size,
          territoriesCount: agg.territories.size,
          platformDistribution,
          territoryDistribution,
          topTerritory: topTerritory?.key,
          topPlatform: topPlatform?.key,
        });
      }

      records.push({
        artist_id: artistId,
        track_id: trackId,
        year: year,
        quarter: quarter,
        total_streams: agg.total_streams,
        total_revenue: totalRevenue.toFixed(10),
        total_net: totalNet.toFixed(10),
        total_gross: totalGross.toFixed(10),
        avg_per_stream: agg.total_streams > 0 
          ? totalNet.div(agg.total_streams).toFixed(10) 
          : '0',
        revenue_per_play: agg.total_streams > 0 
          ? totalRevenue.div(agg.total_streams).toFixed(10) 
          : '0',
        top_territory: topTerritory?.key || null,
        top_platform: topPlatform?.key || null,
        highest_revenue: topTerritory ? topTerritory.revenue : '0',
        platform_distribution: platformDistribution,
        territory_distribution: territoryDistribution,
        monthly_breakdown: monthlyBreakdown,
        record_count: agg.record_count,
        updated_at: new Date().toISOString(),
      });
    } catch (error: any) {
      errors.push(`Error preparing track ${trackId}: ${error?.message || 'Unknown'}`);
    }
  }

  if (records.length === 0) {
    return { created: 0, updated: 0, errors };
  }

  // Batch upsert in chunks to avoid request size limits
  const BATCH_SIZE = 100;
  let totalUpserted = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(records.length / BATCH_SIZE);
    
    console.log(`   Upserting batch ${batchNum}/${totalBatches} (${batch.length} records)...`);

    const { error, count } = await supabaseAdmin
      .from('royalties_summary')
      .upsert(batch, {
        onConflict: 'artist_id,track_id,year,quarter',
        ignoreDuplicates: false,
      });

    if (error) {
      errors.push(`Batch ${batchNum} failed: ${error.message}`);
      console.error(`   ❌ Batch ${batchNum} error:`, error.message);
    } else {
      totalUpserted += batch.length;
      console.log(`   ✅ Batch ${batchNum} completed`);
    }
  }

  // We can't easily distinguish created vs updated with upsert, so report as created
  return { created: totalUpserted, updated: 0, errors };
}

// ============================================================================
// Main Processing Function
// ============================================================================

export interface ProcessSummaryOptions {
  artistId: string;
  year: number;
  quarter: number;
  csvContent: string;
  uploadId?: string;
}

/**
 * Process CSV content and compute summaries
 */
export async function processRoyaltySummary(
  options: ProcessSummaryOptions
): Promise<SummaryComputationResult & { failedRows: FailedRowRecord[] }> {
  const startTime = Date.now();
  const { artistId, year, quarter, csvContent } = options;

  console.log(`📊 Processing royalty summary for artist ${artistId}, Q${quarter} ${year}`);

  try {
    // Parse CSV
    console.log('📥 Parsing CSV...');
    const parsed = parseCSV(csvContent);
    console.log(`   Parsed ${parsed.totalRows} rows with headers: ${parsed.headers.join(', ')}`);

    if (parsed.totalRows === 0) {
      return {
        success: false,
        summariesCreated: 0,
        summariesUpdated: 0,
        totalRows: 0,
        errors: ['No data rows found in CSV'],
        duration_ms: Date.now() - startTime,
        failedRows: [],
      };
    }

    // Build column mapping
    const mapping = buildColumnMapping(parsed.headers);
    console.log(`   Column mapping: ${JSON.stringify(mapping)}`);

    // Validate essential columns exist
    if (!mapping.songTitle) {
      return {
        success: false,
        summariesCreated: 0,
        summariesUpdated: 0,
        totalRows: parsed.totalRows,
        errors: ['Missing required column: Song Title'],
        duration_ms: Date.now() - startTime,
        failedRows: [],
      };
    }

    // Aggregate data
    console.log('🔄 Aggregating data by track...');
    const { aggregations, failedRows } = await aggregateByTrack(
      parsed.rows,
      mapping,
      artistId,
      year,
      quarter
    );
    console.log(`   Created ${aggregations.size} track aggregations, ${failedRows.length} failed rows`);

    // Upsert summaries
    console.log('💾 Upserting summaries...');
    const { created, updated, errors } = await upsertSummaries(
      aggregations,
      artistId,
      year,
      quarter
    );
    console.log(`   Created: ${created}, Updated: ${updated}, Errors: ${errors.length}`);

    const duration = Date.now() - startTime;
    console.log(`✅ Processing complete in ${(duration / 1000).toFixed(2)}s`);

    return {
      success: errors.length === 0 && (created > 0 || updated > 0),
      summariesCreated: created,
      summariesUpdated: updated,
      totalRows: parsed.totalRows,
      errors: errors,
      duration_ms: duration,
      failedRows,
    };

  } catch (error: any) {
    console.error('❌ Processing error:', error);
    return {
      success: false,
      summariesCreated: 0,
      summariesUpdated: 0,
      totalRows: 0,
      errors: [error?.message || 'Unknown error'],
      duration_ms: Date.now() - startTime,
      failedRows: [],
    };
  }
}

/**
 * Generate CSV content for failed rows
 */
export function generateFailedRowsCsv(failedRows: FailedRowRecord[]): string {
  if (failedRows.length === 0) return '';

  const headers = ['Row Index', 'Error Message', 'Timestamp', ...Object.keys(failedRows[0].originalData)];
  const rows = failedRows.map(row => [
    row.rowIndex.toString(),
    row.errorMessage,
    row.timestamp,
    ...Object.values(row.originalData).map(v => String(v)),
  ]);

  return [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}
