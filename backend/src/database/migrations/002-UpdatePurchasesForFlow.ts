import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdatePurchasesForFlow1735150000002 implements MigrationInterface {
  name = 'UpdatePurchasesForFlow1735150000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create new enum for delivery types
    await queryRunner.query(`
      CREATE TYPE purchase_delivery_type_enum AS ENUM('site', 'telegram');
    `);

    // Add new columns to purchases table
    await queryRunner.query(`
      ALTER TABLE purchases
      ADD COLUMN purchase_token UUID UNIQUE,
      ADD COLUMN preferred_delivery purchase_delivery_type_enum NOT NULL DEFAULT 'site',
      ADD COLUMN access_token VARCHAR,
      ADD COLUMN access_expires_at TIMESTAMP;
    `);

    // Create index on purchase_token for faster lookups
    await queryRunner.query(`
      CREATE INDEX idx_purchases_purchase_token ON purchases(purchase_token);
    `);

    // Create index on access_expires_at for cleanup queries
    await queryRunner.query(`
      CREATE INDEX idx_purchases_access_expires_at ON purchases(access_expires_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_purchases_access_expires_at;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_purchases_purchase_token;`);

    // Remove added columns
    await queryRunner.query(`
      ALTER TABLE purchases
      DROP COLUMN IF EXISTS access_expires_at,
      DROP COLUMN IF EXISTS access_token,
      DROP COLUMN IF EXISTS preferred_delivery,
      DROP COLUMN IF EXISTS purchase_token;
    `);

    // Drop enum type
    await queryRunner.query(`DROP TYPE IF EXISTS purchase_delivery_type_enum;`);
  }
}