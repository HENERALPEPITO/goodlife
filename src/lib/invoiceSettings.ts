/**
 * Invoice Settings Utilities
 * Fetches and manages invoice business settings
 */

import { supabase } from "./supabaseClient";
import { supabaseAdmin } from "./supabaseAdmin";

export interface InvoiceSettings {
  id: string;
  business_name: string;
  address: string;
  contact_person?: string | null;
  phone: string;
  email: string;
  tax_id: string;
  updated_at: string;
  updated_by?: string | null;
}

/**
 * Get invoice settings (single row, admin-editable)
 */
export async function getInvoiceSettings(): Promise<InvoiceSettings | null> {
  try {
    const { data, error } = await supabase
      .from("invoice_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) {
      // Silently fall back to defaults - this is expected if table doesn't exist or RLS blocks access
      return getDefaultInvoiceSettings();
    }

    if (!data) {
      console.warn("No invoice settings found in database, using defaults");
      return getDefaultInvoiceSettings();
    }

    return data;
  } catch {
    // Silently fall back to defaults
    return getDefaultInvoiceSettings();
  }
}

/**
 * Get default invoice settings
 */
function getDefaultInvoiceSettings(): InvoiceSettings {
  return {
    id: "default",
    business_name: "Good Life Music S.L",
    address: "Profesor Hermida 6, 3-3C, 36960 Sanxenxo (Spain)",
    phone: "+34 693 43 25 06",
    email: "info@goodlifemusic.com",
    tax_id: "B72510704",
    updated_at: new Date().toISOString(),
    contact_person: null,
    updated_by: null,
  };
}

/**
 * Get invoice settings using admin client (for API routes)
 */
export async function getInvoiceSettingsAdmin(): Promise<InvoiceSettings | null> {
  if (!supabaseAdmin) {
    console.warn("Admin client not available, returning default settings");
    return getDefaultInvoiceSettings();
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("invoice_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching invoice settings (admin):", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return getDefaultInvoiceSettings();
    }

    if (!data) {
      console.warn("No invoice settings found in database, using defaults");
      return getDefaultInvoiceSettings();
    }

    return data;
  } catch (error: any) {
    console.error("Error fetching invoice settings (admin):", {
      message: error?.message || "Unknown error",
      name: error?.name,
      stack: error?.stack
    });
    return getDefaultInvoiceSettings();
  }
}

/**
 * Update invoice settings (admin only)
 */
export async function updateInvoiceSettings(
  settings: Partial<Omit<InvoiceSettings, "id" | "updated_at" | "updated_by">>,
  updatedBy?: string
): Promise<boolean> {
  if (!supabaseAdmin) {
    console.error("Admin client not available, cannot update invoice settings");
    return false;
  }

  try {
    // Prepare update data
    const updateData: Partial<InvoiceSettings> = {
      ...settings,
      updated_at: new Date().toISOString(),
    };

    if ('contact_person' in settings && settings.contact_person === undefined) {
      updateData.contact_person = null;
    }

    if (updatedBy) {
      updateData.updated_by = updatedBy;
    }

    // Upsert (create or update single row)
    const { error } = await supabaseAdmin
      .from("invoice_settings")
      .upsert(updateData, {
        onConflict: "id",
      });

    if (error) {
      console.error("Error updating invoice settings:", error);
      return false;
    }

    return true;
  } catch (error: any) {
    console.error("Error updating invoice settings:", error);
    return false;
  }
}
