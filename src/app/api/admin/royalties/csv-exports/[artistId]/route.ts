/**
 * GET /api/admin/royalties/csv-exports/:artistId
 * 
 * Get all CSV uploads for an artist with signed download URLs
 * Admin-only endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

interface CsvUpload {
  id: string;
  filename: string;
  storage_path: string;
  year: number;
  quarter: number;
  file_size: number;
  row_count: number;
  processing_status: string;
  created_at: string;
  download_url?: string;
}

async function verifyAdmin(request: NextRequest, supabaseUrl: string, supabaseAnonKey: string) {
  const response = NextResponse.next();
  
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Try to get user from Authorization header first
  const authHeader = request.headers.get('Authorization');
  
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    
    if (!authError && authUser) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", authUser.id)
        .single();
      
      if (profile?.role === "admin") {
        return { isAdmin: true, userId: authUser.id };
      }
    }
  }
  
  // If no user from token, try to get session from cookies
  await supabase.auth.getUser();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session?.user) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();
    
    if (profile?.role === "admin") {
      return { isAdmin: true, userId: session.user.id };
    }
  }

  return { isAdmin: false, userId: null };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ artistId: string }> }
): Promise<NextResponse> {
  try {
    const { artistId } = await params;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // Verify admin
    const { isAdmin } = await verifyAdmin(request, supabaseUrl, supabaseAnonKey);
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    // Use admin client to fetch CSV uploads
    const adminClient = getSupabaseAdmin();

    // Get all completed CSV uploads for this artist
    const { data: csvUploads, error: fetchError } = await adminClient
      .from("csv_uploads")
      .select("id, filename, storage_path, year, quarter, file_size, row_count, processing_status, created_at")
      .eq("artist_id", artistId)
      .eq("processing_status", "completed")
      .order("year", { ascending: false })
      .order("quarter", { ascending: false });

    if (fetchError) {
      console.error("Error fetching CSV uploads:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch CSV uploads" },
        { status: 500 }
      );
    }

    // Generate signed download URLs for each CSV
    const uploadsWithUrls: CsvUpload[] = await Promise.all(
      (csvUploads || []).map(async (upload) => {
        let download_url: string | undefined;
        
        if (upload.storage_path) {
          const { data: signedUrl, error: urlError } = await adminClient.storage
            .from("royalty-uploads")
            .createSignedUrl(upload.storage_path, 3600); // 1 hour expiry
          
          if (!urlError && signedUrl) {
            download_url = signedUrl.signedUrl;
          }
        }

        return {
          ...upload,
          download_url,
        };
      })
    );

    return NextResponse.json(uploadsWithUrls, { status: 200 });
  } catch (error) {
    console.error("Error in CSV exports endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
