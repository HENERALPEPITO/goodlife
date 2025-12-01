/**
 * Royalty CSV Processor
 * 
 * High-performance CSV processing with:
 * - Big.js for arbitrary-precision numerics
 * - Streaming CSV parsing with PapaParse
 * - Configurable batch processing
 * - Retry logic for failed batches
 * - Progress tracking
 */

import Big from 'big.js';
import Papa from 'papaparse';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type {
  RawRoyaltyRow,
  NormalizedRoyaltyRow,
  ValidatedRoyaltyRow,
  RoyaltyInsertRecord,
  BatchConfig,
  BatchResult,
  ProcessingProgress,
  ProcessingResult,
  FailedRowRecord,
  ColumnMapping,
  NewTrackRecord,
} from '@/types/royalty-processing';
import { DEFAULT_BATCH_CONFIG } from '@/types/royalty-processing';

// Configure Big.js for financial precision
Big.DP = 10; // 10 decimal places
Big.RM = Big.roundHalfUp;

// ============================================================================
// Numeric Precision Utilities
// ============================================================================

/**
 * Parse a numeric string with high precision using Big.js
 * Returns the exact string representation to preserve precision
 */
export function parseNumericPrecise(value: string): string {
  if (!value || value.trim() === '') {
    return '0';
  }

  try {
    // Remove any currency symbols and thousands separators
    const cleaned = value
      .replace(/[$€£¥₱,\s]/g, '')
      .replace(/[()]/g, match => match === '(' ? '-' : '')
      .trim();

    if (cleaned === '' || cleaned === '-') {
      return '0';
    }

    // Create Big.js instance and return string representation
    const bigValue = new Big(cleaned);
    return bigValue.toString();
  } catch (error) {
    console.warn(`Failed to parse numeric value: "${value}"`);
    return '0';
  }
}

/**
 * Parse integer with validation
 */
export function parseIntegerPrecise(value: string): number {
  if (!value || value.trim() === '') {
    return 0;
  }

  try {
    const cleaned = value.replace(/[,\s]/g, '').trim();
    const parsed = parseInt(cleaned, 10);
    return isNaN(parsed) ? 0 : parsed;
  } catch {
    return 0;
  }
}

/**
 * Validate that a numeric string is within acceptable bounds
 */
export function validateNumericBounds(
  value: string,
  min: number = -1e15,
  max: number = 1e15
): boolean {
  try {
    const bigValue = new Big(value);
    return bigValue.gte(min) && bigValue.lte(max);
  } catch {
    return false;
  }
}

// ============================================================================
// Column Mapping
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
 */
export function buildColumnMapping(headers: string[]): ColumnMapping {
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
    
    // Try exact match first
    for (const variation of variations) {
      if (headers.includes(variation)) {
        mapping[key] = variation;
        break;
      }
    }

    // Try case-insensitive match
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

  return mapping;
}

// ============================================================================
// Row Normalization & Validation
// ============================================================================

/**
 * Normalize a raw CSV row using the column mapping
 * Preserves exact numeric values as strings for precision
 */
export function normalizeRow(
  row: RawRoyaltyRow,
  mapping: ColumnMapping,
  rowIndex: number
): NormalizedRoyaltyRow {
  const getValue = (field: keyof ColumnMapping): string => {
    const column = mapping[field];
    if (!column) return '';
    return (row[column] || '').trim();
  };

  return {
    songTitle: getValue('songTitle'),
    iswc: getValue('iswc'),
    composer: getValue('composer'),
    date: getValue('date'),
    territory: getValue('territory'),
    source: getValue('source'),
    // Store numeric values as strings to preserve CSV precision
    usageCount: getValue('usageCount'),
    gross: getValue('gross'),
    adminPercent: getValue('adminPercent'),
    net: getValue('net'),
    rowIndex,
  };
}

/**
 * Validate a normalized row
 */
export function validateRow(row: NormalizedRoyaltyRow): ValidatedRoyaltyRow {
  const errors: string[] = [];

  // Required field validation
  if (!row.songTitle || row.songTitle.trim() === '') {
    errors.push('Missing song title');
  }

  // Numeric validation using Big.js
  const numericFields = ['gross', 'adminPercent', 'net'] as const;
  for (const field of numericFields) {
    const value = row[field];
    if (value && value.trim() !== '') {
      try {
        new Big(value.replace(/[$€£¥₱,\s]/g, ''));
      } catch {
        errors.push(`Invalid ${field} value: "${value}"`);
      }
    }
  }

  // Usage count should be a valid integer
  if (row.usageCount && row.usageCount.trim() !== '') {
    const parsed = parseInt(row.usageCount.replace(/[,\s]/g, ''), 10);
    if (isNaN(parsed)) {
      errors.push(`Invalid usage count: "${row.usageCount}"`);
    }
  }

  return {
    ...row,
    isValid: errors.length === 0,
    validationErrors: errors,
  };
}

// ============================================================================
// Streaming CSV Parser
// ============================================================================

/**
 * Parse CSV content using streaming with PapaParse
 * Returns normalized and validated rows
 */
export async function parseCSVStreaming(
  csvContent: string,
  onProgress?: (parsed: number, total: number) => void
): Promise<{
  validRows: ValidatedRoyaltyRow[];
  invalidRows: ValidatedRoyaltyRow[];
  headers: string[];
  totalRows: number;
}> {
  return new Promise((resolve, reject) => {
    const validRows: ValidatedRoyaltyRow[] = [];
    const invalidRows: ValidatedRoyaltyRow[] = [];
    let headers: string[] = [];
    let mapping: ColumnMapping | null = null;
    let rowIndex = 0;
    const totalEstimate = (csvContent.match(/\n/g) || []).length;

    Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false, // Keep all values as strings for precision
      transformHeader: (header) => header.trim(),
      step: (results: Papa.ParseStepResult<RawRoyaltyRow>) => {
        // On first row, build column mapping
        if (!mapping) {
          headers = results.meta.fields || [];
          mapping = buildColumnMapping(headers);
        }

        const rawRow = results.data;
        const normalizedRow = normalizeRow(rawRow, mapping!, rowIndex);
        const validatedRow = validateRow(normalizedRow);

        if (validatedRow.isValid) {
          validRows.push(validatedRow);
        } else {
          invalidRows.push(validatedRow);
        }

        rowIndex++;

        // Report progress periodically
        if (onProgress && rowIndex % 1000 === 0) {
          onProgress(rowIndex, totalEstimate);
        }
      },
      complete: () => {
        resolve({
          validRows,
          invalidRows,
          headers,
          totalRows: rowIndex,
        });
      },
      error: (error: Error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`));
      },
    });
  });
}

// ============================================================================
// Track Processing
// ============================================================================

/**
 * Get or create tracks for the royalty rows
 * Returns a map of song title to track ID
 */
export async function getOrCreateTracks(
  artistId: string,
  rows: ValidatedRoyaltyRow[]
): Promise<Map<string, string>> {
  const supabaseAdmin = getSupabaseAdmin();
  const tracksByTitle = new Map<string, string>();

  // Get unique song titles
  const uniqueTitles = [...new Set(rows.map(r => r.songTitle).filter(Boolean))];
  
  if (uniqueTitles.length === 0) {
    return tracksByTitle;
  }

  console.log(`🎵 Processing ${uniqueTitles.length} unique tracks...`);

  // Batch fetch existing tracks (Supabase has limits on IN clause)
  const TRACK_BATCH_SIZE = 100;
  const existingTracks: { id: string; song_title: string }[] = [];

  for (let i = 0; i < uniqueTitles.length; i += TRACK_BATCH_SIZE) {
    const batch = uniqueTitles.slice(i, i + TRACK_BATCH_SIZE);
    const { data, error } = await supabaseAdmin
      .from('tracks')
      .select('id, song_title')
      .eq('artist_id', artistId)
      .in('song_title', batch);

    if (error) {
      console.error('Error fetching tracks:', error);
      throw new Error(`Failed to fetch tracks: ${error.message}`);
    }

    if (data) {
      existingTracks.push(...data);
    }
  }

  // Map existing tracks
  existingTracks.forEach(track => {
    tracksByTitle.set(track.song_title, track.id);
  });

  console.log(`✅ Found ${existingTracks.length} existing tracks`);

  // Find titles that need to be created
  const titlesToCreate = uniqueTitles.filter(title => !tracksByTitle.has(title));

  if (titlesToCreate.length > 0) {
    console.log(`🆕 Creating ${titlesToCreate.length} new tracks...`);

    // Build track records with composer/ISWC from first occurrence
    const tracksToInsert: NewTrackRecord[] = titlesToCreate.map(songTitle => {
      const firstRow = rows.find(r => r.songTitle === songTitle);
      
      const trackData: NewTrackRecord = {
        artist_id: artistId,
        song_title: songTitle || 'Unknown',
        artist_name: '',
        split: '100%',
      };

      if (firstRow?.composer && firstRow.composer.trim() !== '') {
        trackData.composer_name = firstRow.composer;
      }

      if (firstRow?.iswc && firstRow.iswc.trim() !== '') {
        trackData.isrc = firstRow.iswc;
      }

      if (songTitle) {
        trackData.title = songTitle;
      }

      return trackData;
    });

    // Insert tracks in batches
    const TRACK_INSERT_BATCH = 200;
    for (let i = 0; i < tracksToInsert.length; i += TRACK_INSERT_BATCH) {
      const batch = tracksToInsert.slice(i, i + TRACK_INSERT_BATCH);
      
      const { data: newTracks, error: trackError } = await supabaseAdmin
        .from('tracks')
        .insert(batch)
        .select('id, song_title');

      if (trackError) {
        console.error('Bulk track creation error:', trackError);
        throw new Error(`Failed to create tracks: ${trackError.message}`);
      }

      if (newTracks) {
        newTracks.forEach(track => {
          tracksByTitle.set(track.song_title, track.id);
        });
      }
    }

    console.log(`✅ Created ${titlesToCreate.length} new tracks`);
  }

  return tracksByTitle;
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Process a single batch with retry logic
 */
async function processBatchWithRetry(
  batch: RoyaltyInsertRecord[],
  batchIndex: number,
  config: BatchConfig
): Promise<BatchResult> {
  const supabaseAdmin = getSupabaseAdmin();
  const startTime = Date.now();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.retryAttempts; attempt++) {
    try {
      const { error } = await supabaseAdmin
        .from('royalties')
        .insert(batch);

      if (error) {
        throw new Error(error.message);
      }

      return {
        batchIndex,
        success: true,
        insertedCount: batch.length,
        failedCount: 0,
        errors: [],
        durationMs: Date.now() - startTime,
        retryCount: attempt,
      };
    } catch (error: any) {
      lastError = error;
      console.warn(`Batch ${batchIndex} attempt ${attempt + 1} failed: ${error.message}`);

      if (attempt < config.retryAttempts) {
        // Exponential backoff
        const delay = config.retryDelayMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  return {
    batchIndex,
    success: false,
    insertedCount: 0,
    failedCount: batch.length,
    errors: batch.map((row, idx) => ({
      rowIndex: -1, // We don't track original row index in batch
      rowData: {} as NormalizedRoyaltyRow,
      errorMessage: lastError?.message || 'Unknown error',
    })),
    durationMs: Date.now() - startTime,
    retryCount: config.retryAttempts,
  };
}

/**
 * Insert royalty records in batches with concurrency control
 */
export async function insertRoyaltiesInBatches(
  records: RoyaltyInsertRecord[],
  config: BatchConfig,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<{
  totalInserted: number;
  totalFailed: number;
  batchResults: BatchResult[];
}> {
  const batchResults: BatchResult[] = [];
  let totalInserted = 0;
  let totalFailed = 0;
  const startTime = Date.now();

  // Split into batches
  const batches: RoyaltyInsertRecord[][] = [];
  for (let i = 0; i < records.length; i += config.batchSize) {
    batches.push(records.slice(i, i + config.batchSize));
  }

  const totalBatches = batches.length;
  console.log(`💾 Inserting ${records.length} records in ${totalBatches} batches of ${config.batchSize}...`);

  // Process batches with concurrency control
  let completedBatches = 0;

  // Process in waves of concurrent batches
  for (let waveStart = 0; waveStart < batches.length; waveStart += config.maxConcurrency) {
    const waveEnd = Math.min(waveStart + config.maxConcurrency, batches.length);
    const waveBatches = batches.slice(waveStart, waveEnd);

    const wavePromises = waveBatches.map((batch, idx) =>
      processBatchWithRetry(batch, waveStart + idx, config)
    );

    const waveResults = await Promise.all(wavePromises);

    for (const result of waveResults) {
      batchResults.push(result);
      totalInserted += result.insertedCount;
      totalFailed += result.failedCount;
      completedBatches++;

      console.log(
        `${result.success ? '✅' : '❌'} Batch ${result.batchIndex + 1}/${totalBatches}: ` +
        `${result.insertedCount} inserted, ${result.failedCount} failed ` +
        `(${result.durationMs}ms, retries: ${result.retryCount})`
      );
    }

    // Report progress
    if (onProgress) {
      const elapsed = Date.now() - startTime;
      const rowsPerSecond = totalInserted > 0 ? Math.round(totalInserted / (elapsed / 1000)) : 0;
      const estimatedRemaining = rowsPerSecond > 0
        ? Math.round(((records.length - totalInserted - totalFailed) / rowsPerSecond) * 1000)
        : 0;

      onProgress({
        status: 'inserting',
        phase: 'Inserting royalty records',
        totalRows: records.length,
        processedRows: totalInserted + totalFailed,
        successfulRows: totalInserted,
        failedRows: totalFailed,
        currentBatch: completedBatches,
        totalBatches,
        percentComplete: Math.round((completedBatches / totalBatches) * 100),
        elapsedMs: elapsed,
        estimatedRemainingMs: estimatedRemaining,
        rowsPerSecond,
      });
    }
  }

  return { totalInserted, totalFailed, batchResults };
}

// ============================================================================
// Main Processing Function
// ============================================================================

/**
 * Process a complete royalty CSV file
 * 
 * @param csvContent - Raw CSV content as string
 * @param artistId - Artist ID to associate royalties with
 * @param config - Batch processing configuration
 * @param onProgress - Progress callback for real-time updates
 */
export async function processRoyaltyCsv(
  csvContent: string,
  artistId: string,
  config: BatchConfig = DEFAULT_BATCH_CONFIG,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<ProcessingResult> {
  const startTime = Date.now();
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const failedRows: FailedRowRecord[] = [];
  const errors: string[] = [];

  try {
    // Phase 1: Parse CSV
    console.log(`📥 Starting CSV processing for artist ${artistId}`);
    
    if (onProgress) {
      onProgress({
        status: 'parsing',
        phase: 'Parsing CSV file',
        totalRows: 0,
        processedRows: 0,
        successfulRows: 0,
        failedRows: 0,
        currentBatch: 0,
        totalBatches: 0,
        percentComplete: 5,
        elapsedMs: Date.now() - startTime,
        estimatedRemainingMs: 0,
        rowsPerSecond: 0,
      });
    }

    const parseResult = await parseCSVStreaming(csvContent, (parsed, total) => {
      if (onProgress) {
        onProgress({
          status: 'parsing',
          phase: `Parsing row ${parsed}/${total}`,
          totalRows: total,
          processedRows: parsed,
          successfulRows: 0,
          failedRows: 0,
          currentBatch: 0,
          totalBatches: 0,
          percentComplete: Math.round((parsed / total) * 20), // 0-20%
          elapsedMs: Date.now() - startTime,
          estimatedRemainingMs: 0,
          rowsPerSecond: 0,
        });
      }
    });

    console.log(`📊 Parsed ${parseResult.totalRows} rows: ${parseResult.validRows.length} valid, ${parseResult.invalidRows.length} invalid`);

    // Record failed rows from parsing
    parseResult.invalidRows.forEach(row => {
      failedRows.push({
        rowIndex: row.rowIndex,
        originalData: {
          songTitle: row.songTitle,
          iswc: row.iswc,
          composer: row.composer,
          date: row.date,
          territory: row.territory,
          source: row.source,
          usageCount: row.usageCount,
          gross: row.gross,
          adminPercent: row.adminPercent,
          net: row.net,
        },
        errorMessage: row.validationErrors.join('; '),
        timestamp: new Date().toISOString(),
      });
    });

    if (parseResult.validRows.length === 0) {
      throw new Error('No valid rows found in CSV');
    }

    // Phase 2: Get/Create Tracks
    if (onProgress) {
      onProgress({
        status: 'processing',
        phase: 'Processing tracks',
        totalRows: parseResult.totalRows,
        processedRows: parseResult.totalRows,
        successfulRows: 0,
        failedRows: parseResult.invalidRows.length,
        currentBatch: 0,
        totalBatches: 0,
        percentComplete: 30,
        elapsedMs: Date.now() - startTime,
        estimatedRemainingMs: 0,
        rowsPerSecond: 0,
      });
    }

    const tracksByTitle = await getOrCreateTracks(artistId, parseResult.validRows);

    // Phase 3: Prepare royalty records with high precision
    if (onProgress) {
      onProgress({
        status: 'processing',
        phase: 'Preparing royalty records',
        totalRows: parseResult.totalRows,
        processedRows: parseResult.totalRows,
        successfulRows: 0,
        failedRows: parseResult.invalidRows.length,
        currentBatch: 0,
        totalBatches: 0,
        percentComplete: 40,
        elapsedMs: Date.now() - startTime,
        estimatedRemainingMs: 0,
        rowsPerSecond: 0,
      });
    }

    const royaltiesToInsert: RoyaltyInsertRecord[] = [];

    for (const row of parseResult.validRows) {
      const trackId = tracksByTitle.get(row.songTitle);
      
      if (!trackId) {
        failedRows.push({
          rowIndex: row.rowIndex,
          originalData: row as any,
          errorMessage: `Track not found for song: ${row.songTitle}`,
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      // Use Big.js for precise numeric parsing
      royaltiesToInsert.push({
        track_id: trackId,
        artist_id: artistId,
        usage_count: parseIntegerPrecise(row.usageCount),
        gross_amount: parseNumericPrecise(row.gross),
        admin_percent: parseNumericPrecise(row.adminPercent),
        net_amount: parseNumericPrecise(row.net),
        broadcast_date: row.date || null,
        exploitation_source_name: row.source,
        territory: row.territory,
      });
    }

    // Phase 4: Batch insert
    const tracksCreated = tracksByTitle.size - (await getExistingTracksCount(artistId, [...tracksByTitle.keys()]));
    
    const insertResult = await insertRoyaltiesInBatches(
      royaltiesToInsert,
      config,
      onProgress
    );

    // Final summary
    const totalDurationMs = Date.now() - startTime;
    const throughput = Math.round(insertResult.totalInserted / (totalDurationMs / 1000));

    console.log(`🎉 Processing complete in ${(totalDurationMs / 1000).toFixed(2)}s`);
    console.log(`   - Rows processed: ${parseResult.totalRows}`);
    console.log(`   - Successfully inserted: ${insertResult.totalInserted}`);
    console.log(`   - Failed: ${insertResult.totalFailed + failedRows.length}`);
    console.log(`   - Throughput: ${throughput} rows/sec`);

    if (onProgress) {
      onProgress({
        status: 'completed',
        phase: 'Processing complete',
        totalRows: parseResult.totalRows,
        processedRows: parseResult.totalRows,
        successfulRows: insertResult.totalInserted,
        failedRows: insertResult.totalFailed + failedRows.length,
        currentBatch: insertResult.batchResults.length,
        totalBatches: insertResult.batchResults.length,
        percentComplete: 100,
        elapsedMs: totalDurationMs,
        estimatedRemainingMs: 0,
        rowsPerSecond: throughput,
      });
    }

    return {
      success: true,
      jobId,
      summary: {
        totalRowsProcessed: parseResult.totalRows,
        successfulInserts: insertResult.totalInserted,
        failedInserts: insertResult.totalFailed + failedRows.length,
        tracksCreated,
        tracksExisting: tracksByTitle.size - tracksCreated,
        totalDurationMs,
        throughput,
      },
      failedRows,
      errors,
    };
  } catch (error: any) {
    console.error('❌ Processing error:', error);
    errors.push(error.message);

    if (onProgress) {
      onProgress({
        status: 'failed',
        phase: `Error: ${error.message}`,
        totalRows: 0,
        processedRows: 0,
        successfulRows: 0,
        failedRows: 0,
        currentBatch: 0,
        totalBatches: 0,
        percentComplete: 0,
        elapsedMs: Date.now() - startTime,
        estimatedRemainingMs: 0,
        rowsPerSecond: 0,
      });
    }

    return {
      success: false,
      jobId,
      summary: {
        totalRowsProcessed: 0,
        successfulInserts: 0,
        failedInserts: 0,
        tracksCreated: 0,
        tracksExisting: 0,
        totalDurationMs: Date.now() - startTime,
        throughput: 0,
      },
      failedRows,
      errors,
    };
  }
}

/**
 * Helper to count existing tracks (for summary)
 */
async function getExistingTracksCount(artistId: string, titles: string[]): Promise<number> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { count } = await supabaseAdmin
      .from('tracks')
      .select('id', { count: 'exact', head: true })
      .eq('artist_id', artistId)
      .in('song_title', titles.slice(0, 100)); // Sample check

    return count || 0;
  } catch {
    return 0;
  }
}

/**
 * Generate a CSV of failed rows for download
 */
export function generateFailedRowsCsv(failedRows: FailedRowRecord[]): string {
  if (failedRows.length === 0) {
    return '';
  }

  const headers = [
    'Row Index',
    'Song Title',
    'ISWC',
    'Composer',
    'Date',
    'Territory',
    'Source',
    'Usage Count',
    'Gross',
    'Admin %',
    'Net',
    'Error',
    'Timestamp',
  ];

  const rows = failedRows.map(row => [
    row.rowIndex,
    row.originalData.songTitle || '',
    row.originalData.iswc || '',
    row.originalData.composer || '',
    row.originalData.date || '',
    row.originalData.territory || '',
    row.originalData.source || '',
    row.originalData.usageCount || '',
    row.originalData.gross || '',
    row.originalData.adminPercent || '',
    row.originalData.net || '',
    row.errorMessage,
    row.timestamp,
  ]);

  const csvContent = [
    headers.map(h => `"${h}"`).join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  return csvContent;
}
