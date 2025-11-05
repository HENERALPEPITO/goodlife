import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getCurrentUser } from "@/lib/authHelpers";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createServerSupabaseClient();

    // Fetch invoice
    const { data: invoice, error } = await supabase
      .from("invoices")
      .select(`
        *,
        invoice_line_items (
          id,
          description,
          quantity,
          unit_price,
          subtotal,
          sort_order
        )
      `)
      .eq("id", params.id)
      .single();

    if (error) throw error;

    // Check permissions
    if (user.role !== "admin" && invoice.artist_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error("Error fetching invoice:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = await createServerSupabaseClient();

    const body = await request.json();
    const {
      artist_id,
      invoice_number,
      invoice_date,
      due_date,
      recipient_name,
      recipient_email,
      recipient_phone,
      recipient_address,
      tax_rate,
      currency,
      notes,
      logo_url,
      line_items,
    } = body;

    // Calculate totals from line items
    const subtotal = line_items?.reduce(
      (sum: number, item: any) => sum + (item.quantity || 1) * item.unit_price,
      0
    ) || 0;
    const taxAmount = subtotal * ((tax_rate || 0) / 100);
    const total = subtotal + taxAmount;

    // Update invoice
    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        artist_id,
        invoice_number,
        invoice_date,
        due_date,
        recipient_name,
        recipient_email,
        recipient_phone,
        recipient_address,
        subtotal,
        tax_rate: tax_rate || 0,
        tax_amount: taxAmount,
        amount: total,
        currency: currency || "€",
        notes,
        logo_url,
        remarks: notes, // Store notes in remarks field for backward compatibility
      })
      .eq("id", params.id);

    if (updateError) throw updateError;

    // Update line items (delete old, insert new)
    await supabase
      .from("invoice_line_items")
      .delete()
      .eq("invoice_id", params.id);

    if (line_items && line_items.length > 0) {
      const lineItemsData = line_items.map((item: any, index: number) => ({
        invoice_id: params.id,
        description: item.description,
        quantity: item.quantity || 1,
        unit_price: item.unit_price,
        subtotal: (item.quantity || 1) * item.unit_price,
        sort_order: index,
      }));

      const { error: lineItemsError } = await supabase
        .from("invoice_line_items")
        .insert(lineItemsData);

      if (lineItemsError) throw lineItemsError;
    }

    // Fetch updated invoice
    const { data: invoice, error: fetchError } = await supabase
      .from("invoices")
      .select(`
        *,
        invoice_line_items (
          id,
          description,
          quantity,
          unit_price,
          subtotal,
          sort_order
        )
      `)
      .eq("id", params.id)
      .single();

    if (fetchError) throw fetchError;

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error("Error updating invoice:", error);
    return NextResponse.json(
      { error: "Failed to update invoice" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = await createServerSupabaseClient();

    // Delete invoice (line items will be deleted via CASCADE)
    const { error } = await supabase
      .from("invoices")
      .delete()
      .eq("id", params.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    return NextResponse.json(
      { error: "Failed to delete invoice" },
      { status: 500 }
    );
  }
}

