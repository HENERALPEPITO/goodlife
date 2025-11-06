/**
 * Invoice Settings API
 * GET/PUT /api/invoice-settings
 * Allows admins to view and update invoice business settings
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authHelpers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getInvoiceSettingsAdmin, updateInvoiceSettings } from "@/lib/invoiceSettings";

export async function GET() {
  try {
    const settings = await getInvoiceSettingsAdmin();
    return NextResponse.json({ success: true, settings }, { status: 200 });
  } catch (error) {
    console.error("Error fetching invoice settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch invoice settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Verify admin access
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { business_name, address, contact_person, phone, email, tax_id } = body;

    // Validate required fields
    if (!business_name || !address || !phone || !email || !tax_id) {
      return NextResponse.json(
        { success: false, error: "All fields are required (except Contact Person)" },
        { status: 400 }
      );
    }

    // Update settings
    const success = await updateInvoiceSettings(
      {
        business_name,
        address,
        contact_person: contact_person || undefined,
        phone,
        email,
        tax_id,
      },
      admin.id
    );

    if (!success) {
      return NextResponse.json(
        { success: false, error: "Failed to update invoice settings" },
        { status: 500 }
      );
    }

    // Fetch updated settings
    const updatedSettings = await getInvoiceSettingsAdmin();

    return NextResponse.json(
      { success: true, settings: updatedSettings },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating invoice settings:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

