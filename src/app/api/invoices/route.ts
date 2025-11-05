import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getCurrentUser } from "@/lib/authHelpers";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createServerSupabaseClient();

    // Fetch invoices
    let query = supabase
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
      .order("created_at", { ascending: false });

    // Artists can only see their own invoices
    if (user.role !== "admin") {
      query = query.eq("artist_id", user.id);
    }

    const { data: invoices, error } = await query;

    if (error) throw error;

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        artist_id,
        invoice_number,
        invoice_date: invoice_date || new Date().toISOString(),
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
        created_by: user.id,
        status: "pending",
        mode_of_payment: "pending", // Default, can be updated
        remarks: notes, // Store notes in remarks field for backward compatibility
      })
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    // Create line items if provided
    if (line_items && line_items.length > 0) {
      const lineItemsData = line_items.map((item: any, index: number) => ({
        invoice_id: invoice.id,
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

    // Fetch the complete invoice with line items
    const { data: completeInvoice, error: fetchError } = await supabase
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
      .eq("id", invoice.id)
      .single();

    if (fetchError) throw fetchError;

    return NextResponse.json({ invoice: completeInvoice }, { status: 201 });
  } catch (error) {
    console.error("Error creating invoice:", error);
    return NextResponse.json(
      { error: "Failed to create invoice" },
      { status: 500 }
    );
  }
}

