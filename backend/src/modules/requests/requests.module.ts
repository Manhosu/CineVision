import { Module } from '@nestjs/common';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { ContentRequest } from './entities/content-request.entity';
import { AuthModule } from '../auth/auth.module';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import { optionalTypeOrmFeature, isTypeOrmEnabled } from '../../config/typeorm-optional.helper';

// Requests module disabled - requires TypeORM (not implemented for Supabase yet)
const conditionalControllers = isTypeOrmEnabled() ? [RequestsController] : [];
const conditionalProviders = isTypeOrmEnabled() ? [RequestsService, OptionalAuthGuard] : [OptionalAuthGuard];
const conditionalExports = isTypeOrmEnabled() ? [RequestsService] : [];

@Module({
  imports: [
    ...optionalTypeOrmFeature([ContentRequest]),
    AuthModule,
  ],
  controllers: conditionalControllers,
  providers: conditionalProviders,
  exports: conditionalExports,
})
export class RequestsModule {}