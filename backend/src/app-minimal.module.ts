import { Module } from '@nestjs/common';
import { TelegramsModule } from './modules/telegrams/telegrams.module';

@Module({
  imports: [TelegramsModule],
  controllers: [],
  providers: [],
})
export class AppMinimalModule {}