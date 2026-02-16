/**
 * React Hooks for Royalties Summary Data
 * 
 * These hooks provide easy access to precomputed royalty data
 * from the royalties_summary table for use in dashboard components.
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  QuarterSummary,
  ArtistDashboardOverview,
  QuarterlyTrend,
  TopTrack,
  AdminRoyaltiesTotals,
  ArtistRoyaltiesSummaryResponse,
} from '@/types/royalty-summary';

// ============================================================================
// Base Fetcher
// ============================================================================

async function fetchSummaryData<T>(
  action: string,
  params?: Record<string, string | number | null | undefined>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const searchParams = new URLSearchParams();
    searchParams.set('action', action);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          searchParams.set(key, String(value));
        }
      });
    }

    const response = await fetch(`/api/data/royalties-summary?${searchParams.toString()}`, {
      cache: 'no-store',
    });

    const json = await response.json();

    if (!response.ok || json.error) {
      return { data: null, error: json.error || 'Request failed' };
    }

    return { data: json.data, error: null };
  } catch (error: any) {
    return { data: null, error: error?.message || 'Unknown error' };
  }
}

// ============================================================================
// Artist Quarters Hook
// ============================================================================

export function useArtistQuarters(artistId?: string) {
  const [quarters, setQuarters] = useState<QuarterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuarters = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await fetchSummaryData<QuarterSummary[]>('quarters', {
      artist_id: artistId,
    });

    if (result.error) {
      setError(result.error);
      setQuarters([]);
    } else {
      setQuarters(result.data || []);
    }

    setLoading(false);
  }, [artistId]);

  useEffect(() => {
    fetchQuarters();
  }, [fetchQuarters]);

  return { quarters, loading, error, refetch: fetchQuarters };
}

// ============================================================================
// Quarter Summary Hook
// ============================================================================

export function useQuarterSummary(
  artistId: string | undefined,
  year: number | undefined,
  quarter: number | undefined
) {
  const [summary, setSummary] = useState<ArtistRoyaltiesSummaryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!year || !quarter) {
      setSummary([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const result = await fetchSummaryData<ArtistRoyaltiesSummaryResponse[]>('summary', {
      artist_id: artistId,
      year,
      quarter,
    });

    if (result.error) {
      setError(result.error);
      setSummary([]);
    } else {
      setSummary(result.data || []);
    }

    setLoading(false);
  }, [artistId, year, quarter]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Compute derived analytics
  const analytics = computeAnalytics(summary);

  return { summary, analytics, loading, error, refetch: fetchSummary };
}

// ============================================================================
// Artist Overview Hook
// ============================================================================

export function useArtistOverview(artistId?: string) {
  const [overview, setOverview] = useState<ArtistDashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await fetchSummaryData<ArtistDashboardOverview>('overview', {
      artist_id: artistId,
    });

    if (result.error) {
      setError(result.error);
      setOverview(null);
    } else {
      setOverview(result.data);
    }

    setLoading(false);
  }, [artistId]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  return { overview, loading, error, refetch: fetchOverview };
}

// ============================================================================
// Quarterly Trends Hook
// ============================================================================

export function useQuarterlyTrends(artistId?: string, limit: number = 8) {
  const [trends, setTrends] = useState<QuarterlyTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await fetchSummaryData<QuarterlyTrend[]>('trends', {
      artist_id: artistId,
      limit,
    });

    if (result.error) {
      setError(result.error);
      setTrends([]);
    } else {
      // Reverse to show oldest first for chart display
      setTrends((result.data || []).reverse());
    }

    setLoading(false);
  }, [artistId, limit]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  return { trends, loading, error, refetch: fetchTrends };
}

// ============================================================================
// Top Tracks Hook
// ============================================================================

export function useTopTracks(
  artistId?: string,
  options?: {
    year?: number;
    quarter?: number;
    limit?: number;
  }
) {
  const [tracks, setTracks] = useState<TopTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTracks = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await fetchSummaryData<TopTrack[]>('top-tracks', {
      artist_id: artistId,
      year: options?.year,
      quarter: options?.quarter,
      limit: options?.limit || 10,
    });

    if (result.error) {
      setError(result.error);
      setTracks([]);
    } else {
      setTracks(result.data || []);
    }

    setLoading(false);
  }, [artistId, options?.year, options?.quarter, options?.limit]);

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  return { tracks, loading, error, refetch: fetchTracks };
}

// ============================================================================
// Admin Totals Hook
// ============================================================================

export function useAdminTotals() {
  const [totals, setTotals] = useState<AdminRoyaltiesTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTotals = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await fetchSummaryData<AdminRoyaltiesTotals>('admin-totals');

    if (result.error) {
      setError(result.error);
      setTotals(null);
    } else {
      setTotals(result.data);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTotals();
  }, [fetchTotals]);

  return { totals, loading, error, refetch: fetchTotals };
}

// ============================================================================
// Analytics Computation
// ============================================================================

interface ComputedAnalytics {
  topTracks: { title: string; revenue: number }[];
  revenueBySource: { source: string; revenue: number; percentage: number }[];
  revenueByTerritory: { territory: string; revenue: number }[];
  monthlyRevenue: { quarter: string; revenue: number }[];
  totalRevenue: number;
  totalStreams: number;
  avgPerStream: number;
}

function computeAnalytics(summaries: ArtistRoyaltiesSummaryResponse[]): ComputedAnalytics {
  if (!summaries || summaries.length === 0) {
    return {
      topTracks: [],
      revenueBySource: [],
      revenueByTerritory: [],
      monthlyRevenue: [],
      totalRevenue: 0,
      totalStreams: 0,
      avgPerStream: 0,
    };
  }

  // Top tracks by revenue
  const topTracks = summaries
    .filter(s => s.track_title !== 'Advance Payment') // Exclude advance payment
    .map(s => ({
      title: s.track_title,
      revenue: s.total_net,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Aggregate platform distribution
  const platformTotals = new Map<string, number>();
  let totalRevenue = 0;
  let totalStreams = 0;

  summaries.forEach(s => {
    totalRevenue += s.total_net;
    totalStreams += s.total_streams;
    Object.entries(s.platform_distribution || {}).forEach(([platform, pct]) => {
      const current = platformTotals.get(platform) || 0;
      platformTotals.set(platform, current + (s.total_net * (pct as number)));
    });
  });

  const revenueBySource = Array.from(platformTotals.entries())
    .map(([source, revenue]) => ({
      source,
      revenue: parseFloat(revenue.toFixed(2)),
      percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // Aggregate territory distribution
  const territoryTotals = new Map<string, number>();

  summaries.forEach(s => {
    Object.entries(s.territory_distribution || {}).forEach(([territory, pct]) => {
      const current = territoryTotals.get(territory) || 0;
      territoryTotals.set(territory, current + (s.total_net * (pct as number)));
    });
  });

  const revenueByTerritory = Array.from(territoryTotals.entries())
    .map(([territory, revenue]) => ({
      territory,
      revenue: parseFloat(revenue.toFixed(2)),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // Quarter breakdown - aggregate all months for the quarter
  const quarterTotalRevenue = summaries.reduce((sum, s) => {
    const monthlyBreakdown = s.monthly_breakdown || {};
    const monthSum = Object.values(monthlyBreakdown).reduce((m, val) => m + (val as number), 0);
    return sum + monthSum;
  }, 0);

  const quarterRevenue = [{
    quarter: 'Total',
    revenue: parseFloat(quarterTotalRevenue.toFixed(2)),
  }];

  return {
    topTracks,
    revenueBySource,
    revenueByTerritory,
    monthlyRevenue: quarterRevenue,
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    totalStreams,
    avgPerStream: totalStreams > 0 ? parseFloat((totalRevenue / totalStreams).toFixed(6)) : 0,
  };
}
