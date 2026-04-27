import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ContentEditRequestsController } from './content-edit-requests.controller';
import { ContentEditRequestsService } from './content-edit-requests.service';
import { SupabaseModule } from '../../config/supabase.module';
import { AdminModule } from '../admin/admin.module';
import { TelegramsModule } from '../telegrams/telegrams.module';

@Module({
  imports: [
    ConfigModule,
    SupabaseModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'cine-vision-secret-key',
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
    forwardRef(() => AdminModule),
    forwardRef(() => TelegramsModule),
  ],
  controllers: [ContentEditRequestsController],
  providers: [ContentEditRequestsService],
  exports: [ContentEditRequestsService],
})
export class ContentEditRequestsModule {}
