// Check if video_uploads table exists and its schema
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTable() {
  console.log('\n🔍 Checking video_uploads table...\n');

  // Try to query the table
  const { data, error } = await supabase
    .from('video_uploads')
    .select('*')
    .limit(1);

  if (error) {
    console.log('❌ Table query failed:');
    console.log(error);
    console.log('\n⚠️  The video_uploads table likely does not exist!');
    console.log('\n📋 This table is required for episode uploads.');
    console.log('    It should have been created but appears to be missing.');
  } else {
    console.log('✅ Table exists! Sample data:');
    console.log(data);

    // Try to get table info using PostgreSQL information schema
    const { data: columns, error: colError } = await supabase
      .rpc('get_table_columns', { table_name: 'video_uploads' })
      .catch(() => null);

    console.log('\n📊 Checking if we can insert test data...');

    // Try a test insert to see what columns are expected
    const testData = {
      key: 'test/key',
      upload_id: 'test_upload_id',
      filename: 'test.mp4',
      size: 1000,
      status: 'uploading',
      parts_count: 1,
      audio_type: 'original',
    };

    const { data: insertData, error: insertError } = await supabase
      .from('video_uploads')
      .insert(testData)
      .select()
      .single();

    if (insertError) {
      console.log('\n❌ Test insert failed:');
      console.log(insertError);
      console.log('\n📋 This is the error that would occur during upload initialization!');
    } else {
      console.log('\n✅ Test insert succeeded:');
      console.log(insertData);

      // Clean up test data
      await supabase
        .from('video_uploads')
        .delete()
        .eq('id', insertData.id);
      console.log('\n🧹 Test data cleaned up');
    }
  }
}

checkTable().catch(console.error);
