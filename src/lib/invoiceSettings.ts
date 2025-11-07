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
  contact_person?: string;
  phone: string;
  email: string;
  tax_id: string;
  updated_at: string;
  updated_by?: string;
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
      .single();

    if (error) {
      console.error("Error fetching invoice settings:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error fetching invoice settings:", error);
    return null;
  }
}

/**
 * Get invoice settings using admin client (for API routes)
 */
export async function getInvoiceSettingsAdmin(): Promise<InvoiceSettings | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("invoice_settings")
      .select("*")
      .limit(1)
      .single();

    if (error) {
      console.error("Error fetching invoice settings:", error);
      // Return default settings if table is empty
      return {
        id: "default",
        business_name: "Good Life Music S.L",
        address: "Profesor Hermida 6, 3-3C, 36960 Sanxenxo (Spain)",
        phone: "+34 693 43 25 06",
        email: "info@goodlifemusic.com",
        tax_id: "B72510704",
        updated_at: new Date().toISOString(),
      };
    }

    return data;
  } catch (error) {
    console.error("Error fetching invoice settings:", error);
    return {
      id: "default",
      business_name: "Good Life Music S.L",
      address: "Profesor Hermida 6, 3-3C, 36960 Sanxenxo (Spain)",
      phone: "+34 693 43 25 06",
      email: "info@goodlifemusic.com",
      tax_id: "B72510704",
      updated_at: new Date().toISOString(),
    };
  }
}

/**
 * Update invoice settings (admin only)
 */
export async function updateInvoiceSettings(
  settings: Partial<Omit<InvoiceSettings, "id" | "updated_at" | "updated_by">>,
  updatedBy?: string
): Promise<boolean> {
  try {
    // Ensure contact_person is included in the update
    const updateData: any = {
      ...settings,
      updated_at: new Date().toISOString(),
    };
    
    // If contact_person is explicitly set to undefined, set it to null
    if (settings.contact_person === undefined && 'contact_person' in settings) {
      updateData.contact_person = null;
    }

    if (updatedBy) {
      updateData.updated_by = updatedBy;
    }

    // Since there's only one row, we can use upsert or update
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
  } catch (error) {
    console.error("Error updating invoice settings:", error);
    return false;
  }
}

