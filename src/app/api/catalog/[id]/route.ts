import { NextResponse } from "next/server";
import { Track } from "@/types";
import { supabase } from "@/lib/supabaseClient";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const body = (await request.json()) as Partial<Track>;
    
    // Transform the data to match database schema
    const updateData: any = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.isrc !== undefined) updateData.isrc = body.isrc;
    if (body.composers !== undefined) updateData.composers = body.composers;
    if (body.releaseDate !== undefined) updateData.release_date = body.releaseDate;
    if (body.platform !== undefined) updateData.platform = body.platform;
    if (body.territory !== undefined) updateData.territory = body.territory;

    const { data: updatedTrack, error } = await supabase
      .from('tracks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating track:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to update track' }, { status: 500 });
    }

    // Transform the response to match the expected format
    const transformedTrack: Track = {
      id: updatedTrack.id,
      title: updatedTrack.title,
      isrc: updatedTrack.isrc,
      composers: updatedTrack.composers,
      releaseDate: updatedTrack.release_date,
      platform: updatedTrack.platform,
      territory: updatedTrack.territory,
      createdAt: updatedTrack.created_at,
    };

    return NextResponse.json({ data: transformedTrack });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    
    const { error } = await supabase
      .from('tracks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting track:', error);
      return NextResponse.json({ error: 'Failed to delete track' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


