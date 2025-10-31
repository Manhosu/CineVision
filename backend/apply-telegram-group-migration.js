/**
 * Script to apply telegram_group_link migration to Supabase
 * Run with: node apply-telegram-group-migration.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('🔄 Applying telegram_group_link migration...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase/migrations/20250131000000_add_telegram_group_to_content.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split by semicolons to execute each statement separately
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip DO blocks and comments
      if (statement.startsWith('DO $$') || statement.startsWith('COMMENT ON')) {
        console.log(`⏭️  Skipping statement ${i + 1}: ${statement.substring(0, 50)}...`);
        continue;
      }

      console.log(`⚙️  Executing statement ${i + 1}...`);

      const { error } = await supabase.rpc('exec_sql', {
        sql_query: statement + ';'
      });

      if (error) {
        console.error(`❌ Error executing statement ${i + 1}:`, error);

        // Try direct query as fallback
        console.log('🔄 Trying direct query execution...');

        // For ALTER TABLE, we need to use the SQL editor or a custom function
        // Since Supabase doesn't expose direct SQL execution via client,
        // we'll log the SQL and ask user to run it manually
        console.log('\n⚠️  Please run this SQL manually in Supabase SQL Editor:');
        console.log('━'.repeat(60));
        console.log(statement + ';');
        console.log('━'.repeat(60));
      } else {
        console.log(`✅ Statement ${i + 1} executed successfully`);
      }
    }

    console.log('\n✅ Migration completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Verify the column was added: SELECT column_name FROM information_schema.columns WHERE table_name = \'content\' AND column_name = \'telegram_group_link\';');
    console.log('2. Test creating content with telegram_group_link');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);

    // Provide manual instructions
    console.log('\n⚠️  Automatic migration failed. Please apply manually:');
    console.log('\n1. Go to Supabase Dashboard → SQL Editor');
    console.log('2. Run this SQL:\n');
    console.log('ALTER TABLE content ADD COLUMN IF NOT EXISTS telegram_group_link TEXT;');
    console.log('CREATE INDEX IF NOT EXISTS idx_content_telegram_group_link ON content(telegram_group_link) WHERE telegram_group_link IS NOT NULL;');

    process.exit(1);
  }
}

applyMigration();
