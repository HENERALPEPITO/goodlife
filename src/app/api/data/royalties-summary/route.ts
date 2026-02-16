import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'quarters';

  // Get user from session
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  // Get artist ID for non-admin users
  let targetArtistId: string | null = null;

  const { data: userData } = await supabaseAdmin
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userData?.role === 'artist') {
    const { data: artistData } = await supabaseAdmin
      .from('artists')
      .select('id')
      .eq('user_id', user.id)
      .single();

    targetArtistId = artistData?.id || null;
  } else if (userData?.role === 'admin') {
    // If admin, check if artist_id is provided in params
    const paramArtistId = searchParams.get('artist_id');
    if (paramArtistId) {
      targetArtistId = paramArtistId;
    }
  }

  // Handle different actions
  switch (action) {
    case 'quarters': {
      if (!targetArtistId) {
        return NextResponse.json({ data: [] });
      }

      const { data: quartersData, error } = await supabaseAdmin.rpc('get_artist_available_quarters', {
        _artist_id: targetArtistId,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Get CSV uploads for storage paths
      const { data: csvUploads } = await supabaseAdmin
        .from('csv_uploads')
        .select('id, year, quarter, storage_path, filename')
        .eq('artist_id', targetArtistId)
        .eq('processing_status', 'completed');

      const quartersWithPaths = (quartersData || []).map((q: any) => {
        // Find ALL matching CSVs for this quarter
        const matchingUploads = (csvUploads || []).filter(
          (c: any) => c.year === q.year && c.quarter === q.quarter
        );

        return {
          ...q,
          label: `${q.year} Quarter ${q.quarter}`,
          // Support multiple files
          file_paths: matchingUploads.map((u: any) => ({
            path: u.storage_path,
            filename: u.filename || 'download.csv',
            id: u.id
          })),
          // Keep backward compatibility for now (use first file)
          storage_path: matchingUploads[0]?.storage_path || null,
          csv_upload_id: matchingUploads[0]?.id || null,
        };
      });

      return NextResponse.json({ data: quartersWithPaths });
    }

    case 'summary': {
      const year = searchParams.get('year');
      const quarter = searchParams.get('quarter');

      if (!targetArtistId) {
        return NextResponse.json({ data: [] });
      }

      let query = supabaseAdmin
        .from('royalties_summary')
        .select(`
          *,
          tracks:track_id (title)
        `)
        .eq('artist_id', targetArtistId);

      if (year) query = query.eq('year', parseInt(year));
      if (quarter) query = query.eq('quarter', parseInt(quarter));

      // Exclude advance payments
      query = query.neq('top_platform', 'Advance Payment');

      const { data, error } = await query;

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Add track title to response
      const enrichedData = (data || []).map((item: any) => ({
        ...item,
        track_title: item.tracks?.title || 'Unknown',
      }));

      return NextResponse.json({ data: enrichedData });
    }

    case 'download': {
      const storagePath = searchParams.get('path');

      if (!storagePath) {
        return NextResponse.json({ error: 'Storage path is required' }, { status: 400 });
      }

      const { data: signedUrl, error: signedError } = await supabaseAdmin
        .storage
        .from('royalty-uploads')
        .createSignedUrl(storagePath, 300);

      if (signedError) {
        console.error('[Download] Storage error:', signedError.message, 'Path:', storagePath);
        return NextResponse.json({ error: `File not found: ${signedError.message}` }, { status: 500 });
      }

      return NextResponse.json({ url: signedUrl?.signedUrl });
    }

    case 'overview': {
      if (!targetArtistId) {
        return NextResponse.json({ data: null });
      }

      const { data, error } = await supabaseAdmin.rpc('get_artist_dashboard_overview', {
        _artist_id: targetArtistId,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ data: data?.[0] || null });
    }

    case 'top-tracks': {
      const year = searchParams.get('year');
      const quarter = searchParams.get('quarter');

      if (!targetArtistId || !year || !quarter) {
        return NextResponse.json({ data: [] });
      }

      const { data, error } = await supabaseAdmin.rpc('get_artist_top_tracks', {
        _artist_id: targetArtistId,
        _year: parseInt(year),
        _quarter: parseInt(quarter),
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ data: data || [] });
    }

    case 'trends': {
      if (!targetArtistId) {
        return NextResponse.json({ data: [] });
      }

      const { data, error } = await supabaseAdmin.rpc('get_artist_quarterly_trends', {
        _artist_id: targetArtistId,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ data: data || [] });
    }

    case 'admin-totals': {
      if (userData?.role !== 'admin') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }

      const { data, error } = await supabaseAdmin.rpc('get_admin_royalties_totals');

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ data: data?.[0] || null });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
