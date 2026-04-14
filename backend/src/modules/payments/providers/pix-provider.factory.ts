import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PixProvider } from './pix-provider.interface';
import { WooviService } from '../services/woovi.service';
import { NewBankService } from '../services/new-bank.service';
import { OasyfyService } from '../services/oasyfy.service';

@Injectable()
export class PixProviderFactory {
  private readonly logger = new Logger(PixProviderFactory.name);

  constructor(
    private configService: ConfigService,
    private wooviService: WooviService,
    private newBankService: NewBankService,
    private oasyfyService: OasyfyService,
  ) {
    const provider = this.configService.get('PIX_PROVIDER', 'oasyfy');
    this.logger.log(`PIX provider configured: ${provider}`);
  }

  getProvider(): PixProvider {
    const provider = this.configService.get('PIX_PROVIDER', 'oasyfy');
    switch (provider) {
      case 'oasyfy':
        return this.oasyfyService;
      case 'new_bank':
        return this.newBankService;
      case 'woovi':
        return this.wooviService;
      default:
        return this.oasyfyService;
    }
  }
}
