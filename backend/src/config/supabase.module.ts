import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseRestClient } from './supabase-rest-client';
import { SupabaseService } from './supabase.service';

@Module({
  imports: [ConfigModule],
  providers: [SupabaseRestClient, SupabaseService],
  exports: [SupabaseRestClient, SupabaseService],
})
export class SupabaseModule {}