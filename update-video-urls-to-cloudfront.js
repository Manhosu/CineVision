const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://szghyvnbmjlquznxhqum.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0OTk5OSwiZXhwIjoyMDc0MzI1OTk5fQ.p9_G_CjLg8h2CVZqteKLdK9WUFKFdXSqTuTolHFiWGc';

const supabase = createClient(supabaseUrl, supabaseKey);
const CLOUDFRONT_DOMAIN = 'dcscincghoovk.cloudfront.net';

async function updateVideoUrls() {
  console.log('🔄 Starting video URL updates to CloudFront...\n');

  // Get all content languages with video URLs
  const { data: contentLanguages, error } = await supabase
    .from('content_languages')
    .select(`
      id,
      content_id,
      language_code,
      language_type,
      video_url,
      content:content_id (
        title
      )
    `)
    .not('video_url', 'is', null);

  if (error) {
    console.error('❌ Error fetching content languages:', error);
    return;
  }

  console.log(`📊 Found ${contentLanguages.length} video URLs to update\n`);

  for (const cl of contentLanguages) {
    const oldUrl = cl.video_url;
    let newUrl = oldUrl;

    // Skip if already using CloudFront
    if (oldUrl.includes('cloudfront.net')) {
      console.log(`✅ ${cl.content.title} (${cl.language_type}) - Already using CloudFront`);
      continue;
    }

    // Extract the path from S3 URL
    let path = '';

    // Handle cinevision-video bucket (with encoded paths)
    if (oldUrl.includes('cinevision-video.s3.us-east-2.amazonaws.com')) {
      const match = oldUrl.match(/amazonaws\.com\/(.+)$/);
      if (match) {
        // Decode the URL-encoded path
        path = decodeURIComponent(match[1]);
      }
    }
    // Handle cinevision-filmes bucket
    else if (oldUrl.includes('cinevision-filmes.s3.us-east-1.amazonaws.com')) {
      const match = oldUrl.match(/amazonaws\.com\/(.+)$/);
      if (match) {
        path = match[1];
      }
    }

    if (!path) {
      console.log(`⚠️  ${cl.content.title} (${cl.language_type}) - Could not extract path from URL`);
      continue;
    }

    // Create CloudFront URL
    newUrl = `https://${CLOUDFRONT_DOMAIN}/${path}`;

    // Update in database
    const { error: updateError } = await supabase
      .from('content_languages')
      .update({ video_url: newUrl })
      .eq('id', cl.id);

    if (updateError) {
      console.error(`❌ ${cl.content.title} (${cl.language_type}) - Update failed:`, updateError);
    } else {
      console.log(`✅ ${cl.content.title} (${cl.language_type})`);
      console.log(`   Old: ${oldUrl}`);
      console.log(`   New: ${newUrl}\n`);
    }
  }

  console.log('✅ Video URL updates completed!');
}

updateVideoUrls().catch(console.error);
