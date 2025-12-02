/**
 * Royalty Storage Utilities
 * 
 * Handles file uploads to and downloads from Supabase Storage
 * for CSV royalty processing.
 */

import { supabase } from '@/lib/supabaseClient';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type { StorageUploadResult, StorageDownloadResult } from '@/types/royalty-processing';

// Storage bucket name for royalty CSV files
export const ROYALTY_BUCKET = 'royalty-uploads';

// Maximum file size: 100MB
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

/**
 * Generate a unique storage path for an uploaded file
 * Uses user ID as the folder to comply with RLS policies
 * 
 * @param userId - The authenticated user's ID (folder name per RLS)
 * @param originalFilename - The original filename
 */
export function generateStoragePath(userId: string, originalFilename: string): string {
  const timestamp = Date.now();
  const sanitizedFilename = originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${userId}/${timestamp}-${sanitizedFilename}`;
}

/**
 * Upload a CSV file to Supabase Storage (client-side)
 * 
 * @param file - The File object to upload
 * @param userId - The authenticated user's ID (required for RLS - files stored in userId folder)
 * @returns StorageUploadResult with path on success
 */
export async function uploadCsvToStorage(
  file: File,
  userId: string
): Promise<StorageUploadResult> {
  try {
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return { success: false, error: 'File must be a CSV' };
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return { success: false, error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` };
    }

    // Use userId for folder path to comply with RLS policy
    const storagePath = generateStoragePath(userId, file.name);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(ROYALTY_BUCKET)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'text/csv',
      });

    if (error) {
      console.error('Storage upload error:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      path: data.path,
      fileSize: file.size,
      contentType: 'text/csv',
    };
  } catch (error: any) {
    console.error('Unexpected upload error:', error);
    return { success: false, error: error?.message || 'Upload failed' };
  }
}

/**
 * Download a CSV file from Supabase Storage (server-side)
 * Uses admin client to bypass RLS
 * 
 * @param storagePath - The path in storage to download
 * @returns StorageDownloadResult with data blob on success
 */
export async function downloadCsvFromStorage(
  storagePath: string
): Promise<StorageDownloadResult> {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin.storage
      .from(ROYALTY_BUCKET)
      .download(storagePath);

    if (error) {
      console.error('Storage download error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Unexpected download error:', error);
    return { success: false, error: error?.message || 'Download failed' };
  }
}

/**
 * Delete a CSV file from Supabase Storage (server-side)
 * Used for cleanup after processing
 * 
 * @param storagePath - The path to delete
 */
export async function deleteCsvFromStorage(storagePath: string): Promise<boolean> {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { error } = await supabaseAdmin.storage
      .from(ROYALTY_BUCKET)
      .remove([storagePath]);

    if (error) {
      console.error('Storage delete error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Unexpected delete error:', error);
    return false;
  }
}

/**
 * Get a signed URL for downloading a file (for failed rows CSV)
 * 
 * @param storagePath - The path to the file
 * @param expiresIn - Seconds until URL expires (default: 1 hour)
 */
export async function getSignedDownloadUrl(
  storagePath: string,
  expiresIn: number = 3600
): Promise<{ url?: string; error?: string }> {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin.storage
      .from(ROYALTY_BUCKET)
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      return { error: error.message };
    }

    return { url: data.signedUrl };
  } catch (error: any) {
    return { error: error?.message || 'Failed to generate signed URL' };
  }
}
