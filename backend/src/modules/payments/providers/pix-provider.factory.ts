import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PixProvider } from './pix-provider.interface';
import { WooviService } from '../services/woovi.service';
import { NewBankService } from '../services/new-bank.service';

@Injectable()
export class PixProviderFactory {
  private readonly logger = new Logger(PixProviderFactory.name);

  constructor(
    private configService: ConfigService,
    private wooviService: WooviService,
    private newBankService: NewBankService,
  ) {
    const provider = this.configService.get('PIX_PROVIDER', 'woovi');
    this.logger.log(`PIX provider configured: ${provider}`);
  }

  getProvider(): PixProvider {
    const provider = this.configService.get('PIX_PROVIDER', 'woovi');
    switch (provider) {
      case 'new_bank':
        return this.newBankService;
      case 'woovi':
      default:
        return this.wooviService;
    }
  }
}
