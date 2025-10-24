import { NextResponse } from "next/server";
import { RoyaltyStatement } from "@/types";
import { supabase } from "@/lib/supabaseClient";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    
    // Build the query
    let query = supabase
      .from('royalty_statements')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply status filter if provided
    if (status && (status === "paid" || status === "pending")) {
      query = query.eq('status', status);
    }

    const { data: royalties, error } = await query;

    if (error) {
      console.error('Error fetching royalty statements for export:', error);
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

    const header = ["Track","Platform","Period","Streams","RevenueUSD","Status"]; 
    const rows = transformedRoyalties.map((r) => [r.trackTitle, r.platform, r.period, String(r.streams), String(r.revenueUsd), r.status]);
    const csv = [header, ...rows].map((r) => r.map(escapeCsv).join(",")).join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=royalties_export.csv`,
      },
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function escapeCsv(value: string) {
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return '"' + value.replaceAll('"', '""') + '"';
  }
  return value;
}


