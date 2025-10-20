import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProviderMetaColumn1760975000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add provider_meta column to payments table
    await queryRunner.query(`
      ALTER TABLE payments
      ADD COLUMN provider_meta JSONB;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove provider_meta column
    await queryRunner.query(`
      ALTER TABLE payments
      DROP COLUMN provider_meta;
    `);
  }
}
