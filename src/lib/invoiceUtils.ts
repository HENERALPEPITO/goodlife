/**
 * Utility functions for invoice generation
 */

/**
 * Converts an image file to base64 string for use in PDF generation
 * @param imagePath - Path to the image file (relative to public folder or absolute URL)
 * @returns Promise that resolves to base64 string
 */
export async function loadLogoAsBase64(imagePath: string = '/logo.png'): Promise<string | undefined> {
  try {
    // For client-side usage, we need to fetch the image
    if (typeof window !== 'undefined') {
      const response = await fetch(imagePath);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    
    return undefined;
  } catch (error) {
    console.warn('Failed to load logo:', error);
    return undefined;
  }
}

/**
 * Converts an Invoice from the database to InvoiceData for PDF generation
 */
export function convertInvoiceToInvoiceData(
  invoice: {
    invoice_number: string;
    amount: number;
    created_at: string;
    status?: "pending" | "approved" | "paid" | "rejected";
    remarks?: string | null;
  },
  recipient: {
    name: string;
    email?: string;
    address?: string;
  },
  options?: {
    due_date?: string;
    currency?: string;
    line_items?: Array<{
      description: string;
      quantity?: number;
      rate?: number;
      amount: number;
    }>;
    tax_rate?: number;
    notes?: string;
  }
) {
  return {
    invoice_number: invoice.invoice_number,
    invoice_date: invoice.created_at,
    due_date: options?.due_date,
    recipient_name: recipient.name,
    recipient_email: recipient.email,
    recipient_address: recipient.address,
    line_items: options?.line_items,
    subtotal: options?.line_items 
      ? options.line_items.reduce((sum, item) => sum + item.amount, 0)
      : invoice.amount,
    tax_rate: options?.tax_rate,
    tax_amount: options?.tax_rate 
      ? (options.line_items 
          ? options.line_items.reduce((sum, item) => sum + item.amount, 0) * options.tax_rate / 100
          : invoice.amount * options.tax_rate / 100)
      : undefined,
    total: invoice.amount,
    status: invoice.status,
    currency: options?.currency || '€',
    notes: options?.notes || invoice.remarks || undefined,
  };
}










