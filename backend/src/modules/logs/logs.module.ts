import { Module } from '@nestjs/common';
import { SystemLog } from './entities/system-log.entity';
import { LogsService } from './logs.service';
import { LogsController } from './logs.controller';
import { optionalTypeOrmFeature, isTypeOrmEnabled } from '../../config/typeorm-optional.helper';

const conditionalControllers = isTypeOrmEnabled() ? [LogsController] : [];
const conditionalProviders = isTypeOrmEnabled() ? [LogsService] : [];
const conditionalExports = isTypeOrmEnabled() ? [LogsService] : [];

@Module({
  imports: [
    ...optionalTypeOrmFeature([SystemLog]),
  ],
  controllers: conditionalControllers,
  providers: conditionalProviders,
  exports: conditionalExports,
})
export class LogsModule {}