/**
 * Create Users in New Database
 * 
 * This script creates the test users in the new Supabase database
 * Run with: node create-users.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

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

const usersToCreate = [
  {
    email: 'admin@test.com',
    password: 'admin123456',
    role: 'admin',
    userId: '17f0111b-138a-4217-9c46-a9a513411368' // Optional: specify ID if you want to keep it
  },
  {
    email: 'artist@test.com',
    password: 'artist123456',
    role: 'artist',
    userId: '920946a9-1d77-45c9-bb72-aaf80aa2769e'
  },
  {
    email: 'sydney@example.com',
    password: 'sydney123456', // You'll need to set a password
    role: 'artist',
    userId: 'bf4e61ab-be16-422e-be8e-21725828bfe0'
  }
];

async function createUsers() {
  console.log('🔧 Creating users in new database...\n');
  console.log('   Database:', supabaseUrl);
  console.log('');

  // First, check if user_profiles table exists
  const { error: tableError } = await supabase
    .from('user_profiles')
    .select('*')
    .limit(0);

  if (tableError && tableError.code === '42P01') {
    console.error('❌ user_profiles table does not exist!');
    console.error('\n   Please run this SQL first in Supabase SQL Editor:');
    console.error('   File: fix-user-profiles-rls.sql\n');
    return;
  }

  console.log('✅ user_profiles table exists\n');

  for (const userData of usersToCreate) {
    try {
      console.log(`🔄 Processing ${userData.email}...`);

      // Check if user already exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === userData.email);

      let userId;

      if (existingUser) {
        console.log(`   ✓ User already exists in auth.users (${existingUser.id})`);
        userId = existingUser.id;
      } else {
        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: userData.email,
          password: userData.password,
          email_confirm: true, // Auto-confirm email
        });

        if (authError) {
          console.error(`   ❌ Error creating auth user:`, authError.message);
          continue;
        }

        if (!authData.user) {
          console.error(`   ❌ No user returned from createUser`);
          continue;
        }

        userId = authData.user.id;
        console.log(`   ✅ Created auth user (${userId})`);
      }

      // Check if profile exists
      const { data: existingProfile, error: profileCheckError } = await supabase
        .from('user_profiles')
        .select('id, email, role')
        .eq('id', userId)
        .maybeSingle();

      if (profileCheckError && profileCheckError.code !== 'PGRST116') {
        console.error(`   ❌ Error checking profile:`, profileCheckError.message);
        continue;
      }

      if (existingProfile) {
        // Update role if different
        if (existingProfile.role !== userData.role) {
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({ role: userData.role })
            .eq('id', userId);

          if (updateError) {
            console.error(`   ❌ Error updating profile:`, updateError.message);
          } else {
            console.log(`   ✅ Updated profile role to: ${userData.role}`);
          }
        } else {
          console.log(`   ✓ Profile already exists with correct role: ${userData.role}`);
        }
      } else {
        // Create profile
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            id: userId,
            email: userData.email,
            role: userData.role
          });

        if (profileError) {
          console.error(`   ❌ Error creating profile:`, profileError.message);
          console.error(`   Details:`, JSON.stringify(profileError, null, 2));
        } else {
          console.log(`   ✅ Created profile with role: ${userData.role}`);
        }
      }

      console.log('');
    } catch (err) {
      console.error(`   ❌ Exception:`, err.message);
      console.log('');
    }
  }

  // Final verification
  console.log('📋 Verifying all users...\n');

  const { data: allProfiles, error: verifyError } = await supabase
    .from('user_profiles')
    .select('id, email, role')
    .in('email', usersToCreate.map(u => u.email))
    .order('email');

  if (verifyError) {
    console.error('❌ Error verifying users:', verifyError.message);
  } else {
    console.log('✅ User Summary:');
    console.log('');
    allProfiles.forEach(p => {
      console.log(`   ${p.email}`);
      console.log(`   - ID: ${p.id}`);
      console.log(`   - Role: ${p.role}`);
      console.log('');
    });

    const missing = usersToCreate.filter(u =>
      !allProfiles.some(p => p.email === u.email)
    );

    if (missing.length > 0) {
      console.log('⚠️  Missing users:');
      missing.forEach(u => console.log(`   - ${u.email}`));
    }
  }
}

createUsers()
  .then(() => {
    console.log('\n✅ User creation process completed!');
    console.log('\n💡 Next steps:');
    console.log('   1. Try logging in with one of the test accounts');
    console.log('   2. Check the browser console for any errors');
    console.log('   3. Verify the user_profiles table has RLS policies set up\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });

