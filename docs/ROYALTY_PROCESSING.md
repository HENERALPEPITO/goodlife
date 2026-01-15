# High-Performance Royalty CSV Processing System

This document describes the architecture and usage of the royalty CSV processing system, designed for handling large files with millions of rows efficiently.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Key Features](#key-features)
3. [Folder Structure](#folder-structure)
4. [Configuration Options](#configuration-options)
5. [API Endpoints](#api-endpoints)
6. [Performance Optimization](#performance-optimization)
7. [Error Handling](#error-handling)
8. [Security](#security)
9. [Setup Instructions](#setup-instructions)

---

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Client UI     │────▶│ Supabase Storage │────▶│  Process API    │
│ (royalty-uploader)    │  (royalty-uploads)│     │ (/api/process-  │
│                 │     │                  │     │  royalties)     │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
                                               ┌─────────────────────┐
                                               │  Royalty Processor  │
                                               │  - Streaming Parse  │
                                               │  - Big.js Precision │
                                               │  - Batch Inserts    │
                                               └──────────┬──────────┘
                                                          │
                                                          ▼
                                               ┌─────────────────────┐
                                               │  Supabase Database  │
                                               │  - tracks table     │
                                               │  - royalties table  │
                                               └─────────────────────┘
```

### Processing Flow

1. **Client Upload**: User selects CSV file and artist, file is uploaded to Supabase Storage
2. **API Trigger**: Client calls `/api/process-royalties` with storage path and config
3. **Download**: Server fetches CSV from storage using admin credentials
4. **Stream Parse**: PapaParse streams through CSV row-by-row
5. **Validate**: Each row is validated with high-precision numeric parsing via Big.js
6. **Track Creation**: New tracks are bulk-created as needed
7. **Batch Insert**: Royalties are inserted in configurable batches with retry logic
8. **Response**: Summary with success/fail counts and optional failed rows CSV

---

## Key Features

### 1. High Numeric Precision (Big.js)

All monetary values are parsed and stored using Big.js arbitrary-precision library:

```typescript
import Big from 'big.js';

// Configure for financial precision
Big.DP = 10; // 10 decimal places
Big.RM = Big.roundHalfUp;

// Parse value preserving exact CSV representation
function parseNumericPrecise(value: string): string {
  const cleaned = value.replace(/[$$£¥₱,\s]/g, '');
  const bigValue = new Big(cleaned);
  return bigValue.toString(); // Exact string representation
}
```

**Benefits:**
- No floating-point rounding errors
- Exact CSV values stored in database
- Supports values like `"123456789.1234567890"` precisely

### 2. Streaming CSV Parsing

Uses PapaParse with streaming mode for memory-efficient processing:

```typescript
Papa.parse(csvContent, {
  header: true,
  skipEmptyLines: true,
  dynamicTyping: false, // Keep as strings for precision
  step: (results) => {
    // Process each row immediately
    const validatedRow = validateRow(normalizeRow(results.data));
    // ...
  },
});
```

**Benefits:**
- Constant memory usage regardless of file size
- Can process files with millions of rows
- Immediate validation on each row

### 3. Configurable Batch Processing

Split rows into batches for efficient database inserts:

```typescript
interface BatchConfig {
  batchSize: number;      // Rows per batch (default: 500)
  maxConcurrency: number; // Parallel batches (default: 3)
  retryAttempts: number;  // Retries per batch (default: 3)
  retryDelayMs: number;   // Delay between retries (default: 1000)
  continueOnError: boolean; // Continue after failures (default: true)
}
```

**Tuning Guidelines:**
- **batchSize**: 500-1000 for most cases, lower for slow connections
- **maxConcurrency**: 3-5 for Supabase Pro, 1-2 for free tier
- **retryAttempts**: 3 is usually sufficient

### 4. Retry Logic

Exponential backoff for failed batches:

```typescript
for (let attempt = 0; attempt <= config.retryAttempts; attempt++) {
  try {
    await supabaseAdmin.from('royalties').insert(batch);
    break; // Success
  } catch (error) {
    const delay = config.retryDelayMs * Math.pow(2, attempt);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}
```

---

## Folder Structure

```
src/
├── app/
│   ├── api/
│   │   ├── process-royalties/
│   │   │   └── route.ts          # Main processing endpoint
│   │   └── royalties/
│   │       └── ingest/
│   │           └── route.ts      # Legacy direct-parse endpoint
│   └── royalty-uploader/
│       └── page.tsx              # Admin upload UI
├── lib/
│   ├── royalty-processor.ts      # Core processing logic
│   ├── royalty-storage.ts        # Supabase Storage utilities
│   ├── supabaseAdmin.ts          # Admin client (service role)
│   └── supabaseClient.ts         # Client-side Supabase
└── types/
    ├── index.ts                  # Type exports
    └── royalty-processing.ts     # Processing type definitions
```

---

## Configuration Options

### Environment Variables

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Server-side only!
```

### Supabase Storage Setup

Create a storage bucket named `royalty-uploads`:

```sql
-- Run in Supabase SQL Editor
INSERT INTO storage.buckets (id, name, public)
VALUES ('royalty-uploads', 'royalty-uploads', false);

-- RLS policy for authenticated uploads
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'royalty-uploads');
```

---

## API Endpoints

### POST /api/process-royalties

Process a CSV from storage with full batch processing.

**Request:**
```json
{
  "artistId": "uuid-of-artist",
  "storagePath": "artistId/timestamp-filename.csv",
  "batchConfig": {
    "batchSize": 500,
    "maxConcurrency": 3,
    "retryAttempts": 3
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "job_1234567890_abc123",
    "summary": {
      "totalRowsProcessed": 100000,
      "successfulInserts": 99850,
      "failedInserts": 150,
      "tracksCreated": 500,
      "tracksExisting": 1200,
      "totalDurationMs": 45000,
      "throughput": 2200
    },
    "failedRows": [...],
    "errors": []
  },
  "failedRowsCsv": "Row Index,Song Title,..."
}
```

### POST /api/royalties/ingest

Legacy endpoint for direct JSON payload (smaller files).

**Request:**
```json
{
  "artistId": "uuid-of-artist",
  "rows": [
    { "Song Title": "...", "Gross": "100.50", ... }
  ]
}
```

---

## Performance Optimization

### How Streaming + Batching Improves Speed

| Approach | Memory Usage | Throughput | Best For |
|----------|--------------|------------|----------|
| Load All → Insert All | O(n) | Low | < 10K rows |
| Stream → Single Insert | O(1) | Very Low | Debugging |
| Stream → Batch Insert | O(batch) | High | Any size |
| Stream → Parallel Batch | O(batch × concurrency) | Very High | Large files |

### Recommended Settings by File Size

| File Size | Batch Size | Concurrency | Expected Throughput |
|-----------|------------|-------------|---------------------|
| < 10K rows | 500 | 1 | 1,000-2,000/s |
| 10K - 100K | 500 | 3 | 2,000-4,000/s |
| 100K - 1M | 1000 | 5 | 3,000-5,000/s |
| > 1M | 1000 | 5 | 3,000-5,000/s |

### Database Indexing

Ensure proper indexes for optimal insert and query performance:

```sql
-- Essential indexes (already in migrations)
CREATE INDEX idx_royalties_track_id ON royalties(track_id);
CREATE INDEX idx_royalties_artist_id ON royalties(artist_id);
CREATE INDEX idx_tracks_artist_song ON tracks(artist_id, song_title);
```

---

## Error Handling

### Failed Rows CSV

When rows fail validation or insertion, a CSV is generated:

```csv
Row Index,Song Title,ISWC,Composer,...,Error,Timestamp
42,"Bad Song","","",..."Missing song title","2024-01-15T10:30:00Z"
```

Users can:
1. Download the failed rows CSV
2. Fix errors in the original data
3. Re-upload only the corrected rows

### Error Types

| Error Type | Handling |
|------------|----------|
| Validation Error | Row skipped, added to failed rows |
| Batch Insert Failure | Retry with exponential backoff |
| All Retries Exhausted | Batch marked failed, continue processing |
| Storage Download Error | Request fails immediately |
| Auth Error | 401 response |

---

## Security

### Protected by Admin Role

```typescript
async function verifyAdminAccess(): Promise<{ isAdmin: boolean }> {
  const { data: { user } } = await supabase.auth.getUser();
  
  // Check metadata or user_profiles table
  const isAdmin = user?.user_metadata?.role === 'admin';
  return { isAdmin };
}
```

### Service Role Key

- **Never expose** to client-side code
- Only used in server-side API routes
- Bypasses RLS for bulk operations

---

## Setup Instructions

### 1. Install Dependencies

```bash
npm install big.js
npm install -D @types/big.js
```

(PapaParse is already installed)

### 2. Create Storage Bucket

In Supabase Dashboard:
1. Go to Storage
2. Create bucket: `royalty-uploads`
3. Set to private (non-public)

Or via SQL:
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('royalty-uploads', 'royalty-uploads', false);
```

### 3. Configure Environment

Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in your `.env.local` file.

### 4. Test Upload

1. Navigate to `/royalty-uploader`
2. Select an artist
3. Configure batch settings (optional)
4. Upload a CSV file
5. Monitor progress and results

---

## Troubleshooting

### "Storage upload failed"

- Check bucket exists and RLS policies allow uploads
- Verify file is under 100MB
- Ensure user is authenticated

### "Processing timeout"

For very large files (> 1M rows), consider:
- Splitting into smaller files
- Reducing concurrency to avoid rate limits
- Increasing server timeout (Next.js config)

### "Precision errors"

Ensure numeric columns in CSV are properly formatted:
- ✅ `"1234.567890"`
- ✅ `"$1,234.56"`
- ❌ `"1.234567e+10"` (scientific notation)

---

## Future Enhancements

- [ ] Async job processing with Redis queue
- [ ] Real-time progress via WebSocket/SSE
- [ ] Duplicate detection before insert
- [ ] Column mapping UI for non-standard CSVs
- [ ] Scheduled/recurring imports
