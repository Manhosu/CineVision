import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsReleaseToContent1762000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add is_release column to content table (default FALSE)
    await queryRunner.query(`
      ALTER TABLE content
      ADD COLUMN is_release BOOLEAN DEFAULT FALSE;
    `);

    // Create index for better query performance on releases
    await queryRunner.query(`
      CREATE INDEX idx_content_is_release
      ON content(is_release)
      WHERE is_release = TRUE AND status = 'PUBLISHED';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_content_is_release;
    `);

    // Remove is_release column
    await queryRunner.query(`
      ALTER TABLE content
      DROP COLUMN is_release;
    `);
  }
}
