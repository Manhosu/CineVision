const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://szghyvnbmjlquznxhqum.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0OTk5OSwiZXhwIjoyMDc0MzI1OTk5fQ.p9_G_CjLg8h2CVZqteKLdK9WUFKFdXSqTuTolHFiWGc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixVideoUrls() {
  console.log('🔄 Fixing video URLs to use direct S3 access...\n');

  // Get A Hora do Mal videos only (the ones that exist in S3)
  const { data: contentLanguages, error } = await supabase
    .from('content_languages')
    .select(`
      id,
      content_id,
      language_code,
      language_type,
      video_url,
      content:content_id (
        id,
        title
      )
    `)
    .eq('content.title', 'A Hora do Mal')
    .not('video_url', 'is', null);

  if (error) {
    console.error('❌ Error fetching content languages:', error);
    return;
  }

  console.log(`📊 Found ${contentLanguages.length} A Hora do Mal videos\n`);

  for (const cl of contentLanguages) {
    const oldUrl = cl.video_url;

    // Skip if no URL or no content
    if (!oldUrl || !cl.content) {
      console.log(`⚠️  Skipping entry with null URL or content`);
      continue;
    }

    // S3 bucket and region
    const bucket = 'cinevision-video';
    const region = 'us-east-2';

    // Extract the path
    let path = '';
    if (oldUrl.includes('cloudfront.net')) {
      // Extract from CloudFront URL
      const match = oldUrl.match(/cloudfront\.net\/(.+)$/);
      if (match) {
        path = match[1];
      }
    } else if (oldUrl.includes('amazonaws.com')) {
      // Extract from S3 URL
      const match = oldUrl.match(/amazonaws\.com\/(.+)$/);
      if (match) {
        path = decodeURIComponent(match[1]);
      }
    }

    if (!path) {
      console.log(`⚠️  ${cl.content.title} (${cl.language_type}) - Could not extract path`);
      continue;
    }

    // Create direct S3 URL (not encoded)
    const newUrl = `https://${bucket}.s3.${region}.amazonaws.com/${path}`;

    console.log(`📝 ${cl.content.title} (${cl.language_type})`);
    console.log(`   Old: ${oldUrl}`);
    console.log(`   New: ${newUrl}\n`);

    // Update in database
    const { error: updateError } = await supabase
      .from('content_languages')
      .update({ video_url: newUrl })
      .eq('id', cl.id);

    if (updateError) {
      console.error(`❌ Update failed:`, updateError);
    } else {
      console.log(`✅ Updated successfully\n`);
    }
  }

  // Remove Lilo & Stitch entries since videos don't exist
  console.log('\n🗑️  Removing Lilo & Stitch video URLs (videos not in S3)...');
  const { error: deleteError } = await supabase
    .from('content_languages')
    .update({ video_url: null })
    .eq('content.title', 'Lilo & Stitch');

  if (deleteError) {
    console.error('❌ Error removing Lilo & Stitch URLs:', deleteError);
  } else {
    console.log('✅ Lilo & Stitch URLs removed (will need to upload videos later)\n');
  }

  console.log('✅ Video URL fixes completed!');
}

fixVideoUrls().catch(console.error);
