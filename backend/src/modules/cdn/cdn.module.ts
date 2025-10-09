import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CDNService } from './services/cdn.service';
import { CloudFrontSignerService } from './services/cloudfront-signer.service';
import { Content } from '../content/entities/content.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { optionalTypeOrmFeature, isTypeOrmEnabled } from '../../config/typeorm-optional.helper';

const conditionalProviders = isTypeOrmEnabled()
  ? [CDNService, CloudFrontSignerService]
  : [
      {
        provide: CDNService,
        useValue: undefined,
      },
      {
        provide: CloudFrontSignerService,
        useValue: undefined,
      },
    ];
const conditionalExports = isTypeOrmEnabled() ? [CDNService, CloudFrontSignerService] : [CDNService, CloudFrontSignerService];

@Module({
  imports: [
    ...optionalTypeOrmFeature([Content, Purchase]),
    ConfigModule,
  ],
  providers: conditionalProviders,
  exports: conditionalExports,
})
export class CDNModule {}