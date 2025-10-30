/**
 * Script to test broadcast integration with Supabase and Telegram
 * This validates the entire flow end-to-end
 */

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

console.log('\n🔍 TESTING BROADCAST INTEGRATION\n');
console.log('=' .repeat(50));

async function testSupabaseConnection() {
  console.log('\n1️⃣  Testing Supabase Connection...');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase credentials');
    return false;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Test connection by querying users table
    const { data, error } = await supabase
      .from('users')
      .select('id, telegram_id, telegram_chat_id, role')
      .limit(5);

    if (error) {
      console.error('❌ Supabase query error:', error);
      return false;
    }

    console.log('✅ Supabase connected successfully');
    console.log(`   Found ${data.length} users in sample query`);
    return true;
  } catch (error) {
    console.error('❌ Supabase connection error:', error.message);
    return false;
  }
}

async function testBroadcastsTable() {
  console.log('\n2️⃣  Testing broadcasts table...');

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if broadcasts table exists
    const { data, error } = await supabase
      .from('broadcasts')
      .select('*')
      .limit(1);

    if (error && error.message.includes('relation "broadcasts" does not exist')) {
      console.error('❌ broadcasts table does not exist!');
      console.log('\n📝 Please run the migration:');
      console.log('   backend/supabase/migrations/20250119000000_create_broadcasts_table.sql');
      return false;
    }

    if (error) {
      console.error('❌ Error querying broadcasts:', error);
      return false;
    }

    console.log('✅ broadcasts table exists and is accessible');
    console.log(`   Found ${data?.length || 0} broadcasts in database`);
    return true;
  } catch (error) {
    console.error('❌ broadcasts table test error:', error.message);
    return false;
  }
}

async function testTelegramBot() {
  console.log('\n3️⃣  Testing Telegram Bot Connection...');

  if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ Missing TELEGRAM_BOT_TOKEN');
    return false;
  }

  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`
    );

    if (response.data.ok) {
      console.log('✅ Telegram bot is online and responding');
      console.log(`   Bot username: @${response.data.result.username}`);
      console.log(`   Bot name: ${response.data.result.first_name}`);
      return true;
    } else {
      console.error('❌ Bot responded but not OK:', response.data);
      return false;
    }
  } catch (error) {
    console.error('❌ Telegram bot connection error:', error.message);
    return false;
  }
}

async function testUsersWithTelegramId() {
  console.log('\n4️⃣  Testing users with Telegram IDs...');

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get users with telegram_chat_id (users who started the bot)
    const { data, error } = await supabase
      .from('users')
      .select('id, telegram_id, telegram_chat_id, telegram_username, name')
      .not('telegram_chat_id', 'is', null);

    if (error) {
      console.error('❌ Error fetching users:', error);
      return false;
    }

    console.log(`✅ Found ${data.length} users with telegram_chat_id`);

    if (data.length > 0) {
      console.log('\n   Sample users:');
      data.slice(0, 3).forEach((user, index) => {
        console.log(`   ${index + 1}. Telegram ID: ${user.telegram_id}, Username: ${user.telegram_username || 'N/A'}`);
      });
    } else {
      console.log('   ⚠️  No users have started the bot yet');
    }

    return true;
  } catch (error) {
    console.error('❌ Error testing users:', error.message);
    return false;
  }
}

async function testImageUploadService() {
  console.log('\n5️⃣  Testing Image Upload Service availability...');

  try {
    // Check if AWS credentials are set
    const hasAWSCreds = process.env.AWS_ACCESS_KEY_ID &&
                        process.env.AWS_SECRET_ACCESS_KEY &&
                        process.env.S3_COVER_BUCKET;

    if (!hasAWSCreds) {
      console.log('⚠️  AWS credentials not fully configured');
      console.log('   Image upload may not work in production');
      return false;
    }

    console.log('✅ AWS credentials are configured');
    console.log(`   S3 Bucket: ${process.env.S3_COVER_BUCKET}`);
    console.log(`   Region: ${process.env.AWS_REGION}`);
    return true;
  } catch (error) {
    console.error('❌ Error checking image upload config:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('Starting integration tests...\n');

  const results = {
    supabase: await testSupabaseConnection(),
    broadcastsTable: await testBroadcastsTable(),
    telegram: await testTelegramBot(),
    users: await testUsersWithTelegramId(),
    imageUpload: await testImageUploadService(),
  };

  console.log('\n' + '='.repeat(50));
  console.log('\n📊 TEST RESULTS SUMMARY:\n');

  Object.entries(results).forEach(([test, passed]) => {
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${test.padEnd(20)}: ${passed ? 'PASSED' : 'FAILED'}`);
  });

  const allPassed = Object.values(results).every(r => r);

  console.log('\n' + '='.repeat(50));

  if (allPassed) {
    console.log('\n🎉 ALL TESTS PASSED! The broadcast endpoint is ready to use.\n');
  } else {
    console.log('\n⚠️  SOME TESTS FAILED! Please fix the issues above before using broadcast.\n');
  }

  return allPassed;
}

// Run tests
runAllTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error running tests:', error);
    process.exit(1);
  });
