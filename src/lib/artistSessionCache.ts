/**
 * Artist Session Cache
 * 
 * Optimizes artist portal performance by caching session data in localStorage.
 * Eliminates redundant API calls on page navigation and refreshes.
 * 
 * Key optimizations:
 * 1. Cache artist profile and stats on login
 * 2. Serve cached data immediately, refresh in background
 * 3. TTL-based cache invalidation (5 minutes)
 */

const CACHE_KEY = 'artist_session_data';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const DASHBOARD_CACHE_KEY = 'artist_dashboard_data';
const DASHBOARD_CACHE_TTL = 2 * 60 * 1000; // 2 minutes for dashboard data

export interface ArtistSessionData {
  artist_id: string;
  artist_name: string | null;
  artist_email: string | null;
  found: boolean;
  stats: {
    total_tracks: number;
    total_revenue: number;
    total_streams: number;
    unpaid_amount: number;
  };
}

export interface ArtistDashboardData {
  found: boolean;
  artist_id: string;
  stats: {
    total_tracks: number;
    total_revenue: number;
    total_streams: number;
  };
  top_tracks: Array<{
    track_id: string | null;
    title: string;
    platform: string;
    streams: number;
    revenue: number;
  }>;
  recent_activity: Array<{
    id: string;
    type: string;
    track_title: string;
    streams: number;
    platform: string;
    date: string;
  }>;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Check if localStorage is available
 */
function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const test = '__storage_test__';
    window.localStorage.setItem(test, test);
    window.localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get cached artist session data
 * Returns null if cache is expired or doesn't exist
 */
export function getCachedSessionData(): ArtistSessionData | null {
  if (!isStorageAvailable()) return null;
  
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const entry: CacheEntry<ArtistSessionData> = JSON.parse(cached);
    const isExpired = Date.now() - entry.timestamp > CACHE_TTL;
    
    if (isExpired) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    
    return entry.data;
  } catch (error) {
    console.error('[artistSessionCache] Error reading cache:', error);
    return null;
  }
}

/**
 * Set artist session data in cache
 */
export function setCachedSessionData(data: ArtistSessionData): void {
  if (!isStorageAvailable()) return;
  
  try {
    const entry: CacheEntry<ArtistSessionData> = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch (error) {
    console.error('[artistSessionCache] Error writing cache:', error);
  }
}

/**
 * Get cached dashboard data
 */
export function getCachedDashboardData(): ArtistDashboardData | null {
  if (!isStorageAvailable()) return null;
  
  try {
    const cached = localStorage.getItem(DASHBOARD_CACHE_KEY);
    if (!cached) return null;
    
    const entry: CacheEntry<ArtistDashboardData> = JSON.parse(cached);
    const isExpired = Date.now() - entry.timestamp > DASHBOARD_CACHE_TTL;
    
    if (isExpired) {
      localStorage.removeItem(DASHBOARD_CACHE_KEY);
      return null;
    }
    
    return entry.data;
  } catch (error) {
    console.error('[artistSessionCache] Error reading dashboard cache:', error);
    return null;
  }
}

/**
 * Set dashboard data in cache
 */
export function setCachedDashboardData(data: ArtistDashboardData): void {
  if (!isStorageAvailable()) return;
  
  try {
    const entry: CacheEntry<ArtistDashboardData> = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(entry));
  } catch (error) {
    console.error('[artistSessionCache] Error writing dashboard cache:', error);
  }
}

/**
 * Clear all artist cache (call on logout)
 */
export function clearArtistCache(): void {
  if (!isStorageAvailable()) return;
  
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(DASHBOARD_CACHE_KEY);
  } catch (error) {
    console.error('[artistSessionCache] Error clearing cache:', error);
  }
}

/**
 * Check if cache is fresh (not expired)
 */
export function isCacheFresh(key: 'session' | 'dashboard' = 'session'): boolean {
  if (!isStorageAvailable()) return false;
  
  try {
    const cacheKey = key === 'session' ? CACHE_KEY : DASHBOARD_CACHE_KEY;
    const ttl = key === 'session' ? CACHE_TTL : DASHBOARD_CACHE_TTL;
    
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return false;
    
    const entry = JSON.parse(cached);
    return Date.now() - entry.timestamp < ttl;
  } catch {
    return false;
  }
}

/**
 * Performance timing helper
 */
export function createPerfTimer(label: string) {
  const start = performance.now();
  return {
    end: () => {
      const duration = performance.now() - start;
      console.log(`[perf] ${label}: ${duration.toFixed(2)}ms`);
      return duration;
    },
  };
}
