/**
 * Artist Helper Functions
 * 
 * These functions help resolve artist IDs from user IDs and vice versa.
 * 
 * Important Schema Notes:
 * - `artists.id` (UUID) - Primary key of artists table
 * - `artists.user_id` (UUID) - References auth.users.id
 * - `tracks.artist_id` (UUID) - References artists.id (NOT auth.users.id)
 * - `royalties.artist_id` (UUID) - References auth.users.id
 * - `payment_requests.artist_id` (UUID) - References auth.users.id
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Get the artists.id from a user.id (auth.users.id)
 * 
 * @param userId - The auth.users.id (UUID)
 * @returns The artists.id (UUID) or null if not found
 */
export async function getArtistIdFromUserId(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("artists")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("Error fetching artist ID:", error);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    console.error("Error in getArtistIdFromUserId:", error);
    return null;
  }
}

/**
 * Get the user.id (auth.users.id) from an artists.id
 * 
 * @param artistId - The artists.id (UUID)
 * @returns The auth.users.id (UUID) or null if not found
 */
export async function getUserIdFromArtistId(artistId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("artists")
      .select("user_id")
      .eq("id", artistId)
      .single();

    if (error) {
      console.error("Error fetching user ID:", error);
      return null;
    }

    return data?.user_id || null;
  } catch (error) {
    console.error("Error in getUserIdFromArtistId:", error);
    return null;
  }
}

/**
 * Get artist details (id, name, email) from user.id
 * 
 * @param userId - The auth.users.id (UUID)
 * @returns Artist details or null if not found
 */
export async function getArtistDetailsFromUserId(userId: string): Promise<{
  id: string;
  name: string;
  email: string | null;
  user_id: string;
} | null> {
  try {
    const { data, error } = await supabase
      .from("artists")
      .select("id, name, email, user_id")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("Error fetching artist details:", error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error("Error in getArtistDetailsFromUserId:", error);
    return null;
  }
}

