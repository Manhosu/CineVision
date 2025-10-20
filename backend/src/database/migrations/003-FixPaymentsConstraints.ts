import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixPaymentsConstraints1760983000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Fix 1: Change payments.movie_id foreign key to point to content instead of movies
    await queryRunner.query(`
      ALTER TABLE payments
      DROP CONSTRAINT IF EXISTS payments_movie_id_fkey;
    `);

    await queryRunner.query(`
      ALTER TABLE payments
      ADD CONSTRAINT payments_movie_id_fkey
      FOREIGN KEY (movie_id)
      REFERENCES content(id)
      ON DELETE CASCADE;
    `);

    // Fix 2: Remove user_id foreign key constraint to allow guest purchases
    await queryRunner.query(`
      ALTER TABLE payments
      DROP CONSTRAINT IF EXISTS payments_user_id_fkey;
    `);

    // Fix 3: Make user_id and movie_id nullable to support guest purchases
    await queryRunner.query(`
      ALTER TABLE payments
      ALTER COLUMN user_id DROP NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE payments
      ALTER COLUMN movie_id DROP NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback: Restore original constraints
    await queryRunner.query(`
      ALTER TABLE payments
      ALTER COLUMN movie_id SET NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE payments
      ALTER COLUMN user_id SET NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE payments
      ADD CONSTRAINT payments_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES users(id)
      ON DELETE CASCADE;
    `);

    await queryRunner.query(`
      ALTER TABLE payments
      DROP CONSTRAINT IF EXISTS payments_movie_id_fkey;
    `);

    await queryRunner.query(`
      ALTER TABLE payments
      ADD CONSTRAINT payments_movie_id_fkey
      FOREIGN KEY (movie_id)
      REFERENCES movies(id)
      ON DELETE CASCADE;
    `);
  }
}
