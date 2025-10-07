import { Module, Global, OnModuleInit, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueService } from './services/queue.service';
import { QueueController } from './queue.controller';
import { ContentModule } from '../content/content.module';
import { isTypeOrmEnabled } from '../../config/typeorm-optional.helper';

const conditionalProviders = isTypeOrmEnabled() ? [QueueService] : [];
const conditionalControllers = isTypeOrmEnabled() ? [QueueController] : [];
const conditionalExports = isTypeOrmEnabled() ? [QueueService] : [];

@Global()
@Module({
  imports: [
    ConfigModule,
    forwardRef(() => ContentModule),
  ],
  providers: conditionalProviders,
  controllers: conditionalControllers,
  exports: conditionalExports,
})
export class QueueModule implements OnModuleInit {
  constructor(private queueService?: QueueService) {}

  async onModuleInit() {
    // Setup event listeners after module initialization only if TypeORM is enabled
    if (this.queueService) {
      this.queueService.setupEventListeners();
    }
  }
}