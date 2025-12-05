"use client";
/**
 * Optimized Artist Dashboard
 * 
 * Performance improvements:
 * 1. Uses TanStack Query for caching (stale-while-revalidate)
 * 2. Uses optimized RPC get_artist_dashboard_data() - single DB call
 * 3. Uses localStorage cache for instant initial render
 * 4. Memoized computed values
 * 5. No large array computations in React
 * 
 * Expected improvement: 3-5s → <500ms
 */

import { useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useArtistDashboard, TopTrack, RecentActivity } from "@/hooks/useArtistDashboard";
import { DollarSign, Music, TrendingUp, FileText, ArrowUp, ArrowDown, Play, Upload, Clock } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

export default function ArtistDashboardOptimized() {
  const { user } = useAuth();
  const { data, isLoading, isError } = useArtistDashboard();

  // Memoize KPIs to prevent re-computation
  const kpis = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: "Total Revenue",
        value: `€${data.stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        sub: "Total Earnings",
        icon: DollarSign,
        color: "#4ADE80",
      },
      {
        label: "Total Streams",
        value: data.stats.totalStreams.toLocaleString(),
        sub: "All platforms",
        icon: TrendingUp,
        color: "#A78BFA",
      },
      {
        label: "Active Tracks",
        value: data.stats.totalTracks.toString(),
        sub: "In catalog",
        icon: Music,
        color: "#FB923C",
      },
    ];
  }, [data]);

  // Memoize sorted tracks (already sorted by RPC, but keep for sort toggle)
  const sortedTracks = useMemo(() => {
    return data?.topTracks || [];
  }, [data?.topTracks]);

  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'stream': return <Play className="h-4 w-4" style={{ color: '#10B981' }} />;
      case 'royalty': return <DollarSign className="h-4 w-4" style={{ color: '#3B82F6' }} />;
      case 'payout': return <TrendingUp className="h-4 w-4" style={{ color: '#8B5CF6' }} />;
      case 'upload': return <Upload className="h-4 w-4" style={{ color: '#F59E0B' }} />;
      default: return <Clock className="h-4 w-4" style={{ color: '#6B7280' }} />;
    }
  };

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="transition-colors" style={{ color: 'var(--text-secondary)' }}>
          Loading your dashboard...
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Failed to load dashboard. Please refresh.</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-1">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold transition-colors" style={{ color: 'var(--text-primary)' }}>
          Artist Dashboard
        </h1>
        <p className="text-sm mt-2 transition-colors" style={{ color: 'var(--text-secondary)' }}>
          Welcome back, {user?.email}! Here's your performance overview.
        </p>
      </div>

      {/* Metric Cards - 3 Column Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-default border border-gray-100"
            >
              <div className="flex items-start justify-between mb-4">
                <div 
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: `${kpi.color}20` }}
                >
                  <Icon className="h-6 w-6" style={{ color: kpi.color }} />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">{kpi.label}</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {kpi.value}
                </p>
                <p className="text-xs text-gray-500">{kpi.sub}</p>
              </div>
            </div>
          );
        })}
      </section>

      {/* Top Tracks Section */}
      <section className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              Top Tracks
            </h2>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Track
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Platform
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Streams
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {sortedTracks.length > 0 ? (
                sortedTracks.map((track: TopTrack, index: number) => (
                  <tr 
                    key={track.id}
                    className="hover:bg-gray-50 transition-colors"
                    style={{ backgroundColor: index % 2 === 0 ? 'white' : '#FAFAFA' }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mr-3">
                          <Music className="h-5 w-5 text-white" />
                        </div>
                        <div className="text-sm font-medium text-gray-900">{track.title}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{track.platform}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {track.streams.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        €{track.revenue.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {track.trend > 0 ? (
                          <>
                            <ArrowUp className="h-4 w-4 text-green-500 mr-1" />
                            <span className="text-sm font-medium text-green-600">
                              {track.trend.toFixed(1)}%
                            </span>
                          </>
                        ) : (
                          <>
                            <ArrowDown className="h-4 w-4 text-red-500 mr-1" />
                            <span className="text-sm font-medium text-red-600">
                              {Math.abs(track.trend).toFixed(1)}%
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No track data available yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Two Column Layout: Quick Actions + Recent Activity */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Quick Actions
          </h3>
          <Link
            href="/analytics"
            className="block bg-white rounded-xl p-6 shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border border-gray-100"
          >
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-blue-50 mr-4">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Analytics</h4>
                <p className="text-sm text-gray-600">View detailed performance metrics</p>
              </div>
            </div>
          </Link>

          <Link
            href="/royalties"
            className="block bg-white rounded-xl p-6 shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border border-gray-100"
          >
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-green-50 mr-4">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Royalties</h4>
                <p className="text-sm text-gray-600">View your royalty statements</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Recent Activity
            </h3>
          </div>
          <div className="p-6">
            {data?.recentActivity && data.recentActivity.length > 0 ? (
              <div className="space-y-4">
                {data.recentActivity.map((activity: RecentActivity) => (
                  <div
                    key={activity.id}
                    className="flex items-start pb-4 border-b border-gray-100 last:border-b-0 last:pb-0"
                  >
                    <div className="p-2 rounded-lg bg-gray-50 mr-3">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{activity.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {format(new Date(activity.date), 'MMM dd, yyyy • h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No recent activity
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
