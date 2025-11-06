// Executar migração da tabela series no Supabase
require('dotenv').config();
const { Client } = require('pg');

// Usar a connection string do Supabase
const connectionString = process.env.SUPABASE_DATABASE_URL;

if (!connectionString) {
  console.error('❌ SUPABASE_DATABASE_URL não encontrado no .env');
  process.exit(1);
}

console.log('\n📦 Conectando ao Supabase PostgreSQL...\n');

const client = new Client({ connectionString });

const migration = `
-- Create ENUMs if they don't exist
DO $$ BEGIN
    CREATE TYPE content_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE content_availability AS ENUM ('APP_ONLY', 'TELEGRAM_ONLY', 'BOTH');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create series table
CREATE TABLE IF NOT EXISTS series (
    id UUID PRIMARY KEY,
    title VARCHAR NOT NULL,
    description TEXT,
    synopsis TEXT,
    cover_url VARCHAR,
    poster_url VARCHAR,
    backdrop_url VARCHAR,
    banner_url VARCHAR,
    trailer_url VARCHAR,
    price_cents INTEGER NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'BRL',
    price_per_episode BOOLEAN DEFAULT FALSE,
    stripe_product_id VARCHAR,
    stripe_price_id VARCHAR,
    cover_storage_key VARCHAR,
    trailer_storage_key VARCHAR,
    weekly_sales INTEGER DEFAULT 0,
    total_sales INTEGER DEFAULT 0,
    release_year INTEGER,
    director VARCHAR,
    "cast" TEXT,
    genres TEXT,
    imdb_rating FLOAT,
    total_seasons INTEGER DEFAULT 1,
    total_episodes INTEGER DEFAULT 0,
    availability content_availability DEFAULT 'BOTH',
    status content_status DEFAULT 'DRAFT',
    is_featured BOOLEAN DEFAULT FALSE,
    views_count INTEGER DEFAULT 0,
    purchases_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by_id UUID,
    updated_by_id UUID
);

CREATE INDEX IF NOT EXISTS idx_series_status_created ON series(status, created_at);
CREATE INDEX IF NOT EXISTS idx_series_availability ON series(availability);
CREATE INDEX IF NOT EXISTS idx_series_featured ON series(is_featured) WHERE is_featured = TRUE;

CREATE TABLE IF NOT EXISTS series_categories (
    series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (series_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_series_categories_series ON series_categories(series_id);
CREATE INDEX IF NOT EXISTS idx_series_categories_category ON series_categories(category_id);

ALTER TABLE series ENABLE ROW LEVEL SECURITY;
ALTER TABLE series_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select for all users" ON series;
CREATE POLICY "Allow select for all users"
    ON series FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow all for service role" ON series;
CREATE POLICY "Allow all for service role"
    ON series FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Allow select for all users" ON series_categories;
CREATE POLICY "Allow select for all users"
    ON series_categories FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow all for service role" ON series_categories;
CREATE POLICY "Allow all for service role"
    ON series_categories FOR ALL
    USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION update_series_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_series_updated_at ON series;
CREATE TRIGGER trigger_series_updated_at
    BEFORE UPDATE ON series
    FOR EACH ROW
    EXECUTE FUNCTION update_series_updated_at();
`;

async function executeMigration() {
  try {
    await client.connect();
    console.log('✅ Conectado ao Supabase!\n');

    console.log('🔄 Executando migração...\n');
    await client.query(migration);

    console.log('✅ Migração executada com sucesso!\n');

    // Verificar se a tabela foi criada
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'series'
    `);

    if (result.rows.length > 0) {
      console.log('✅ Tabela "series" criada e confirmada!');
    } else {
      console.log('❌ Tabela "series" não foi encontrada após migração');
    }

    await client.end();

  } catch (error) {
    console.error('❌ Erro na migração:', error.message);
    console.error(error);
    await client.end();
    process.exit(1);
  }
}

executeMigration();
