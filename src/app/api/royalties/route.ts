import { NextResponse } from "next/server";
import { RoyaltyStatement } from "@/types";
import { supabase } from "@/lib/supabaseClient";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") || 1);
    const pageSize = Number(searchParams.get("pageSize") || 10);
    const status = searchParams.get("status");
    
    // Build the query
    let query = supabase
      .from('royalty_statements')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply status filter if provided
    if (status && (status === "paid" || status === "pending")) {
      query = query.eq('status', status);
    }

    // Apply pagination
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;
    query = query.range(start, end);

    const { data: royalties, error, count } = await query;

    if (error) {
      console.error('Error fetching royalty statements:', error);
      return NextResponse.json({ error: 'Failed to fetch royalty statements' }, { status: 500 });
    }

    // Transform the data to match the expected format
    const transformedRoyalties: RoyaltyStatement[] = royalties.map(royalty => ({
      id: royalty.id,
      trackId: royalty.track_id,
      trackTitle: royalty.track_title,
      platform: royalty.platform,
      period: royalty.period,
      streams: royalty.streams,
      revenueUsd: royalty.revenue_usd,
      status: royalty.status,
    }));

    return NextResponse.json({
      data: transformedRoyalties,
      total: count || 0,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


