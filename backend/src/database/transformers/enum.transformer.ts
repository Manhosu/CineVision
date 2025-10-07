import { ValueTransformer, ColumnOptions } from 'typeorm';

export class EnumTransformer implements ValueTransformer {
  to(value: any): any {
    return value;
  }

  from(value: any): any {
    return value;
  }
}

// Para SQLite, sempre usar varchar
export function createEnumColumn(enumObject: any, defaultValue?: any): ColumnOptions {
  return {
    type: 'varchar',
    length: 50,
    default: defaultValue,
  } as ColumnOptions;
}

// Para SQLite, usar datetime ao invés de timestamp
export function createTimestampColumn(nullable: boolean = false): ColumnOptions {
  return {
    type: 'timestamptz',
    nullable,
  } as ColumnOptions;
}

// Para SQLite, usar text ao invés de jsonb
export function createJsonColumn(nullable: boolean = true): ColumnOptions {
  return {
    type: 'jsonb',
    nullable,
  } as ColumnOptions;
}
