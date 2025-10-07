import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateContentLanguageTable1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'content_languages',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'content_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'language_type',
            type: 'enum',
            enum: ['original', 'dubbed', 'subtitled'],
            default: "'original'",
          },
          {
            name: 'language_code',
            type: 'enum',
            enum: ['pt-BR', 'en-US', 'es-ES', 'fr-FR', 'it-IT', 'de-DE', 'ja-JP', 'ko-KR', 'zh-CN'],
            default: "'pt-BR'",
          },
          {
            name: 'language_name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'video_url',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'video_storage_key',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'hls_master_url',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'hls_base_path',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'file_size_bytes',
            type: 'bigint',
            isNullable: true,
          },
          {
            name: 'duration_minutes',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'video_codec',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'audio_codec',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'bitrate_kbps',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'width',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'height',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'frame_rate',
            type: 'decimal',
            precision: 3,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'available_qualities',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'is_default',
            type: 'boolean',
            default: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Criar índices
    await queryRunner.createIndex(
      'content_languages',
      new TableIndex({
        name: 'idx_content_language_content_id',
        columnNames: ['content_id'],
      }),
    );

    await queryRunner.createIndex(
      'content_languages',
      new TableIndex({
        name: 'idx_content_language_type_code',
        columnNames: ['language_type', 'language_code'],
      }),
    );

    await queryRunner.createIndex(
      'content_languages',
      new TableIndex({
        name: 'idx_content_language_unique',
        columnNames: ['content_id', 'language_type', 'language_code'],
        isUnique: true,
      }),
    );

    // Criar foreign key
    await queryRunner.createForeignKey(
      'content_languages',
      new TableForeignKey({
        columnNames: ['content_id'],
        referencedTableName: 'contents',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('content_languages');
  }
}