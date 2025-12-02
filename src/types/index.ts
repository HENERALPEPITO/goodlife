/**
 * Type definitions for Goodlife application
 */

// Re-export all royalty processing types
export * from './royalty-processing';

// Core user types
export interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'artist' | 'user';
  name?: string;
  created_at?: string;
  updated_at?: string;
}

// Artist types
export interface Artist {
  id: string;
  user_id?: string;
  name: string;
  email?: string;
  created_at?: string;
}

// Track types
export interface Track {
  id: string;
  artist_id: string;
  song_title: string;
  artist_name?: string;
  composer_name?: string;
  isrc?: string;
  title?: string;
  split?: string;
  created_at?: string;
}

// Royalty types
export interface Royalty {
  id: string;
  track_id: string;
  artist_id: string;
  usage_count: number;
  gross_amount: number;
  admin_percent: number;
  net_amount: number;
  broadcast_date?: string;
  exploitation_source_name?: string;
  territory?: string;
  created_at?: string;
}
