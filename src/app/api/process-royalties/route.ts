/**
 * Process Royalties API Route
 * POST /api/process-royalties
 * 
 * High-performance royalty CSV processing endpoint that:
 * - Fetches CSV from Supabase Storage
 * - Streams and parses with PapaParse
 * - Uses Big.js for high-precision numerics
 * - Batch inserts with retry logic
 * - Returns detailed processing results
 * 
 * This endpoint is protected and only accessible by admin users.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { downloadCsvFromStorage, deleteCsvFromStorage } from '@/lib/royalty-storage';
import { processRoyaltyCsv, generateFailedRowsCsv } from '@/lib/royalty-processor';
import type { ProcessRoyaltiesRequest, BatchConfig, ProcessingResult } from '@/types/royalty-processing';
import { DEFAULT_BATCH_CONFIG } from '@/types/royalty-processing';

// Response type
interface ProcessRoyaltiesResponse {
  success: boolean;
  data?: ProcessingResult;
  failedRowsCsv?: string;
  error?: string;
}

/**
 * Verify the request is from an authenticated admin user
 */
async function verifyAdminAccess(): Promise<{ isAdmin: boolean; userId?: string; error?: string }> {
  try {
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return { isAdmin: false, error: 'Unauthorized: Not authenticated' };
    }

    // Check if user is admin via metadata or user_profiles
    const isAdminMeta = user.user_metadata?.role === 'admin';
    
    if (!isAdminMeta) {
      // Check user_profiles table
      const supabaseAdmin = getSupabaseAdmin();
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin') {
        return { isAdmin: false, error: 'Unauthorized: Admin access required' };
      }
    }

    return { isAdmin: true, userId: user.id };
  } catch (error: any) {
    return { isAdmin: false, error: error?.message || 'Authorization check failed' };
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<ProcessRoyaltiesResponse>> {
  const startTime = Date.now();

  try {
    // Verify admin access
    const authCheck = await verifyAdminAccess();
    if (!authCheck.isAdmin) {
      return NextResponse.json(
        { success: false, error: authCheck.error },
        { status: 401 }
      );
    }

    // Parse request body
    const body: ProcessRoyaltiesRequest = await request.json();
    const { artistId, storagePath, batchConfig: customConfig } = body;

    // Validate required fields
    if (!artistId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: artistId' },
        { status: 400 }
      );
    }

    if (!storagePath) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: storagePath' },
        { status: 400 }
      );
    }

    console.log(`📥 Processing royalty CSV for artist ${artistId} from ${storagePath}`);

    // Merge custom config with defaults
    const config: BatchConfig = {
      ...DEFAULT_BATCH_CONFIG,
      ...customConfig,
    };

    console.log(`⚙️ Batch config: size=${config.batchSize}, concurrency=${config.maxConcurrency}, retries=${config.retryAttempts}`);

    // Step 1: Download CSV from storage
    console.log('📂 Downloading CSV from storage...');
    const downloadResult = await downloadCsvFromStorage(storagePath);

    if (!downloadResult.success || !downloadResult.data) {
      return NextResponse.json(
        { success: false, error: `Failed to download CSV: ${downloadResult.error}` },
        { status: 500 }
      );
    }

    // Convert blob to string
    const csvContent = await downloadResult.data.text();
    console.log(`✅ Downloaded CSV (${(csvContent.length / 1024).toFixed(2)} KB)`);

    // Step 2: Process the CSV
    const result = await processRoyaltyCsv(csvContent, artistId, config);

    // Step 3: Generate failed rows CSV if there are failures
    let failedRowsCsv: string | undefined;
    if (result.failedRows.length > 0) {
      failedRowsCsv = generateFailedRowsCsv(result.failedRows);
      console.log(`⚠️ Generated failed rows CSV with ${result.failedRows.length} entries`);
    }

    // Step 4: Optionally cleanup the source file
    // Uncomment to auto-delete after processing:
    // await deleteCsvFromStorage(storagePath);

    const totalTime = Date.now() - startTime;
    console.log(`🎉 Request completed in ${(totalTime / 1000).toFixed(2)}s`);

    // Extract error message if processing failed
    const errorMessage = !result.success && result.errors.length > 0
      ? result.errors.join('; ')
      : undefined;

    return NextResponse.json(
      {
        success: result.success,
        data: result,
        failedRowsCsv,
        error: errorMessage,
      },
      { status: result.success ? 200 : 500 }
    );

  } catch (error: any) {
    console.error('❌ Process royalties error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for checking processing status
 * (For future implementation of async job tracking)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json(
      { error: 'Missing jobId parameter' },
      { status: 400 }
    );
  }

  // For future: implement job status tracking with Redis or database
  // Currently returns a placeholder response
  return NextResponse.json({
    message: 'Job status tracking not yet implemented. Processing is synchronous.',
    jobId,
  });
}
