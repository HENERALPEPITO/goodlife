-- Catalog Management Schema
-- Run this SQL in Supabase SQL Editor

-- Enable UUID generation
create extension if not exists pgcrypto;

-- Drop existing policies if they exist (for idempotency)
drop policy if exists "artists_select_admin_or_own" on artists;
drop policy if exists "artists_insert_admin_or_own" on artists;
drop policy if exists "artists_update_admin_or_own" on artists;
drop policy if exists "artists_delete_admin" on artists;
drop policy if exists "tracks_select_admin_or_artist" on tracks;
drop policy if exists "tracks_admin_all" on tracks;
drop policy if exists "Artist can view own tracks" on tracks;
drop policy if exists "Admin can manage all tracks" on tracks;

-- Artists table
create table if not exists artists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

-- Tracks table
create table if not exists tracks (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  song_title text not null,
  composer_name text not null,
  isrc text not null,
  artist_name text not null,
  split text not null,
  uploaded_by uuid not null references user_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_tracks_artist on tracks(artist_id);
create index if not exists idx_tracks_isrc on tracks(isrc);

-- Enable RLS
alter table artists enable row level security;
alter table tracks enable row level security;

-- RLS Policies for Artists
-- Select: Admins can view all, artists can view their own
create policy "artists_select_admin_or_own" on artists
  for select using (
    exists (select 1 from user_profiles p where p.id = auth.uid() and p.role = 'admin')
    or user_id = auth.uid()
  );

-- Insert: Admins can insert any, artists can insert their own record
create policy "artists_insert_admin_or_own" on artists
  for insert with check (
    exists (select 1 from user_profiles p where p.id = auth.uid() and p.role = 'admin')
    or user_id = auth.uid()
  );

-- Update: Admins can update any, artists can update their own record
create policy "artists_update_admin_or_own" on artists
  for update using (
    exists (select 1 from user_profiles p where p.id = auth.uid() and p.role = 'admin')
    or user_id = auth.uid()
  ) with check (
    exists (select 1 from user_profiles p where p.id = auth.uid() and p.role = 'admin')
    or user_id = auth.uid()
  );

-- Delete: Only admins can delete artist records
create policy "artists_delete_admin" on artists
  for delete using (
    exists (select 1 from user_profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- RLS Policies for Tracks
-- Artists can view only their own tracks
create policy "Artist can view own tracks" on tracks
  for select using (
    artist_id in (
      select id from artists where user_id = auth.uid()
    )
  );

-- Admin can view and manage all tracks
create policy "Admin can manage all tracks" on tracks
  for all using (
    exists (
      select 1 from user_profiles where id = auth.uid() and role = 'admin'
    )
  ) with check (
    exists (
      select 1 from user_profiles where id = auth.uid() and role = 'admin'
    )
  );
