/**
 * Query Performance Cache
 * Reduces database calls for static/semi-static data
 * Expected improvement: 95%+ reduction in calls for cached queries
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// TIMEZONE NAMES CACHE
// Eliminates: 102 calls * 208ms = 21.23s
// ============================================================

let timezoneCache: string[] | null = null;
let timezoneCacheExpiry = 0;
const TIMEZONE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours (never changes)

export async function getTimezoneNames(supabase: SupabaseClient): Promise<string[]> {
  const now = Date.now();
  
  // Return cached if valid
  if (timezoneCache && now < timezoneCacheExpiry) {
    return timezoneCache;
  }
  
  // Try cached table first (fast)
  const { data, error } = await supabase
    .from('cached_timezone_names')
    .select('name')
    .order('name');
  
  if (!error && data && data.length > 0) {
    timezoneCache = data.map(row => row.name);
    timezoneCacheExpiry = now + TIMEZONE_CACHE_TTL;
    return timezoneCache;
  }
  
  // Fallback to pg_timezone_names if cache table doesn't exist
  const { data: fallbackData } = await supabase
    .rpc('get_timezone_names');
  
  if (fallbackData && Array.isArray(fallbackData)) {
    timezoneCache = fallbackData as string[];
    timezoneCacheExpiry = now + TIMEZONE_CACHE_TTL;
    return timezoneCache;
  }
  
  return [];
}

// ============================================================
// PG_CONFIG CACHE
// Eliminates: 5,216 calls * 0.25ms = 1.30s
// ============================================================

const pgConfigCache = new Map<string, string>();
let pgConfigLoaded = false;

export async function getPgConfig(
  supabase: SupabaseClient, 
  name: string
): Promise<string | null> {
  // Check in-memory cache first
  if (pgConfigCache.has(name)) {
    return pgConfigCache.get(name) || null;
  }
  
  // Load all configs at once if not loaded
  if (!pgConfigLoaded) {
    await preloadPgConfigs(supabase);
  }
  
  return pgConfigCache.get(name) || null;
}

export async function preloadPgConfigs(supabase: SupabaseClient): Promise<void> {
  if (pgConfigLoaded) return;
  
  const { data, error } = await supabase
    .from('cached_pg_config')
    .select('name, setting');
  
  if (!error && data) {
    data.forEach(row => {
      pgConfigCache.set(row.name, row.setting);
    });
    pgConfigLoaded = true;
  }
}

// ============================================================
// EXTENSIONS CACHE
// Eliminates: 47 calls * 54ms = 2.56s
// ============================================================

interface Extension {
  name: string;
  schema: string | null;
  default_version: string;
  installed_version: string | null;
  comment: string;
}

let extensionsCache: Extension[] | null = null;
let extensionsCacheExpiry = 0;
const EXTENSIONS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function getExtensions(supabase: SupabaseClient): Promise<Extension[]> {
  const now = Date.now();
  
  if (extensionsCache && now < extensionsCacheExpiry) {
    return extensionsCache;
  }
  
  const { data, error } = await supabase
    .from('cached_extensions')
    .select('name, schema, default_version, installed_version, comment');
  
  if (!error && data) {
    extensionsCache = data;
    extensionsCacheExpiry = now + EXTENSIONS_CACHE_TTL;
    return extensionsCache;
  }
  
  return [];
}

// ============================================================
// FUNCTIONS METADATA CACHE
// Reduces: 147 calls * 219ms = 32.26s → on-demand only
// ============================================================

interface FunctionInfo {
  id: number;
  schema: string;
  name: string;
  language: string;
  argument_types: string;
  return_type: string;
  behavior: string;
}

let functionsCache: FunctionInfo[] | null = null;
let functionsCacheExpiry = 0;
const FUNCTIONS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getFunctions(supabase: SupabaseClient): Promise<FunctionInfo[]> {
  const now = Date.now();
  
  if (functionsCache && now < functionsCacheExpiry) {
    return functionsCache;
  }
  
  const { data, error } = await supabase
    .from('cached_functions')
    .select('id, schema, name, language, argument_types, return_type, behavior');
  
  if (!error && data) {
    functionsCache = data;
    functionsCacheExpiry = now + FUNCTIONS_CACHE_TTL;
    return functionsCache;
  }
  
  return [];
}

// ============================================================
// TABLES METADATA CACHE
// ============================================================

interface TableInfo {
  id: number;
  schema: string;
  name: string;
  kind: string;
  rls_enabled: boolean;
  comment: string | null;
  bytes: number;
  size: string;
  live_rows_estimate: number;
}

let tablesCache: TableInfo[] | null = null;
let tablesCacheExpiry = 0;
const TABLES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getTables(supabase: SupabaseClient): Promise<TableInfo[]> {
  const now = Date.now();
  
  if (tablesCache && now < tablesCacheExpiry) {
    return tablesCache;
  }
  
  const { data, error } = await supabase
    .from('cached_tables')
    .select('*');
  
  if (!error && data) {
    tablesCache = data;
    tablesCacheExpiry = now + TABLES_CACHE_TTL;
    return tablesCache;
  }
  
  return [];
}

// ============================================================
// CACHE INVALIDATION
// ============================================================

export function invalidateTimezoneCache(): void {
  timezoneCache = null;
  timezoneCacheExpiry = 0;
}

export function invalidatePgConfigCache(): void {
  pgConfigCache.clear();
  pgConfigLoaded = false;
}

export function invalidateExtensionsCache(): void {
  extensionsCache = null;
  extensionsCacheExpiry = 0;
}

export function invalidateFunctionsCache(): void {
  functionsCache = null;
  functionsCacheExpiry = 0;
}

export function invalidateTablesCache(): void {
  tablesCache = null;
  tablesCacheExpiry = 0;
}

export function invalidateAllCaches(): void {
  invalidateTimezoneCache();
  invalidatePgConfigCache();
  invalidateExtensionsCache();
  invalidateFunctionsCache();
  invalidateTablesCache();
}

// ============================================================
// REFRESH DATABASE CACHES
// Call this after schema changes
// ============================================================

export async function refreshDatabaseCaches(supabase: SupabaseClient): Promise<void> {
  // Refresh materialized views
  try {
    await supabase.rpc('refresh_functions_cache');
  } catch {
    // Ignore if function doesn't exist
  }
  
  try {
    await supabase.rpc('refresh_tables_cache');
  } catch {
    // Ignore if function doesn't exist
  }
  
  // Invalidate in-memory caches
  invalidateAllCaches();
}
