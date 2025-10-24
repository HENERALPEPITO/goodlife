// Script to create a test user in Supabase
// Run with: node create-test-user.js

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ulvxfugjzgrjmcfvybjx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsdnhmdWdqemdyam1jZnZ5Ymp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMTEwMDcsImV4cCI6MjA3Njc4NzAwN30.EHZGnCR7hMsncMdQ6LSW5WOg-z3GZFCxpjCvOsqSj8I';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestUser() {
  console.log('Creating test user...');
  
  try {
    // Create the user account
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: 'test@test.com',
      password: 'testpassword123',
    });

    if (authError) {
      console.error('❌ Auth error:', authError.message);
      return false;
    }

    if (authData.user) {
      console.log('✅ User created successfully!');
      console.log('User ID:', authData.user.id);
      console.log('Email:', authData.user.email);
      
      // Note: You'll need to manually create the user profile in the database
      // since we can't insert into user_profiles from the client side due to RLS
      console.log('\n📝 Next steps:');
      console.log('1. Go to your Supabase dashboard');
      console.log('2. Navigate to SQL Editor');
      console.log('3. Run this SQL (replace USER_ID with the ID above):');
      console.log(`
INSERT INTO user_profiles (id, email, role) VALUES 
('${authData.user.id}', 'test@test.com', 'artist')
ON CONFLICT (id) DO NOTHING;
      `);
      
      return true;
    } else {
      console.log('❌ No user data returned');
      return false;
    }
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    return false;
  }
}

createTestUser();

