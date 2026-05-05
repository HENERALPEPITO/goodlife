/**
 * Process Royalties Summary API Route
 * POST /api/process-royalties-summary
 * 
 * This endpoint processes CSV files and computes aggregated summaries
 * for the royalties_summary table. It does NOT insert raw rows into
 * any table - only precomputed metrics.
 * 
 * Features:
 * - Stores CSV metadata in csv_uploads table
 * - Parses CSV and aggregates by track/platform/territory
 * - Computes metrics: totals, averages, distributions
 * - Upserts into royalties_summary table
 * - Returns processing statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { downloadCsvFromStorage } from '@/lib/royalty-storage';
import { processRoyaltySummary, generateFailedRowsCsv } from '@/lib/royalty-summary-processor';
import type { ProcessSummaryResponse } from '@/types/royalty-summary';

// Request body type
interface ProcessSummaryRequest {
  artistId: string;
  storagePath: string;
  filename: string;
  fileSize: number;
  year: number;
  quarter: number;
  batchConfig?: {
    batchSize?: number;
    maxConcurrency?: number;
    retryAttempts?: number;
  };
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

export async function POST(request: NextRequest): Promise<NextResponse<ProcessSummaryResponse & { failedRowsCsv?: string }>> {
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
    const body: ProcessSummaryRequest = await request.json();
    const { artistId, storagePath, filename, fileSize, year, quarter } = body;

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

    if (!year || !quarter) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: year and quarter' },
        { status: 400 }
      );
    }

    if (quarter < 1 || quarter > 4) {
      return NextResponse.json(
        { success: false, error: 'Quarter must be between 1 and 4' },
        { status: 400 }
      );
    }

    console.log(`📥 Processing royalty summary for artist ${artistId}, Q${quarter} ${year}`);
    console.log(`   File: ${filename} (${storagePath})`);

    console.log('[Royalties Upload Guard] Upload flow write scope: royalties_summary only');

    // Step 2: Download CSV from storage
    console.log('📂 Downloading CSV from storage...');
    const downloadResult = await downloadCsvFromStorage(storagePath);

    if (!downloadResult.success || !downloadResult.data) {
      const errorMsg = `Failed to download CSV: ${downloadResult.error}`;
      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: 500 }
      );
    }

    // Convert blob to string
    const csvContent = await downloadResult.data.text();
    console.log(`✅ Downloaded CSV (${(csvContent.length / 1024).toFixed(2)} KB)`);

    // Step 3: Process CSV and compute summaries
    const result = await processRoyaltySummary({
      artistId,
      year,
      quarter,
      csvContent,
      uploadId: undefined,
    });

    // Step 5: Generate failed rows CSV if there are failures
    let failedRowsCsv: string | undefined;
    if (result.failedRows && result.failedRows.length > 0) {
      failedRowsCsv = generateFailedRowsCsv(result.failedRows);
      console.log(`⚠️ Generated failed rows CSV with ${result.failedRows.length} entries`);
    }

    const totalTime = Date.now() - startTime;
    console.log(`🎉 Request completed in ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`   Summaries created: ${result.summariesCreated}`);
    console.log(`   Summaries updated: ${result.summariesUpdated}`);
    console.log(`   Total rows processed: ${result.totalRows}`);

    return NextResponse.json(
      {
        success: result.success,
        upload_id: undefined,
        computation: {
          success: result.success,
          summariesCreated: result.summariesCreated,
          summariesUpdated: result.summariesUpdated,
          totalRows: result.totalRows,
          errors: result.errors,
          duration_ms: result.duration_ms,
        },
      },
      { status: result.success ? 200 : 500 }
    );

  } catch (error: any) {
    console.error('❌ Process royalties summary error:', error);

    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for checking upload history
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify admin access
    const authCheck = await verifyAdminAccess();
    if (!authCheck.isAdmin) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const artistId = searchParams.get('artistId');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const supabaseAdmin = getSupabaseAdmin();
    
    let query = supabaseAdmin
      .from('csv_uploads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (artistId) {
      query = query.eq('artist_id', artistId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ uploads: data });

  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
