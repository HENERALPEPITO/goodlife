/**
 * POST /api/admin/royalties/notify/[artistId]
 *
 * Sends the artist an email telling them their royalty reports are
 * available in the client portal. Admin-only; triggered manually from
 * the Royalties Management page.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdminFromCookies } from "@/lib/authHelpers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendRoyaltyReportsAvailableEmailToArtist } from "@/lib/emailService";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ artistId: string }> }
): Promise<NextResponse> {
  try {
    // The browser session lives in cookies, so the Bearer header may be absent.
    const admin = (await requireAdmin(request.headers)) ?? (await requireAdminFromCookies());
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    const { artistId } = await params;
    if (!artistId) {
      return NextResponse.json({ success: false, error: "artistId is required" }, { status: 400 });
    }

    const adminClient = getSupabaseAdmin();

    const { data: artist, error: artistError } = await adminClient
      .from("artists")
      .select("id, name, email, user_id")
      .eq("id", artistId)
      .maybeSingle();

    if (artistError) {
      console.error("[notify royalties] Error fetching artist:", artistError);
      return NextResponse.json({ success: false, error: "Failed to fetch artist" }, { status: 500 });
    }
    if (!artist) {
      return NextResponse.json({ success: false, error: "Artist not found" }, { status: 404 });
    }

    // Prefer the login email (user_profiles), fall back to the artist's contact email.
    let email: string | null = null;
    if (artist.user_id) {
      const { data: profile } = await adminClient
        .from("user_profiles")
        .select("email")
        .eq("id", artist.user_id)
        .maybeSingle();
      email = profile?.email || null;
    }
    email = email || artist.email || null;

    if (!email) {
      return NextResponse.json(
        { success: false, error: "This artist has no email address" },
        { status: 422 }
      );
    }

    const result = await sendRoyaltyReportsAvailableEmailToArtist({
      artistName: artist.name || "Artist",
      artistEmail: email,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to send email" },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, email, messageId: result.messageId });
  } catch (error) {
    console.error("[notify royalties] Unexpected error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
