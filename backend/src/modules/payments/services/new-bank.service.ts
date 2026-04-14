import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PixProvider, PixPaymentResult, PixPaymentStatus } from '../providers/pix-provider.interface';

@Injectable()
export class NewBankService implements PixProvider {
  private readonly logger = new Logger(NewBankService.name);

  constructor(private configService: ConfigService) {
    this.logger.log('NewBankService initialized (stub - not yet configured)');
  }

  async createPixPayment(options: {
    amount: number;
    description: string;
    email?: string;
    externalId?: string;
    metadata?: Record<string, string>;
  }): Promise<PixPaymentResult> {
    // TODO: Implement when new bank API is available
    throw new Error('New bank provider not yet configured');
  }

  async getPaymentStatus(paymentId: string): Promise<PixPaymentStatus> {
    // TODO: Implement when new bank API is available
    throw new Error('New bank provider not yet configured');
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    // TODO: Implement when new bank API is available
    return false;
  }

  getProviderName(): string {
    return 'new_bank';
  }
}
