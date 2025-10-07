import { MigrationInterface, QueryRunner } from 'typeorm';

export class DatabaseOptimizations1758761800000 implements MigrationInterface {
  name = 'DatabaseOptimizations1758761800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Adicionar colunas de auditoria onde aplicável
    await queryRunner.query(`
      ALTER TABLE "content" 
      ADD COLUMN "created_by" UUID,
      ADD COLUMN "updated_by" UUID
    `);

    await queryRunner.query(`
      ALTER TABLE "categories" 
      ADD COLUMN "created_by" UUID,
      ADD COLUMN "updated_by" UUID
    `);

    // 2. Adicionar constraints NOT NULL onde apropriado
    await queryRunner.query(`
      ALTER TABLE "content" 
      ALTER COLUMN "title" SET NOT NULL,
      ALTER COLUMN "price_cents" SET NOT NULL,
      ALTER COLUMN "type" SET NOT NULL,
      ALTER COLUMN "availability" SET NOT NULL,
      ALTER COLUMN "status" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "categories" 
      ALTER COLUMN "name" SET NOT NULL,
      ALTER COLUMN "slug" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "users" 
      ALTER COLUMN "name" SET NOT NULL,
      ALTER COLUMN "email" SET NOT NULL,
      ALTER COLUMN "role" SET NOT NULL,
      ALTER COLUMN "status" SET NOT NULL
    `);

    // 3. Adicionar índices para buscas otimizadas
    // Índice para busca por título (case-insensitive)
    await queryRunner.query(`
      CREATE INDEX "idx_content_title_search" ON "content" 
      USING gin(to_tsvector('portuguese', title))
    `);

    // Índice para busca em descrição (full-text)
    await queryRunner.query(`
      CREATE INDEX "idx_content_description_search" ON "content" 
      USING gin(to_tsvector('portuguese', COALESCE(description, '')))
    `);

    // Índice composto para filtros comuns
    await queryRunner.query(`
      CREATE INDEX "idx_content_status_type_created" ON "content" 
      (status, type, created_at DESC)
    `);

    // Índice para busca por categorias
    await queryRunner.query(`
      CREATE INDEX "idx_content_categories_content_id" ON "content_categories" 
      (content_id)
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_content_categories_category_id" ON "content_categories" 
      (category_id)
    `);

    // Índice para ordenação por popularidade
    await queryRunner.query(`
      CREATE INDEX "idx_content_popularity" ON "content" 
      (is_featured DESC, views_count DESC, purchases_count DESC)
    `);

    // 4. Índices para performance em queries comuns
    await queryRunner.query(`
      CREATE INDEX "idx_content_release_year" ON "content" 
      (release_year DESC) WHERE release_year IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_content_imdb_rating" ON "content" 
      (imdb_rating DESC) WHERE imdb_rating IS NOT NULL
    `);

    // 5. Índices para auditoria e logs
    await queryRunner.query(`
      CREATE INDEX "idx_system_logs_entity_created" ON "system_logs" 
      (entity_id, created_at DESC) WHERE entity_id IS NOT NULL
    `);

    // 6. Adicionar constraints de validação
    await queryRunner.query(`
      ALTER TABLE "content" 
      ADD CONSTRAINT "chk_content_price_positive" 
      CHECK (price_cents >= 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "content" 
      ADD CONSTRAINT "chk_content_duration_positive" 
      CHECK (duration_minutes IS NULL OR duration_minutes > 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "content" 
      ADD CONSTRAINT "chk_content_release_year_valid" 
      CHECK (release_year IS NULL OR (release_year >= 1900 AND release_year <= EXTRACT(YEAR FROM CURRENT_DATE) + 5))
    `);

    await queryRunner.query(`
      ALTER TABLE "content" 
      ADD CONSTRAINT "chk_content_imdb_rating_valid" 
      CHECK (imdb_rating IS NULL OR (imdb_rating >= 0 AND imdb_rating <= 10))
    `);

    // 7. Adicionar foreign keys para auditoria
    await queryRunner.query(`
      ALTER TABLE "content" 
      ADD CONSTRAINT "fk_content_created_by" 
      FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "content" 
      ADD CONSTRAINT "fk_content_updated_by" 
      FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "categories" 
      ADD CONSTRAINT "fk_categories_created_by" 
      FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "categories" 
      ADD CONSTRAINT "fk_categories_updated_by" 
      FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    // 8. Criar função para atualizar updated_by automaticamente
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_by_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // 9. Criar triggers para updated_at
    await queryRunner.query(`
      CREATE TRIGGER update_content_updated_at 
      BEFORE UPDATE ON "content"
      FOR EACH ROW EXECUTE FUNCTION update_updated_by_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_categories_updated_at 
      BEFORE UPDATE ON "categories"
      FOR EACH ROW EXECUTE FUNCTION update_updated_by_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remover triggers
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_content_updated_at ON "content"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_categories_updated_at ON "categories"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_by_column()`);

    // Remover constraints
    await queryRunner.query(`ALTER TABLE "content" DROP CONSTRAINT IF EXISTS "fk_content_created_by"`);
    await queryRunner.query(`ALTER TABLE "content" DROP CONSTRAINT IF EXISTS "fk_content_updated_by"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "fk_categories_created_by"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "fk_categories_updated_by"`);
    
    await queryRunner.query(`ALTER TABLE "content" DROP CONSTRAINT IF EXISTS "chk_content_price_positive"`);
    await queryRunner.query(`ALTER TABLE "content" DROP CONSTRAINT IF EXISTS "chk_content_duration_positive"`);
    await queryRunner.query(`ALTER TABLE "content" DROP CONSTRAINT IF EXISTS "chk_content_release_year_valid"`);
    await queryRunner.query(`ALTER TABLE "content" DROP CONSTRAINT IF EXISTS "chk_content_imdb_rating_valid"`);

    // Remover índices
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_content_title_search"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_content_description_search"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_content_status_type_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_content_categories_content_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_content_categories_category_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_content_popularity"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_content_release_year"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_content_imdb_rating"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_system_logs_entity_created"`);

    // Remover colunas de auditoria
    await queryRunner.query(`ALTER TABLE "content" DROP COLUMN IF EXISTS "created_by"`);
    await queryRunner.query(`ALTER TABLE "content" DROP COLUMN IF EXISTS "updated_by"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN IF EXISTS "created_by"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN IF EXISTS "updated_by"`);
  }
}