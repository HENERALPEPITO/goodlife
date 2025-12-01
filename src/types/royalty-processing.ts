/**
 * Types for High-Performance Royalty CSV Processing
 * 
 * This file defines all interfaces used in the streaming CSV processing pipeline
 * with support for Big.js high-precision numerics.
 */

// ============================================================================
// Core Data Types
// ============================================================================

/**
 * Raw CSV row data as parsed from the file (all string values)
 */
export interface RawRoyaltyRow {
  [key: string]: string;
}

/**
 * Normalized royalty row with typed fields
 * Numeric values stored as strings to preserve precision from CSV
 */
export interface NormalizedRoyaltyRow {
  songTitle: string;
  iswc: string;
  composer: string;
  date: string;
  territory: string;
  source: string;
  usageCount: string;      // Stored as string for precision
  gross: string;           // Stored as string for precision
  adminPercent: string;    // Stored as string for precision
  net: string;             // Stored as string for precision
  rowIndex: number;        // Original row index for error reporting
}

/**
 * Validated royalty row ready for database insertion
 */
export interface ValidatedRoyaltyRow extends NormalizedRoyaltyRow {
  isValid: boolean;
  validationErrors: string[];
}

/**
 * Royalty record prepared for database insertion
 */
export interface RoyaltyInsertRecord {
  track_id: string;
  artist_id: string;
  usage_count: number;
  gross_amount: string;     // Stored as string/numeric for DB precision
  admin_percent: string;    // Stored as string/numeric for DB precision
  net_amount: string;       // Stored as string/numeric for DB precision
  broadcast_date: string | null;
  exploitation_source_name: string;
  territory: string;
}

// ============================================================================
// Processing Configuration
// ============================================================================

/**
 * Configuration for batch processing
 */
export interface BatchConfig {
  /** Number of rows per batch (default: 500) */
  batchSize: number;
  /** Maximum concurrent batch insertions (default: 3) */
  maxConcurrency: number;
  /** Number of retry attempts for failed batches (default: 3) */
  retryAttempts: number;
  /** Delay between retries in milliseconds (default: 1000) */
  retryDelayMs: number;
  /** Whether to continue processing after batch failures (default: true) */
  continueOnError: boolean;
}

/**
 * Default batch configuration
 */
export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  batchSize: 500,
  maxConcurrency: 3,
  retryAttempts: 3,
  retryDelayMs: 1000,
  continueOnError: true,
};

// ============================================================================
// Processing Status & Progress
// ============================================================================

/**
 * Current processing status
 */
export type ProcessingStatus = 
  | 'pending'
  | 'uploading'
  | 'parsing'
  | 'validating'
  | 'processing'
  | 'inserting'
  | 'completed'
  | 'failed';

/**
 * Real-time progress update
 */
export interface ProcessingProgress {
  status: ProcessingStatus;
  phase: string;
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  currentBatch: number;
  totalBatches: number;
  percentComplete: number;
  elapsedMs: number;
  estimatedRemainingMs: number;
  rowsPerSecond: number;
}

/**
 * Batch processing result
 */
export interface BatchResult {
  batchIndex: number;
  success: boolean;
  insertedCount: number;
  failedCount: number;
  errors: BatchError[];
  durationMs: number;
  retryCount: number;
}

/**
 * Error from batch processing
 */
export interface BatchError {
  rowIndex: number;
  rowData: NormalizedRoyaltyRow;
  errorMessage: string;
  errorCode?: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Request to start processing a CSV from storage
 */
export interface ProcessRoyaltiesRequest {
  /** Artist ID to associate royalties with */
  artistId: string;
  /** Storage path to the uploaded CSV file */
  storagePath: string;
  /** Optional batch configuration overrides */
  batchConfig?: Partial<BatchConfig>;
}

/**
 * Request to check processing status
 */
export interface ProcessingStatusRequest {
  /** Processing job ID */
  jobId: string;
}

/**
 * Final processing result
 */
export interface ProcessingResult {
  success: boolean;
  jobId: string;
  summary: {
    totalRowsProcessed: number;
    successfulInserts: number;
    failedInserts: number;
    tracksCreated: number;
    tracksExisting: number;
    totalDurationMs: number;
    throughput: number; // rows per second
  };
  failedRows: FailedRowRecord[];
  errors: string[];
}

/**
 * Record of a failed row for CSV export
 */
export interface FailedRowRecord {
  rowIndex: number;
  originalData: Record<string, string>;
  errorMessage: string;
  timestamp: string;
}

// ============================================================================
// Column Mapping Types
// ============================================================================

/**
 * Mapping between standard field names and CSV column headers
 */
export interface ColumnMapping {
  songTitle: string | null;
  iswc: string | null;
  composer: string | null;
  date: string | null;
  territory: string | null;
  source: string | null;
  usageCount: string | null;
  gross: string | null;
  adminPercent: string | null;
  net: string | null;
}

/**
 * Known column name variations for auto-detection
 */
export const COLUMN_VARIATIONS: Record<keyof ColumnMapping, string[]> = {
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

// ============================================================================
// Storage Types
// ============================================================================

/**
 * Result from uploading a file to storage
 */
export interface StorageUploadResult {
  success: boolean;
  path?: string;
  error?: string;
  fileSize?: number;
  contentType?: string;
}

/**
 * Result from downloading a file from storage
 */
export interface StorageDownloadResult {
  success: boolean;
  data?: Blob;
  error?: string;
}

// ============================================================================
// Track Processing Types
// ============================================================================

/**
 * Track record from database
 */
export interface TrackRecord {
  id: string;
  song_title: string;
  artist_id: string;
  composer_name?: string;
  isrc?: string;
}

/**
 * New track to be created
 */
export interface NewTrackRecord {
  artist_id: string;
  song_title: string;
  artist_name: string;
  split: string;
  composer_name?: string;
  isrc?: string;
  title?: string;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Validation result for a single row
 */
export interface RowValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validation rules configuration
 */
export interface ValidationRules {
  requireSongTitle: boolean;
  requireDate: boolean;
  allowNegativeAmounts: boolean;
  maxGrossAmount: number;
  dateFormats: string[];
}

export const DEFAULT_VALIDATION_RULES: ValidationRules = {
  requireSongTitle: true,
  requireDate: false,
  allowNegativeAmounts: true,
  maxGrossAmount: 1000000000, // 1 billion max
  dateFormats: ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY'],
};
