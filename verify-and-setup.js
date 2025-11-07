/**
 * Verify Service Role Key and Setup User Profiles
 * 
 * This script:
 * 1. Verifies the service role key works with the new database
 * 2. Sets up the user_profiles table and RLS policies
 * 3. Updates user roles if needed
 * 
 * Run with: node verify-and-setup.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nyxedsuflhvxzijjiktj.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceRoleKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY is not set in .env.local');
  console.error('   Please create .env.local file with your service role key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function verifyAndSetup() {
  console.log('🔍 Verifying service role key...\n');
  console.log('   Database URL:', supabaseUrl);
  console.log('   Service Role Key:', supabaseServiceRoleKey.substring(0, 20) + '...\n');

  // Test the connection by querying auth.users (which requires service role)
  try {
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('❌ Service role key verification failed!');
      console.error('   Error:', usersError.message);
      console.error('\n   This key might be from the OLD database.');
      console.error('   Please get the service role key from the NEW database:');
      console.error('   https://nyxedsuflhvxzijjiktj.supabase.co');
      console.error('   Settings → API → service_role (click Reveal)\n');
      return;
    }

    console.log('✅ Service role key verified!');
    console.log(`   Found ${users.users?.length || 0} users in auth.users\n`);
  } catch (err) {
    console.error('❌ Error verifying key:', err.message);
    return;
  }

  // Check if user_profiles table exists
  console.log('🔍 Checking user_profiles table...\n');
  
  const { data: profiles, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, email, role')
    .limit(1);

  if (profileError) {
    if (profileError.code === '42P01') {
      console.error('❌ user_profiles table does not exist!');
      console.error('\n   Please run the SQL script in Supabase SQL Editor:');
      console.error('   File: fix-user-profiles-rls.sql\n');
      console.error('   Or run this SQL in the SQL Editor:');
      console.error('   https://nyxedsuflhvxzijjiktj.supabase.co/project/_/sql\n');
      return;
    } else {
      console.error('❌ Error querying user_profiles:', profileError.message);
      console.error('   This might be an RLS issue. Running setup...\n');
    }
  } else {
    console.log('✅ user_profiles table exists');
    console.log(`   Found ${profiles?.length || 0} profiles\n`);
  }

  // Update user roles
  console.log('🔄 Updating user roles...\n');

  const usersToUpdate = [
    {
      id: '920946a9-1d77-45c9-bb72-aaf80aa2769e',
      email: 'artist@test.com',
      role: 'artist'
    },
    {
      id: '17f0111b-138a-4217-9c46-a9a513411368',
      email: 'admin@test.com',
      role: 'admin'
    },
    {
      id: 'bf4e61ab-be16-422e-be8e-21725828bfe0',
      email: 'sydney@example.com',
      role: 'artist'
    }
  ];

  for (const user of usersToUpdate) {
    try {
      // First check if profile exists
      const { data: existing, error: checkError } = await supabase
        .from('user_profiles')
        .select('id, email, role')
        .eq('id', user.id)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error(`❌ Error checking ${user.email}:`, checkError.message);
        continue;
      }

      if (!existing) {
        // Create profile if it doesn't exist
        const { data: newProfile, error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            id: user.id,
            email: user.email,
            role: user.role
          })
          .select()
          .single();

        if (insertError) {
          console.error(`❌ Error creating profile for ${user.email}:`, insertError.message);
        } else {
          console.log(`✅ Created profile for ${user.email} with role: ${user.role}`);
        }
      } else {
        // Update role if it's different
        if (existing.role !== user.role) {
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({ role: user.role })
            .eq('id', user.id);

          if (updateError) {
            console.error(`❌ Error updating ${user.email}:`, updateError.message);
          } else {
            console.log(`✅ Updated ${user.email} to role: ${user.role}`);
          }
        } else {
          console.log(`✓ ${user.email} already has role: ${user.role}`);
        }
      }
    } catch (err) {
      console.error(`❌ Exception updating ${user.email}:`, err.message);
    }
  }

  // Final verification
  console.log('\n📋 Final verification...\n');
  
  const { data: finalProfiles, error: finalError } = await supabase
    .from('user_profiles')
    .select('id, email, role')
    .in('id', usersToUpdate.map(u => u.id))
    .order('email');

  if (finalError) {
    console.error('❌ Error verifying updates:', finalError.message);
  } else {
    console.log('✅ User profiles:');
    finalProfiles.forEach(p => {
      console.log(`   - ${p.email}: ${p.role}`);
    });
  }
}

verifyAndSetup()
  .then(() => {
    console.log('\n✅ Setup process completed!');
    console.log('\n💡 Next steps:');
    console.log('   1. Make sure .env.local has the correct service role key');
    console.log('   2. Restart your Next.js dev server');
    console.log('   3. Try logging in again\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });

