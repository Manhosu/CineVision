import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { DatabaseConnection } from './database-connection';

// Database configuration - PostgreSQL via Supabase ONLY
export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  url: process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: process.env.NODE_ENV === 'development' && process.env.DATABASE_SYNCHRONIZE === 'true',
  logging: process.env.DATABASE_LOGGING === 'true',
  ssl: { rejectUnauthorized: false },
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  migrationsRun: false,
  migrationsTableName: 'typeorm_migrations',
  
  // Configurações robustas de conexão
  extra: {
    max: 20, // máximo de conexões no pool
    min: 2,  // mínimo de conexões mantidas
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    query_timeout: 30000,
    statement_timeout: 30000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  },
  
  // Configurações de retry
  retryAttempts: 5,
  retryDelay: 2000,
};

// Separate DataSource for CLI operations (migrations)
export const dataSourceConfig: DataSourceOptions = {
  type: 'postgres',
  url: process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  logging: false,
  ssl: { rejectUnauthorized: false },
};

export default new DataSource(dataSourceConfig);