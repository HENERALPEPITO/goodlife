/**
 * Create/Update Admin User
 * 
 * This script ensures the admin user exists with the correct role
 * Run with: node create-admin-user.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nyxedsuflhvxzijjiktj.supabase.co';
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

const adminUser = {
  id: '17f0111b-138a-4217-9c46-a9a513411368',
  email: 'admin@test.com',
  password: 'admin123456',
  role: 'admin'
};

async function createAdminUser() {
  console.log('🔧 Creating/Updating admin user...\n');

  try {
    // Check if auth user exists
    const { data: allUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError.message);
      return;
    }

    const existingAuthUser = allUsers.users?.find(u => u.email === adminUser.email || u.id === adminUser.id);

    if (!existingAuthUser) {
      // Create auth user
      console.log('Creating auth user...');
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: adminUser.email,
        password: adminUser.password,
        email_confirm: true,
      });

      if (authError) {
        console.error('❌ Error creating auth user:', authError.message);
        return;
      }

      console.log('✅ Created auth user:', authData.user.id);
      adminUser.id = authData.user.id;
    } else {
      console.log('✅ Auth user already exists:', existingAuthUser.id);
      adminUser.id = existingAuthUser.id;
    }

    // Check if profile exists
    const { data: existingProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', adminUser.id)
      .maybeSingle();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('❌ Error checking profile:', profileError.message);
      return;
    }

    if (existingProfile) {
      // Update if role is different
      if (existingProfile.role !== adminUser.role) {
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ role: adminUser.role, email: adminUser.email })
          .eq('id', adminUser.id);

        if (updateError) {
          console.error('❌ Error updating profile:', updateError.message);
        } else {
          console.log('✅ Updated profile role to:', adminUser.role);
        }
      } else {
        console.log('✅ Profile already exists with correct role:', adminUser.role);
      }
    } else {
      // Create profile
      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          id: adminUser.id,
          email: adminUser.email,
          role: adminUser.role
        });

      if (insertError) {
        console.error('❌ Error creating profile:', insertError.message);
        console.error('Details:', JSON.stringify(insertError, null, 2));
      } else {
        console.log('✅ Created profile with role:', adminUser.role);
      }
    }

    // Verify
    const { data: finalProfile, error: verifyError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', adminUser.id)
      .single();

    if (verifyError) {
      console.error('❌ Error verifying profile:', verifyError.message);
    } else {
      console.log('\n✅ Admin user verified:');
      console.log('   ID:', finalProfile.id);
      console.log('   Email:', finalProfile.email);
      console.log('   Role:', finalProfile.role);
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

createAdminUser()
  .then(() => {
    console.log('\n✅ Done! Try logging in with:');
    console.log('   Email: admin@test.com');
    console.log('   Password: admin123456\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });

