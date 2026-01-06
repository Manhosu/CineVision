import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

export interface CreatePixPaymentDto {
  amount: number; // in cents
  description: string;
  email?: string;
  metadata?: Record<string, string>;
}

export interface PixPaymentResult {
  paymentId: string;      // correlationID
  status: string;         // ACTIVE, COMPLETED
  qrCode: string;         // brCode (copia e cola)
  qrCodeBase64: string;   // imagem do QR Code
  expiresAt: Date;
  amount: number;
}

interface WooviCharge {
  status: string;
  value: number;
  identifier: string;
  correlationID: string;
  brCode: string;
  paymentLinkUrl?: string;
  qrCodeImage?: string;
  expiresDate?: string;
  createdAt: string;
  updatedAt: string;
  expiresIn?: number;
  transactionID?: string;
  paymentMethods?: {
    pix: {
      method: string;
      txid: string;
      qrCode: string;
      qrCodeImage: string;
    };
  };
}

interface WooviChargeResponse {
  charge?: WooviCharge;
  correlationID?: string;
  brCode?: string;
}

@Injectable()
export class WooviService {
  private readonly logger = new Logger(WooviService.name);
  private axiosInstance: AxiosInstance | null = null;

  private readonly appId: string | null;
  private readonly isSandbox: boolean;
  private readonly baseUrl: string;
  private readonly webhookSecret: string | null;

  constructor(private configService: ConfigService) {
    this.appId = this.configService.get('WOOVI_APP_ID');
    this.isSandbox = this.configService.get('WOOVI_SANDBOX') === 'true';
    this.webhookSecret = this.configService.get('WOOVI_WEBHOOK_SECRET');

    // Define base URL based on environment
    this.baseUrl = this.isSandbox
      ? 'https://api.woovi-sandbox.com'
      : 'https://api.woovi.com';

    if (!this.appId) {
      this.logger.error('WOOVI_APP_ID not configured!');
      this.logger.error('Payments will not work until configured!');
      this.logger.error('Get your credentials at: https://app.woovi.com/home/applications/tab/list');
      return;
    }

    this.initializeAxios();

    const envType = this.isSandbox ? 'SANDBOX' : 'PRODUCTION';
    this.logger.log(`Woovi service initialized`);
    this.logger.log(`Environment: ${envType}`);
    this.logger.log(`Base URL: ${this.baseUrl}`);

    // Validate credentials on startup
    this.validateCredentialsOnStartup();
  }

  /**
   * Initialize Axios instance
   */
  private initializeAxios(): void {
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Authorization': this.appId,
        'Content-Type': 'application/json',
      },
    });

    this.logger.log('Axios configured for Woovi API');
  }

  /**
   * Validate credentials on startup
   */
  private async validateCredentialsOnStartup(): Promise<void> {
    try {
      this.logger.log('Validating Woovi credentials...');

      // Try to list charges (will fail if credentials invalid)
      const response = await this.axiosInstance?.get('/api/v1/charge');

      if (response?.status === 200) {
        this.logger.log('Woovi credentials validated successfully!');
      }
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        this.logger.error(`Credential validation failed: ${error.message}`);
        this.logger.error('Check your WOOVI_APP_ID');
      } else {
        // Other errors may be acceptable (rate limit, etc)
        this.logger.log('Woovi connection test completed');
      }
    }
  }

  /**
   * Generate unique correlationID for PIX charge
   * Woovi uses correlationID as unique identifier
   */
  private generateCorrelationId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(8).toString('hex');
    return `CV${timestamp}${random}`;
  }

  /**
   * Create a PIX payment with QR Code
   * Returns the payment ID, QR code data, and QR code image in base64
   */
  async createPixPayment(dto: CreatePixPaymentDto): Promise<PixPaymentResult> {
    if (!this.axiosInstance) {
      const errorMsg = 'Woovi is not configured! Set environment variables.';
      this.logger.error(errorMsg);
      throw new BadRequestException(errorMsg);
    }

    try {
      const correlationID = this.generateCorrelationId();

      this.logger.log(`Creating PIX payment - correlationID: ${correlationID}, amount: ${dto.amount} cents`);

      // Create PIX charge
      // Woovi expects value in cents
      const chargeResponse = await this.axiosInstance.post<WooviChargeResponse>(
        '/api/v1/charge',
        {
          correlationID,
          value: dto.amount,
          comment: dto.description,
          customer: dto.email ? {
            email: dto.email,
          } : undefined,
          expiresIn: 3600, // 1 hour expiration in seconds
          additionalInfo: dto.metadata ? Object.entries(dto.metadata).map(([key, value]) => ({
            key,
            value,
          })) : undefined,
        }
      );

      const responseData = chargeResponse.data as WooviChargeResponse & WooviCharge;
      const charge: WooviCharge = responseData.charge || responseData as WooviCharge;
      const brCode = responseData.brCode || charge.brCode;

      this.logger.log(`PIX charge created: ${charge.correlationID}`);

      // Calculate expiration
      const expiresAt = charge.expiresDate
        ? new Date(charge.expiresDate)
        : new Date(Date.now() + 3600 * 1000);

      // Extract QR code image (Woovi returns as base64 with prefix or URL)
      let qrCodeBase64 = charge.qrCodeImage || '';
      if (qrCodeBase64.startsWith('data:image/')) {
        qrCodeBase64 = qrCodeBase64.replace(/^data:image\/\w+;base64,/, '');
      }

      this.logger.log(`QR Code generated for: ${charge.correlationID}`);

      return {
        paymentId: charge.correlationID,
        status: charge.status,
        qrCode: brCode,
        qrCodeBase64,
        expiresAt,
        amount: dto.amount,
      };
    } catch (error) {
      this.logger.error(`Failed to create PIX payment: ${error.message}`);

      if (error.response) {
        this.logger.error(`Woovi API Status: ${error.response.status}`);
        this.logger.error(`Woovi API Response: ${JSON.stringify(error.response.data)}`);

        if (error.response.status === 401 || error.response.status === 403) {
          this.logger.error('AUTHORIZATION ERROR!');
          this.logger.error('Check your WOOVI_APP_ID');
          throw new BadRequestException('Invalid Woovi credentials');
        }
      }

      throw new BadRequestException(`Failed to create PIX payment: ${error.message}`);
    }
  }

  /**
   * Get payment details by correlationID
   */
  async getPayment(correlationID: string): Promise<any> {
    if (!this.axiosInstance) {
      throw new BadRequestException('Woovi is not configured');
    }

    try {
      const response = await this.axiosInstance.get(
        `/api/v1/charge/${correlationID}`
      );

      const charge = response.data.charge || response.data;

      this.logger.log(`Retrieved payment: ${correlationID} - Status: ${charge.status}`);

      // Map Woovi status to standard format for compatibility
      return {
        ...charge,
        id: charge.correlationID,
        status: this.mapWooviStatus(charge.status),
        originalStatus: charge.status,
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve payment ${correlationID}: ${error.message}`);
      throw new BadRequestException(`Failed to get payment: ${error.message}`);
    }
  }

  /**
   * Map Woovi status to standardized status
   */
  private mapWooviStatus(wooviStatus: string): string {
    const statusMap: Record<string, string> = {
      'ACTIVE': 'pending',
      'COMPLETED': 'approved',
      'EXPIRED': 'cancelled',
    };
    return statusMap[wooviStatus] || wooviStatus.toLowerCase();
  }

  /**
   * Check if payment is approved
   */
  async isPaymentApproved(correlationID: string): Promise<boolean> {
    try {
      const payment = await this.getPayment(correlationID);
      return payment.originalStatus === 'COMPLETED';
    } catch (error) {
      this.logger.error(`Failed to check payment status: ${error.message}`);
      return false;
    }
  }

  /**
   * Delete/Cancel a PIX charge
   */
  async cancelPayment(correlationID: string): Promise<any> {
    if (!this.axiosInstance) {
      throw new BadRequestException('Woovi is not configured');
    }

    try {
      const response = await this.axiosInstance.delete(
        `/api/v1/charge/${correlationID}`
      );

      this.logger.log(`Payment cancelled: ${correlationID}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to cancel payment ${correlationID}: ${error.message}`);
      throw new BadRequestException(`Failed to cancel payment: ${error.message}`);
    }
  }

  /**
   * Create a refund for a PIX payment
   */
  async createRefund(correlationID: string, transactionEndToEndId: string, amount?: number): Promise<any> {
    if (!this.axiosInstance) {
      throw new BadRequestException('Woovi is not configured');
    }

    try {
      const refundCorrelationID = this.generateCorrelationId();

      const refundData: any = {
        correlationID: refundCorrelationID,
        transactionEndToEndId,
      };

      if (amount) {
        refundData.value = amount; // In cents
      }

      const response = await this.axiosInstance.post(
        '/api/v1/refund',
        refundData
      );

      this.logger.log(`Refund created for payment: ${correlationID}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to create refund: ${error.message}`);
      throw new BadRequestException(`Failed to create refund: ${error.message}`);
    }
  }

  /**
   * Create webhook subscription in Woovi
   * This should be called once to configure the webhook endpoint
   */
  async registerWebhook(webhookUrl: string, authorization?: string): Promise<any> {
    if (!this.axiosInstance) {
      throw new BadRequestException('Woovi is not configured');
    }

    try {
      const response = await this.axiosInstance.post(
        '/api/v1/webhook',
        {
          webhook: {
            name: 'CineVision Webhook',
            url: webhookUrl,
            authorization: authorization || this.webhookSecret || 'cinevision-webhook-secret',
            isActive: true,
          },
        }
      );

      this.logger.log(`Webhook registered: ${webhookUrl}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to register webhook: ${error.message}`);
      throw new BadRequestException(`Failed to register webhook: ${error.message}`);
    }
  }

  /**
   * List registered webhooks
   */
  async listWebhooks(): Promise<any> {
    if (!this.axiosInstance) {
      throw new BadRequestException('Woovi is not configured');
    }

    try {
      const response = await this.axiosInstance.get('/api/v1/webhook');
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to list webhooks: ${error.message}`);
      throw new BadRequestException(`Failed to list webhooks: ${error.message}`);
    }
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId: string): Promise<any> {
    if (!this.axiosInstance) {
      throw new BadRequestException('Woovi is not configured');
    }

    try {
      const response = await this.axiosInstance.delete(`/api/v1/webhook/${webhookId}`);
      this.logger.log(`Webhook deleted: ${webhookId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to delete webhook: ${error.message}`);
      throw new BadRequestException(`Failed to delete webhook: ${error.message}`);
    }
  }

  /**
   * Verify webhook signature using SHA256
   * Woovi sends signature in x-webhook-signature header
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      this.logger.warn('WOOVI_WEBHOOK_SECRET not configured, skipping signature verification');
      return true;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('base64');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      this.logger.error(`Signature verification failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Health check for Woovi connection
   */
  async healthCheck(): Promise<{ status: string; timestamp: Date; environment: string }> {
    if (!this.appId) {
      this.logger.warn('Woovi health check: not configured');
      return {
        status: 'not_configured',
        timestamp: new Date(),
        environment: this.isSandbox ? 'sandbox' : 'production',
      };
    }

    try {
      await this.axiosInstance?.get('/api/v1/charge?limit=1');

      this.logger.log('Woovi health check OK');

      return {
        status: 'healthy',
        timestamp: new Date(),
        environment: this.isSandbox ? 'sandbox' : 'production',
      };
    } catch (error) {
      this.logger.error(`Woovi health check failed: ${error.message}`);
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        environment: this.isSandbox ? 'sandbox' : 'production',
      };
    }
  }
}
