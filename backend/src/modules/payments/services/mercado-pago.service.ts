import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import axios from 'axios';

export interface CreatePixPaymentDto {
  amount: number; // in cents
  description: string;
  email?: string;
  metadata?: Record<string, string>;
}

export interface PixPaymentResult {
  paymentId: string;
  status: string;
  qrCode: string; // PIX code for copy-paste
  qrCodeBase64: string; // QR code image in base64
  expiresAt: Date;
  amount: number;
}

@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name);
  private readonly client: MercadoPagoConfig;
  private readonly payment: Payment;
  private readonly accessToken: string;

  constructor(private configService: ConfigService) {
    this.accessToken = this.configService.get('MERCADO_PAGO_ACCESS_TOKEN');

    if (!this.accessToken) {
      throw new Error('MERCADO_PAGO_ACCESS_TOKEN is not configured');
    }

    // Initialize Mercado Pago client
    this.client = new MercadoPagoConfig({
      accessToken: this.accessToken,
      options: {
        timeout: 5000,
      },
    });

    this.payment = new Payment(this.client);

    this.logger.log('Mercado Pago service initialized');
  }

  /**
   * Create a PIX payment with QR Code
   * Returns the payment ID, QR code data, and QR code image in base64
   */
  async createPixPayment(dto: CreatePixPaymentDto): Promise<PixPaymentResult> {
    try {
      this.logger.log(`Creating PIX payment for amount: R$ ${dto.amount / 100}`);

      // Create payment with PIX
      const paymentData = {
        transaction_amount: dto.amount / 100, // Mercado Pago uses decimal (R$)
        description: dto.description,
        payment_method_id: 'pix',
        payer: {
          email: dto.email || 'cliente@cinevision.com',
          ...(dto.metadata?.first_name && {
            first_name: dto.metadata.first_name,
          }),
          ...(dto.metadata?.last_name && {
            last_name: dto.metadata.last_name,
          }),
        },
        ...(dto.metadata && {
          metadata: dto.metadata,
        }),
      };

      const response = await this.payment.create({ body: paymentData });

      this.logger.log(`PIX payment created: ${response.id}`);

      // Extract QR code data
      const qrCode = response.point_of_interaction?.transaction_data?.qr_code;
      const qrCodeBase64 = response.point_of_interaction?.transaction_data?.qr_code_base64;

      if (!qrCode || !qrCodeBase64) {
        throw new BadRequestException('Failed to generate PIX QR code from Mercado Pago');
      }

      // Calculate expiration (Mercado Pago PIX expires in 30 minutes by default)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 30);

      return {
        paymentId: String(response.id),
        status: response.status,
        qrCode,
        qrCodeBase64,
        expiresAt,
        amount: dto.amount,
      };
    } catch (error) {
      this.logger.error(`Failed to create PIX payment: ${error.message}`);

      // Log more details for debugging
      if (error.response) {
        this.logger.error(`Mercado Pago API error: ${JSON.stringify(error.response.data)}`);
      }

      throw new BadRequestException(`Failed to create PIX payment: ${error.message}`);
    }
  }

  /**
   * Get payment details by ID
   */
  async getPayment(paymentId: string): Promise<any> {
    try {
      const payment = await this.payment.get({ id: paymentId });
      this.logger.log(`Retrieved payment: ${paymentId} - Status: ${payment.status}`);
      return payment;
    } catch (error) {
      this.logger.error(`Failed to retrieve payment ${paymentId}: ${error.message}`);
      throw new BadRequestException(`Failed to retrieve payment: ${error.message}`);
    }
  }

  /**
   * Check if payment is approved
   */
  async isPaymentApproved(paymentId: string): Promise<boolean> {
    try {
      const payment = await this.getPayment(paymentId);
      return payment.status === 'approved';
    } catch (error) {
      this.logger.error(`Failed to check payment status: ${error.message}`);
      return false;
    }
  }

  /**
   * Cancel a payment
   */
  async cancelPayment(paymentId: string): Promise<any> {
    try {
      const response = await this.payment.cancel({ id: paymentId });
      this.logger.log(`Payment cancelled: ${paymentId}`);
      return response;
    } catch (error) {
      this.logger.error(`Failed to cancel payment ${paymentId}: ${error.message}`);
      throw new BadRequestException(`Failed to cancel payment: ${error.message}`);
    }
  }

  /**
   * Create a refund for a payment
   */
  async createRefund(paymentId: string, amount?: number): Promise<any> {
    try {
      const refundData: any = {
        payment_id: paymentId,
      };

      if (amount) {
        refundData.amount = amount / 100; // Convert cents to BRL
      }

      // Use axios to create refund (SDK may not have this method)
      const response = await axios.post(
        `https://api.mercadopago.com/v1/payments/${paymentId}/refunds`,
        refundData,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(`Refund created for payment: ${paymentId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to create refund: ${error.message}`);
      throw new BadRequestException(`Failed to create refund: ${error.message}`);
    }
  }

  /**
   * Health check for Mercado Pago connection
   */
  async healthCheck(): Promise<{ status: string; timestamp: Date }> {
    try {
      // Try to get account info to verify connection
      const response = await axios.get(
        'https://api.mercadopago.com/users/me',
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        },
      );

      this.logger.log(`Mercado Pago health check OK - Account ID: ${response.data.id}`);

      return {
        status: 'healthy',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Mercado Pago health check failed: ${error.message}`);
      return {
        status: 'unhealthy',
        timestamp: new Date(),
      };
    }
  }
}
