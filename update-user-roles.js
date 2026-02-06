/**
 * Update User Roles Script
 * 
 * This script updates the roles for specific users in the user_profiles table.
 * Run with: node update-user-roles.js
 * 
 * Make sure you have SUPABASE_SERVICE_ROLE_KEY set in your .env.local file
 * or export it as an environment variable.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceRoleKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY is not set in .env.local');
  console.error('   Please add SUPABASE_SERVICE_ROLE_KEY to your .env.local file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

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

async function updateUserRoles() {
  console.log('🔄 Updating user roles...\n');

  for (const user of usersToUpdate) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({ role: user.role })
        .eq('id', user.id)
        .eq('email', user.email)
        .select();

      if (error) {
        console.error(`❌ Error updating ${user.email}:`, error.message);
      } else if (data && data.length > 0) {
        console.log(`✅ Updated ${user.email} to role: ${user.role}`);
      } else {
        console.warn(`⚠️  No user found with id ${user.id} and email ${user.email}`);
      }
    } catch (err) {
      console.error(`❌ Exception updating ${user.email}:`, err.message);
    }
  }

  console.log('\n📋 Verifying updates...\n');

  const userIds = usersToUpdate.map(u => u.id);
  const { data: profiles, error: verifyError } = await supabase
    .from('user_profiles')
    .select('id, email, role')
    .in('id', userIds)
    .order('email');

  if (verifyError) {
    console.error('❌ Error verifying updates:', verifyError.message);
  } else {
    console.log('Current user roles:');
    profiles.forEach(profile => {
      console.log(`  - ${profile.email}: ${profile.role}`);
    });
  }
}

updateUserRoles()
  .then(() => {
    console.log('\n✅ Role update process completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });

