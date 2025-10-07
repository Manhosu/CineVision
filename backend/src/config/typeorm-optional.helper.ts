import { TypeOrmModule } from '@nestjs/typeorm';
import { EntityClassOrSchema } from '@nestjs/typeorm/dist/interfaces/entity-class-or-schema.type';
import { Provider } from '@nestjs/common';

/**
 * Helper function to conditionally import TypeORM features
 * Returns empty array if TypeORM is disabled
 */
export function optionalTypeOrmFeature(entities: EntityClassOrSchema[]): any[] {
  if (!isTypeOrmEnabled()) {
    console.log('TypeORM disabled - skipping entity imports:', entities.map(e => (e as any).name || e.toString()).join(', '));
    return [];
  }

  return [TypeOrmModule.forFeature(entities)];
}

/**
 * Check if TypeORM is enabled
 * FORCE DISABLED - Using Supabase REST API only
 */
export function isTypeOrmEnabled(): boolean {
  return false; // Force disabled TypeORM
}

/**
 * Helper function to conditionally provide services that depend on TypeORM
 */
export function optionalTypeOrmProviders(providers: Provider[]): Provider[] {
  if (!isTypeOrmEnabled()) {
    console.log('TypeORM disabled - skipping providers:', providers.map(p => (p as any).name || p.toString()).join(', '));
    return [];
  }

  return providers;
}