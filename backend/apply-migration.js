/* eslint-disable */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const url = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('Missing SUPABASE_DATABASE_URL in .env');
  process.exit(1);
}

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: node apply-migration.js <migration_filename>');
  process.exit(1);
}

const fullPath = path.join(__dirname, 'src', 'database', 'migrations', migrationFile);

if (!fs.existsSync(fullPath)) {
  console.error('Migration not found:', fullPath);
  process.exit(1);
}

const sql = fs.readFileSync(fullPath, 'utf8');

(async () => {
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  console.log(`Connecting to ${url.split('@')[1]?.split('/')[0]}...`);
  try {
    await client.connect();
    console.log('Connected. Applying', migrationFile);
    await client.query(sql);
    console.log('Migration applied successfully.');
  } catch (err) {
    console.error('Migration error:', err.message);
    if (err.detail) console.error('Detail:', err.detail);
    process.exit(2);
  } finally {
    await client.end();
  }
})();
