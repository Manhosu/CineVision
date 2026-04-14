import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { PixProvider, PixPaymentResult, PixPaymentStatus } from '../providers/pix-provider.interface';

export interface OasyfyWebhookPayload {
  event: 'TRANSACTION_CREATED' | 'TRANSACTION_PAID' | 'TRANSACTION_CANCELED' | 'TRANSACTION_REFUNDED' | 'TRANSACTION_CHARGED_BACK';
  token: string;
  offerCode?: string | null;
  client: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    cpf?: string;
    cnpj?: string | null;
  };
  transaction: {
    id: string;
    status: string;
    paymentMethod: string;
    amount: number;
    currency: string;
    createdAt: string;
    payedAt?: string | null;
    pixInformation?: any;
    orderItems?: Array<{
      id: string;
      price: number;
      product?: {
        id: string;
        name: string;
        externalId?: string;
      };
    }>;
  };
  subscription?: any;
  orderItems?: any[];
  trackProps?: any;
}

@Injectable()
export class OasyfyService implements PixProvider {
  private readonly logger = new Logger(OasyfyService.name);
  private readonly client: AxiosInstance;
  private readonly webhookToken: string;

  constructor(private configService: ConfigService) {
    const publicKey = this.configService.get<string>('OASYFY_PUBLIC_KEY') || '';
    const secretKey = this.configService.get<string>('OASYFY_SECRET_KEY') || '';
    this.webhookToken = this.configService.get<string>('OASYFY_WEBHOOK_TOKEN') || '';

    this.client = axios.create({
      baseURL: 'https://app.oasyfy.com/api/v1',
      headers: {
        'Content-Type': 'application/json',
        'x-public-key': publicKey,
        'x-secret-key': secretKey,
      },
      timeout: 30000,
    });

    this.logger.log('OasyfyService initialized');
  }

  /**
   * Create a PIX payment — implements PixProvider interface
   */
  async createPixPayment(options: {
    amount: number;
    description: string;
    email?: string;
    externalId?: string;
    metadata?: Record<string, string>;
  }): Promise<PixPaymentResult> {
    const apiUrl = this.configService.get<string>('API_URL') || 'https://cinevisionn.onrender.com';
    const callbackUrl = `${apiUrl}/api/v1/webhooks/oasyfy`;

    const amountReais = options.amount / 100;
    const identifier = options.externalId || `cv-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const payload = {
      identifier,
      amount: amountReais,
      client: {
        name: 'Cliente CineVision',
        email: options.email || 'cliente@cinevision.com',
        phone: '(00) 00000-0000',
        document: '529.982.247-25',
      },
      callbackUrl,
      metadata: {
        ...options.metadata,
        description: options.description,
      },
    };

    this.logger.log(`Creating Oasyfy PIX: ${identifier} | R$ ${amountReais.toFixed(2)}`);

    try {
      const response = await this.client.post('/gateway/pix/receive', payload);
      const data = response.data;

      this.logger.log(`Oasyfy PIX created: ${data.transactionId} | Status: ${data.status}`);

      return {
        paymentId: data.transactionId,
        status: data.status === 'OK' ? 'pending' : data.status,
        qrCode: data.pix?.code || '',
        qrCodeBase64: data.pix?.base64 || data.pix?.image || '',
        amount: options.amount,
      };
    } catch (error) {
      this.logger.error(`Error creating Oasyfy PIX: ${error.message}`);
      if (error.response?.data) {
        this.logger.error(`Oasyfy API error: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Get payment status — implements PixProvider interface
   */
  async getPaymentStatus(paymentId: string): Promise<PixPaymentStatus> {
    try {
      const response = await this.client.get(`/gateway/transactions/${paymentId}`);
      const data = response.data;

      let status: 'pending' | 'approved' | 'cancelled' | 'expired' = 'pending';
      if (data.status === 'COMPLETED' || data.status === 'OK') status = 'approved';
      else if (data.status === 'CANCELED') status = 'cancelled';
      else if (data.status === 'FAILED' || data.status === 'REJECTED') status = 'expired';

      return {
        status,
        paidAt: data.payedAt ? new Date(data.payedAt) : undefined,
      };
    } catch (error) {
      this.logger.error(`Error getting Oasyfy payment status: ${error.message}`);
      return { status: 'pending' };
    }
  }

  /**
   * Verify webhook signature — implements PixProvider interface
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    return signature === this.webhookToken;
  }

  /**
   * Verify webhook token directly
   */
  verifyWebhookToken(token: string): boolean {
    return token === this.webhookToken;
  }

  /**
   * Get provider name — implements PixProvider interface
   */
  getProviderName(): string {
    return 'oasyfy';
  }
}
