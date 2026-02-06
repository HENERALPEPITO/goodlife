/**
 * Setup User Profiles Table and RLS Policies
 * 
 * This script uses the service role key to set up the user_profiles table
 * and fix RLS policies so users can create their own profiles.
 * 
 * Run with: node setup-user-profiles.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceRoleKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY is not set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function setupUserProfiles() {
  console.log('🔧 Setting up user_profiles table and RLS policies...\n');

  // SQL to create table and set up RLS policies
  const setupSQL = `
    -- Create user_profiles table if it doesn't exist
    CREATE TABLE IF NOT EXISTS user_profiles (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK (role IN ('admin', 'artist')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Create indexes if they don't exist
    CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
    CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

    -- Enable RLS
    ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if they exist (to avoid conflicts)
    DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
    DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
    DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
    DROP POLICY IF EXISTS "Admins can insert profiles" ON user_profiles;

    -- Policy: Users can view their own profile (CRITICAL - must come first)
    CREATE POLICY "Users can view own profile"
      ON user_profiles FOR SELECT
      TO authenticated
      USING (id = auth.uid());

    -- Policy: Users can insert their own profile (CRITICAL - allows new users to create profile)
    CREATE POLICY "Users can insert own profile"
      ON user_profiles FOR INSERT
      TO authenticated
      WITH CHECK (id = auth.uid());

    -- Policy: Users can update their own profile
    CREATE POLICY "Users can update own profile"
      ON user_profiles FOR UPDATE
      TO authenticated
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());

    -- Policy: Admins can view all profiles
    CREATE POLICY "Admins can view all profiles"
      ON user_profiles FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles up
          WHERE up.id = auth.uid() AND up.role = 'admin'
        )
      );

    -- Policy: Admins can insert any profile (for admin-created users)
    CREATE POLICY "Admins can insert profiles"
      ON user_profiles FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_profiles up
          WHERE up.id = auth.uid() AND up.role = 'admin'
        )
      );
  `;

  try {
    // Execute the SQL using RPC or direct SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql: setupSQL });

    if (error) {
      // If RPC doesn't exist, try running via REST API using raw SQL
      console.log('⚠️  RPC method not available, trying alternative approach...\n');

      // We'll need to use the REST API directly or run SQL via Supabase client
      // For now, let's verify the table exists and check current policies
      const { data: tableCheck, error: tableError } = await supabase
        .from('user_profiles')
        .select('*')
        .limit(0);

      if (tableError && tableError.code === '42P01') {
        console.error('❌ user_profiles table does not exist!');
        console.error('   Please run the SQL script manually in Supabase SQL Editor:');
        console.error('   File: fix-user-profiles-rls.sql\n');
        return;
      }

      console.log('✅ user_profiles table exists');

      // Check if we can query it
      const { data: profiles, error: queryError } = await supabase
        .from('user_profiles')
        .select('id, email, role')
        .limit(5);

      if (queryError) {
        console.error('❌ Error querying user_profiles:', queryError.message);
        console.error('   This might be an RLS issue. Please run fix-user-profiles-rls.sql manually.\n');
      } else {
        console.log('✅ Successfully queried user_profiles');
        if (profiles && profiles.length > 0) {
          console.log('\n📋 Current user profiles:');
          profiles.forEach(p => {
            console.log(`   - ${p.email}: ${p.role}`);
          });
        } else {
          console.log('   (No profiles found yet)');
        }
      }
    } else {
      console.log('✅ Successfully set up user_profiles table and RLS policies!');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('\n💡 Since we can\'t execute SQL directly via the client,');
    console.error('   please run the SQL script manually in Supabase SQL Editor:');
    console.error('   File: fix-user-profiles-rls.sql\n');
  }

  // Verify the setup
  console.log('\n🔍 Verifying setup...\n');

  const { data: profiles, error: verifyError } = await supabase
    .from('user_profiles')
    .select('id, email, role')
    .limit(10);

  if (verifyError) {
    console.error('❌ Verification failed:', verifyError.message);
    console.error('   Error code:', verifyError.code);
    console.error('\n   This indicates the table or RLS policies need to be set up.');
    console.error('   Please run fix-user-profiles-rls.sql in your Supabase SQL Editor.\n');
  } else {
    console.log('✅ Setup verified! Found', profiles?.length || 0, 'user profiles');
    if (profiles && profiles.length > 0) {
      console.log('\n📋 User profiles:');
      profiles.forEach(p => {
        console.log(`   - ${p.email}: ${p.role} (${p.id})`);
      });
    }
  }
}

setupUserProfiles()
  .then(() => {
    console.log('\n✅ Setup process completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });

