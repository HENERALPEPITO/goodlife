/**
 * Script to sync user roles from user_profiles to auth.users.raw_user_meta_data
 * 
 * This script is for one-time migration of existing users.
 * After running, all users will have their role in user_metadata for instant access.
 * 
 * Prerequisites:
 * - SUPABASE_SERVICE_ROLE_KEY environment variable must be set
 * - NEXT_PUBLIC_SUPABASE_URL environment variable must be set
 * 
 * Usage:
 * node scripts/sync-user-metadata.js
 */

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Missing environment variables:");
  console.error("   - NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✓" : "✗");
  console.error("   - SUPABASE_SERVICE_ROLE_KEY:", serviceRoleKey ? "✓" : "✗");
  console.error("\nSet these in your .env.local file or environment.");
  process.exit(1);
}

// Use service role key to bypass RLS
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function syncUserMetadata() {
  console.log("🔄 Starting user metadata sync...\n");

  // Get all user profiles
  const { data: profiles, error: profilesError } = await supabase
    .from("user_profiles")
    .select("id, email, role");

  if (profilesError) {
    console.error("❌ Error fetching profiles:", profilesError);
    process.exit(1);
  }

  console.log(`📋 Found ${profiles.length} user profiles to sync\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const profile of profiles) {
    try {
      // Update user metadata
      const { error } = await supabase.auth.admin.updateUserById(profile.id, {
        user_metadata: { role: profile.role },
      });

      if (error) {
        console.error(`❌ Error updating ${profile.email}:`, error.message);
        errorCount++;
      } else {
        console.log(`✅ Synced ${profile.email} → role: ${profile.role}`);
        successCount++;
      }
    } catch (err) {
      console.error(`❌ Exception for ${profile.email}:`, err.message);
      errorCount++;
    }
  }

  console.log("\n📊 Sync complete:");
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📋 Total: ${profiles.length}`);
}

syncUserMetadata().catch(console.error);
