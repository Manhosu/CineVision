import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInitialTables1694000000001 implements MigrationInterface {
  name = 'CreateInitialTables1694000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create ENUM types
    await queryRunner.query(`
      CREATE TYPE user_role_enum AS ENUM('user', 'admin', 'moderator');
      CREATE TYPE user_status_enum AS ENUM('active', 'inactive', 'banned', 'pending');
      CREATE TYPE content_status_enum AS ENUM('draft', 'published', 'archived');
      CREATE TYPE content_availability_enum AS ENUM('site', 'telegram', 'both');
      CREATE TYPE content_type_enum AS ENUM('movie', 'series', 'documentary');
      CREATE TYPE purchase_status_enum AS ENUM('pending', 'paid', 'failed', 'refunded');
      CREATE TYPE payment_status_enum AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded');
      CREATE TYPE payment_provider_enum AS ENUM('pix', 'credit_card', 'debit_card', 'boleto', 'telegram');
      CREATE TYPE log_level_enum AS ENUM('debug', 'info', 'warn', 'error', 'fatal');
      CREATE TYPE log_type_enum AS ENUM('auth', 'payment', 'purchase', 'content', 'user', 'telegram', 'system', 'api', 'security');
      CREATE TYPE request_status_enum AS ENUM('pending', 'in_progress', 'completed', 'rejected', 'cancelled');
      CREATE TYPE request_priority_enum AS ENUM('low', 'medium', 'high', 'urgent');
    `);

    // Users table
    await queryRunner.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        email VARCHAR UNIQUE NOT NULL,
        password VARCHAR NOT NULL,
        phone VARCHAR,
        telegram_id VARCHAR UNIQUE,
        telegram_username VARCHAR,
        telegram_chat_id VARCHAR,
        role user_role_enum NOT NULL DEFAULT 'user',
        status user_status_enum NOT NULL DEFAULT 'active',
        blocked BOOLEAN NOT NULL DEFAULT false,
        refresh_token VARCHAR,
        avatar_url VARCHAR,
        last_login TIMESTAMP,
        email_verified_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Categories table
    await queryRunner.query(`
      CREATE TABLE categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR UNIQUE NOT NULL,
        slug VARCHAR UNIQUE NOT NULL,
        description TEXT,
        image_url VARCHAR,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Content table (formerly movies)
    await queryRunner.query(`
      CREATE TABLE content (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR NOT NULL,
        description TEXT,
        synopsis TEXT,
        poster_url VARCHAR,
        banner_url VARCHAR,
        trailer_url VARCHAR,
        video_url VARCHAR,
        price_cents INTEGER NOT NULL,
        duration_minutes INTEGER,
        release_year INTEGER,
        director VARCHAR,
        cast TEXT[],
        genres TEXT[],
        imdb_rating NUMERIC,
        storage_path VARCHAR,
        type content_type_enum NOT NULL DEFAULT 'movie',
        availability content_availability_enum NOT NULL DEFAULT 'both',
        status content_status_enum NOT NULL DEFAULT 'draft',
        is_featured BOOLEAN NOT NULL DEFAULT false,
        views_count INTEGER NOT NULL DEFAULT 0,
        purchases_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Purchases table
    await queryRunner.query(`
      CREATE TABLE purchases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        content_id UUID NOT NULL REFERENCES content(id),
        payment_provider_id VARCHAR,
        amount_cents INTEGER NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
        status purchase_status_enum NOT NULL DEFAULT 'pending',
        provider_meta JSONB,
        telegram_message_id VARCHAR,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Payments table
    await queryRunner.query(`
      CREATE TABLE payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        purchase_id UUID NOT NULL REFERENCES purchases(id),
        provider payment_provider_enum NOT NULL,
        provider_payment_id VARCHAR,
        status payment_status_enum NOT NULL DEFAULT 'pending',
        webhook_payload JSONB,
        failure_reason TEXT,
        processed_at TIMESTAMP,
        expires_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Refresh tokens table
    await queryRunner.query(`
      CREATE TABLE refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(500) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        expires_at TIMESTAMP NOT NULL,
        device_info VARCHAR,
        ip_address VARCHAR,
        user_agent VARCHAR,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // System logs table
    await queryRunner.query(`
      CREATE TABLE system_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type log_type_enum NOT NULL,
        level log_level_enum NOT NULL DEFAULT 'info',
        entity_id VARCHAR,
        message VARCHAR NOT NULL,
        meta JSONB,
        user_id VARCHAR,
        ip_address VARCHAR,
        user_agent VARCHAR,
        session_id VARCHAR,
        request_id VARCHAR,
        stack_trace TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Content requests table
    await queryRunner.query(`
      CREATE TABLE content_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        requested_title VARCHAR NOT NULL,
        description TEXT,
        imdb_url VARCHAR,
        year INTEGER,
        status request_status_enum NOT NULL DEFAULT 'pending',
        priority request_priority_enum NOT NULL DEFAULT 'medium',
        notification_sent BOOLEAN NOT NULL DEFAULT false,
        admin_notes TEXT,
        telegram_chat_id VARCHAR,
        telegram_message_id VARCHAR,
        vote_count INTEGER NOT NULL DEFAULT 1,
        completed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Content categories junction table
    await queryRunner.query(`
      CREATE TABLE content_categories (
        content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
        category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        PRIMARY KEY (content_id, category_id)
      );
    `);

    // Create indexes for performance
    await queryRunner.query(`
      CREATE INDEX idx_users_email ON users(email);
      CREATE INDEX idx_users_telegram_id ON users(telegram_id) WHERE telegram_id IS NOT NULL;
      CREATE INDEX idx_users_role_status ON users(role, status);

      CREATE INDEX idx_content_status_type ON content(status, type);
      CREATE INDEX idx_content_availability ON content(availability);
      CREATE INDEX idx_content_featured ON content(is_featured) WHERE is_featured = true;
      CREATE INDEX idx_content_created_at ON content(created_at);

      CREATE INDEX idx_purchases_user_id ON purchases(user_id);
      CREATE INDEX idx_purchases_content_id ON purchases(content_id);
      CREATE INDEX idx_purchases_status ON purchases(status);
      CREATE INDEX idx_purchases_created_at ON purchases(created_at);

      CREATE INDEX idx_payments_purchase_id ON payments(purchase_id);
      CREATE INDEX idx_payments_provider ON payments(provider);
      CREATE INDEX idx_payments_status ON payments(status);

      CREATE UNIQUE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
      CREATE INDEX idx_refresh_tokens_user_active ON refresh_tokens(user_id, is_active);
      CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);

      CREATE INDEX idx_system_logs_type_created ON system_logs(type, created_at);
      CREATE INDEX idx_system_logs_level_created ON system_logs(level, created_at);
      CREATE INDEX idx_system_logs_entity_type ON system_logs(entity_id, type);

      CREATE INDEX idx_content_requests_status_priority ON content_requests(status, priority, created_at);
      CREATE INDEX idx_content_requests_user_created ON content_requests(user_id, created_at);

      CREATE INDEX idx_categories_active_sort ON categories(is_active, sort_order);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse dependency order
    await queryRunner.query(`DROP TABLE IF EXISTS content_categories CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS content_requests CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS system_logs CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS refresh_tokens CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS payments CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS purchases CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS content CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS categories CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS users CASCADE;`);

    // Drop ENUM types
    await queryRunner.query(`
      DROP TYPE IF EXISTS request_priority_enum;
      DROP TYPE IF EXISTS request_status_enum;
      DROP TYPE IF EXISTS log_type_enum;
      DROP TYPE IF EXISTS log_level_enum;
      DROP TYPE IF EXISTS payment_provider_enum;
      DROP TYPE IF EXISTS payment_status_enum;
      DROP TYPE IF EXISTS purchase_status_enum;
      DROP TYPE IF EXISTS content_type_enum;
      DROP TYPE IF EXISTS content_availability_enum;
      DROP TYPE IF EXISTS content_status_enum;
      DROP TYPE IF EXISTS user_status_enum;
      DROP TYPE IF EXISTS user_role_enum;
    `);
  }
}