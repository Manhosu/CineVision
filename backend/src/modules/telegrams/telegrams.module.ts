import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegramsService } from './telegrams.service';
import { BotNotificationService } from './services/bot-notification.service';
import { TelegramsController } from './telegrams.controller';
import { SimpleTestController } from './simple-test.controller';
import { User } from '../users/entities/user.entity';
import { SystemLog } from '../logs/entities/system-log.entity';
import { CDNService } from '../cdn/services/cdn.service';
import { Content } from '../content/entities/content.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { optionalTypeOrmFeature, isTypeOrmEnabled } from '../../config/typeorm-optional.helper';

const conditionalControllers = isTypeOrmEnabled() ? [TelegramsController, SimpleTestController] : [];
const conditionalProviders = isTypeOrmEnabled() ? [TelegramsService, BotNotificationService, CDNService] : [];
const conditionalExports = isTypeOrmEnabled() ? [TelegramsService, BotNotificationService] : [];

@Module({
  imports: [
    ...optionalTypeOrmFeature([User, SystemLog, Content, Purchase]),
    ConfigModule,
  ],
  providers: conditionalProviders,
  controllers: conditionalControllers,
  exports: conditionalExports,
})
export class TelegramsModule {}