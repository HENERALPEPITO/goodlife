import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Get artist profiles for dropdowns (used by InvoiceManager)
export async function GET(req: NextRequest) {
  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, email")
      .eq("role", "artist")
      .order("email");

    if (error) {
      console.error("Error fetching artist profiles:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
