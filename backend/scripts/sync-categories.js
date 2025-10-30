const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const GENRES = [
  'Ação',
  'Aventura',
  'Animação',
  'Comédia',
  'Crime',
  'Documentário',
  'Drama',
  'Fantasia',
  'Ficção Científica',
  'Guerra',
  'História',
  'Horror',
  'Musical',
  'Mistério',
  'Romance',
  'Suspense',
  'Terror',
  'Thriller',
  'Western',
  'Séries',
];

function generateSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

async function syncCategories() {
  console.log('🚀 Starting category sync...\n');

  const created = [];
  const skipped = [];

  for (const genreName of GENRES) {
    const slug = generateSlug(genreName);

    // Check if exists
    const { data: existing } = await supabase
      .from('categories')
      .select('id, name')
      .eq('slug', slug)
      .single();

    if (existing) {
      skipped.push(genreName);
      console.log(`⏭️  ${genreName} (already exists)`);
      continue;
    }

    // Create category
    const { data, error } = await supabase
      .from('categories')
      .insert({
        name: genreName,
        slug: slug,
        description: `Filmes e séries de ${genreName}`,
      })
      .select()
      .single();

    if (error) {
      console.error(`❌ Error creating ${genreName}:`, error.message);
    } else {
      created.push(genreName);
      console.log(`✅ ${genreName}`);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Created: ${created.length}`);
  console.log(`   ⏭️  Skipped: ${skipped.length}`);
  console.log(`   📦 Total: ${GENRES.length}`);
}

async function populateContentCategories() {
  console.log('\n\n🔗 Populating content-category associations...\n');

  // Get all content
  const { data: allContent, error: contentError } = await supabase
    .from('content')
    .select('id, title, content_type, genres');

  if (contentError) {
    console.error('❌ Error fetching content:', contentError.message);
    return;
  }

  if (!allContent || allContent.length === 0) {
    console.log('⚠️  No content found');
    return;
  }

  console.log(`📚 Found ${allContent.length} content items\n`);

  let populated = 0;
  let skipped = 0;

  for (const content of allContent) {
    // Clear existing associations
    await supabase
      .from('content_categories')
      .delete()
      .eq('content_id', content.id);

    const categoriesToAssociate = [];

    // Add genres
    if (content.genres && Array.isArray(content.genres) && content.genres.length > 0) {
      categoriesToAssociate.push(...content.genres);
    }

    // Add "Séries" for all series
    if (content.content_type === 'series') {
      categoriesToAssociate.push('Séries');
    }

    if (categoriesToAssociate.length === 0) {
      skipped++;
      console.log(`⏭️  ${content.title} (no genres)`);
      continue;
    }

    // Find matching categories
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name')
      .in('name', categoriesToAssociate);

    if (!categories || categories.length === 0) {
      skipped++;
      console.log(`⚠️  ${content.title} (no matching categories)`);
      continue;
    }

    // Create associations
    const associations = categories.map(cat => ({
      content_id: content.id,
      category_id: cat.id,
    }));

    const { error: insertError } = await supabase
      .from('content_categories')
      .insert(associations);

    if (insertError) {
      console.error(`❌ ${content.title}:`, insertError.message);
    } else {
      populated++;
      const categoryNames = categories.map(c => c.name).join(', ');
      console.log(`✅ ${content.title} → [${categoryNames}]`);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Populated: ${populated}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   📦 Total: ${allContent.length}`);
}

async function main() {
  try {
    await syncCategories();
    await populateContentCategories();
    console.log('\n\n🎉 Done!');
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
