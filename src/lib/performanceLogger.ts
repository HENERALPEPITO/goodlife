/**
 * Performance Logger Utility
 * Tracks timing for client-side, API routes, and Supabase queries
 */

// Server-side performance logging for API routes
export function logRouteStart(routeName: string): { start: number; requestId: string } {
  const start = performance.now();
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[PERF] ${routeName} REQUEST_START`, {
    requestId,
    timestamp: new Date().toISOString(),
  });
  return { start, requestId };
}

export function logRouteEnd(routeName: string, start: number, requestId: string): void {
  const end = performance.now();
  const duration = end - start;
  console.log(`[PERF] ${routeName} REQUEST_END`, {
    requestId,
    timestamp: new Date().toISOString(),
    ROUTE_HANDLER_TIME: `${duration.toFixed(2)}ms`,
  });
}

export function logSupabaseQuery(
  tableName: string,
  operation: string,
  startTime: number,
  requestId?: string
): void {
  const endTime = performance.now();
  const duration = endTime - startTime;
  console.log(`[PERF] SUPABASE_QUERY`, {
    requestId,
    table: tableName,
    operation,
    QUERY_TIME: `${duration.toFixed(2)}ms`,
  });
}

// Client-side performance logging
export function createClientTimer(pageName: string) {
  const timers: Record<string, number> = {};
  const results: Record<string, number> = {};

  return {
    startPageLoad: () => {
      timers.pageLoad = performance.now();
      console.log(`[PERF] ${pageName} PAGE_LOAD_START`, new Date().toISOString());
    },
    
    endPageLoad: () => {
      if (timers.pageLoad) {
        const duration = performance.now() - timers.pageLoad;
        results.pageLoad = duration;
        console.log(`[PERF] ${pageName} PAGE_LOAD_END`, {
          PAGE_LOAD_TIME: `${duration.toFixed(2)}ms`,
        });
      }
    },
    
    startApiRequest: (endpoint: string) => {
      timers[endpoint] = performance.now();
      console.log(`[PERF] ${pageName} API_REQUEST_START`, { endpoint });
    },
    
    endApiRequest: (endpoint: string) => {
      if (timers[endpoint]) {
        const duration = performance.now() - timers[endpoint];
        results[endpoint] = duration;
        console.log(`[PERF] ${pageName} API_REQUEST_END`, {
          endpoint,
          API_REQUEST_TIME: `${duration.toFixed(2)}ms`,
        });
      }
    },
    
    getResults: () => results,
    
    logSummary: () => {
      console.log(`[PERF] ${pageName} SUMMARY`, results);
    },
  };
}

// Wrapper for timed Supabase queries (server-side)
export async function timedQuery<T>(
  tableName: string,
  operation: string,
  queryFn: () => Promise<T>,
  requestId?: string
): Promise<T> {
  const start = performance.now();
  try {
    const result = await queryFn();
    logSupabaseQuery(tableName, operation, start, requestId);
    return result;
  } catch (error) {
    logSupabaseQuery(tableName, `${operation}_ERROR`, start, requestId);
    throw error;
  }
}
