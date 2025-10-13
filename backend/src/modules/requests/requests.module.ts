import { Module } from '@nestjs/common';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { RequestsSupabaseService } from './requests-supabase.service';
import { ContentRequest } from './entities/content-request.entity';
import { AuthModule } from '../auth/auth.module';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import { optionalTypeOrmFeature, isTypeOrmEnabled } from '../../config/typeorm-optional.helper';
import { SupabaseModule } from '../../config/supabase.module';

// Use Supabase service when TypeORM is disabled
const conditionalProviders = isTypeOrmEnabled()
  ? [RequestsService, OptionalAuthGuard]
  : [
      {
        provide: 'RequestsService',
        useClass: RequestsSupabaseService,
      },
      OptionalAuthGuard,
    ];

const conditionalExports = isTypeOrmEnabled() ? [RequestsService] : ['RequestsService'];

@Module({
  imports: [
    ...optionalTypeOrmFeature([ContentRequest]),
    AuthModule,
    SupabaseModule,
  ],
  controllers: [RequestsController],
  providers: conditionalProviders,
  exports: conditionalExports,
})
export class RequestsModule {}