import { Module } from '@nestjs/common';
import { SupabaseTestController } from './controllers/supabase-test.controller';
import { SupabaseAuthController } from './controllers/supabase-auth.controller';
import { SupabaseModule } from '../../config/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [SupabaseTestController, SupabaseAuthController],
})
export class SupabaseTestModule {}