import { NextResponse } from "next/server";
import { Track } from "@/types";
import { supabase } from "@/lib/supabaseClient";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ulvxfugjzgrjmcfvybjx.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsdnhmdWdqemdyam1jZnZ5Ymp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMTEwMDcsImV4cCI6MjA3Njc4NzAwN30.EHZGnCR7hMsncMdQ6LSW5WOg-z3GZFCxpjCvOsqSj8I";

const supabaseServer = createClient(supabaseUrl, supabaseAnonKey);

export async function GET() {
  try {
    const { data: tracks, error } = await supabase
      .from('tracks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tracks:', error);
      return NextResponse.json({ error: 'Failed to fetch tracks' }, { status: 500 });
    }

    // Transform the data to match the expected format
    const transformedTracks: Track[] = tracks.map(track => ({
      id: track.id,
      title: track.title,
      isrc: track.isrc,
      composers: track.composers,
      releaseDate: track.release_date,
      platform: track.platform,
      territory: track.territory,
      createdAt: track.created_at,
    }));

    return NextResponse.json({ data: transformedTracks });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<Track>;
    
    const newTrackData = {
      id: `t${Date.now()}`,
      title: body.title || "Untitled",
      isrc: body.isrc || "",
      composers: body.composers || "",
      release_date: body.releaseDate || new Date().toISOString().slice(0, 10),
      platform: body.platform || "Spotify",
      territory: body.territory || "Global",
    };

    const { data: insertedTrack, error } = await supabase
      .from('tracks')
      .insert(newTrackData)
      .select()
      .single();

    if (error) {
      console.error('Error creating track:', error);
      return NextResponse.json({ error: 'Failed to create track' }, { status: 500 });
    }

    // Transform the response to match the expected format
    const transformedTrack: Track = {
      id: insertedTrack.id,
      title: insertedTrack.title,
      isrc: insertedTrack.isrc,
      composers: insertedTrack.composers,
      releaseDate: insertedTrack.release_date,
      platform: insertedTrack.platform,
      territory: insertedTrack.territory,
      createdAt: insertedTrack.created_at,
    };

    return NextResponse.json({ data: transformedTrack }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


