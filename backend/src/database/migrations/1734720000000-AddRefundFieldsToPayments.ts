import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddRefundFieldsToPayments1734720000000 implements MigrationInterface {
  name = 'AddRefundFieldsToPayments1734720000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('payments', [
      new TableColumn({
        name: 'refund_id',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'refund_amount',
        type: 'integer',
        isNullable: true,
      }),
      new TableColumn({
        name: 'refund_reason',
        type: 'text',
        isNullable: true,
      }),
      new TableColumn({
        name: 'refunded_at',
        type: 'timestamp',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('payments', [
      'refund_id',
      'refund_amount', 
      'refund_reason',
      'refunded_at',
    ]);
  }
}