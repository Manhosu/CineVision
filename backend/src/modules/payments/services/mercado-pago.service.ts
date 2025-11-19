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
  private readonly client: MercadoPagoConfig | null;
  private readonly payment: Payment | null;
  private readonly accessToken: string | null;

  constructor(private configService: ConfigService) {
    this.accessToken = this.configService.get('MERCADO_PAGO_ACCESS_TOKEN');

    if (!this.accessToken || this.accessToken.trim() === '') {
      this.logger.error('❌ MERCADO_PAGO_ACCESS_TOKEN is not configured!');
      this.logger.error('⚠️  PIX payments will NOT work until you configure it!');
      this.logger.error('📝 Get your access token from: https://www.mercadopago.com.br/developers/panel/app');
      this.logger.error('🔧 Add to .env: MERCADO_PAGO_ACCESS_TOKEN=your_token_here');
      this.client = null;
      this.payment = null;
      return;
    }

    // Validate token format (should start with APP_USR or TEST)
    if (!this.accessToken.startsWith('APP_USR-') && !this.accessToken.startsWith('TEST-')) {
      this.logger.error('❌ MERCADO_PAGO_ACCESS_TOKEN has invalid format!');
      this.logger.error(`   Current: ${this.accessToken.substring(0, 20)}...`);
      this.logger.error('   Expected format: APP_USR-xxxx or TEST-xxxx');
      this.client = null;
      this.payment = null;
      return;
    }

    try {
      // Initialize Mercado Pago client
      this.client = new MercadoPagoConfig({
        accessToken: this.accessToken,
        options: {
          timeout: 5000,
        },
      });

      this.payment = new Payment(this.client);

      const tokenType = this.accessToken.startsWith('TEST-') ? 'TEST (Sandbox)' : 'PRODUCTION';
      this.logger.log(`✅ Mercado Pago service initialized successfully`);
      this.logger.log(`🔑 Using ${tokenType} credentials`);

      // Validate token immediately on startup
      this.validateTokenOnStartup();
    } catch (error) {
      this.logger.error(`❌ Failed to initialize Mercado Pago: ${error.message}`);
      this.client = null;
      this.payment = null;
    }
  }

  /**
   * Validate token on startup (don't block initialization)
   */
  private async validateTokenOnStartup() {
    try {
      this.logger.log('🔍 Validating Mercado Pago token...');

      const response = await axios.get(
        'https://api.mercadopago.com/users/me',
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
          timeout: 5000,
        },
      );

      this.logger.log(`✅ Token validation successful!`);
      this.logger.log(`   Account ID: ${response.data.id}`);
      this.logger.log(`   Email: ${response.data.email || 'N/A'}`);
      this.logger.log(`   Status: ${response.data.site_status || 'active'}`);

      // Check if account can process payments
      if (response.data.site_status === 'inactive' || response.data.site_status === 'suspended') {
        this.logger.error(`⚠️  WARNING: Mercado Pago account status is ${response.data.site_status}`);
        this.logger.error(`   PIX payments may not work!`);
      }
    } catch (error) {
      this.logger.error(`❌ Token validation FAILED: ${error.message}`);

      if (error.response?.status === 401) {
        this.logger.error(`🚨 TOKEN INVÁLIDO OU REVOGADO!`);
        this.logger.error(`   O token não está mais válido no Mercado Pago`);
      } else if (error.response?.status === 403) {
        this.logger.error(`🚨 TOKEN SEM PERMISSÕES!`);
        this.logger.error(`   O token não tem permissões necessárias`);
      }

      this.logger.error(`   🔧 SOLUÇÃO:`);
      this.logger.error(`   1. Acesse: https://www.mercadopago.com.br/developers/panel/app`);
      this.logger.error(`   2. Verifique se a aplicação está ativa`);
      this.logger.error(`   3. Gere um NOVO Access Token`);
      this.logger.error(`   4. Atualize MERCADO_PAGO_ACCESS_TOKEN no Render`);
      this.logger.error(`   5. Faça redeploy do backend`);
    }
  }

  /**
   * Create a PIX payment with QR Code
   * Returns the payment ID, QR code data, and QR code image in base64
   */
  async createPixPayment(dto: CreatePixPaymentDto): Promise<PixPaymentResult> {
    if (!this.payment || !this.accessToken) {
      const errorMsg = '❌ Mercado Pago não está configurado! Configure MERCADO_PAGO_ACCESS_TOKEN nas variáveis de ambiente.';
      this.logger.error(errorMsg);
      this.logger.error('📝 Obtenha seu token em: https://www.mercadopago.com.br/developers/panel/app');
      throw new BadRequestException(errorMsg);
    }

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

      this.logger.log(`Sending payment request to Mercado Pago API...`);
      this.logger.log(`Token type: ${this.accessToken.startsWith('TEST-') ? '⚠️  TEST (Sandbox)' : '✅ PRODUCTION'}`);
      this.logger.log(`Request data: ${JSON.stringify(paymentData, null, 2)}`);

      const response = await this.payment.create({ body: paymentData });

      this.logger.log(`✅ PIX payment created: ${response.id}`);

      // Extract QR code data
      const qrCode = response.point_of_interaction?.transaction_data?.qr_code;
      const qrCodeBase64 = response.point_of_interaction?.transaction_data?.qr_code_base64;

      if (!qrCode || !qrCodeBase64) {
        this.logger.error('❌ Mercado Pago returned success but QR code is missing!');
        this.logger.error(`Response: ${JSON.stringify(response)}`);
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
      this.logger.error(`❌ Failed to create PIX payment: ${error.message}`);
      this.logger.error(`🔑 Token being used: ${this.accessToken?.substring(0, 15)}...${this.accessToken?.substring(this.accessToken.length - 10)}`);

      // Log more details for debugging
      if (error.response) {
        this.logger.error(`📋 Mercado Pago API Status: ${error.response.status}`);
        this.logger.error(`📋 Mercado Pago API Response: ${JSON.stringify(error.response.data, null, 2)}`);
      }

      if (error.cause) {
        this.logger.error(`📋 Error cause: ${JSON.stringify(error.cause, null, 2)}`);
      }

      // Check for specific error messages
      if (error.message.includes('UNAUTHORIZED') || error.message.includes('unauthorized') ||
          error.message.includes('policy returned UNAUTHORIZED')) {

        const isTestToken = this.accessToken?.startsWith('TEST-');

        this.logger.error('🔑 ERRO DE AUTORIZAÇÃO DETECTADO!');
        this.logger.error(`   Token type: ${isTestToken ? '⚠️  TEST (não deve ser usado em produção!)' : 'PRODUCTION'}`);
        this.logger.error('   Possíveis causas:');

        if (isTestToken) {
          this.logger.error('   ❌ Token de TEST sendo usado em PRODUÇÃO!');
          this.logger.error('   ✅ Solução: Use o token APP_USR- (produção) em vez de TEST-');
        } else {
          this.logger.error('   1. Token pode estar expirado ou revogado');
          this.logger.error('   2. Token sem permissões para criar pagamentos PIX');
          this.logger.error('   3. Conta Mercado Pago com restrições');
        }

        this.logger.error('   🔧 Como resolver:');
        this.logger.error('   1. Acesse: https://www.mercadopago.com.br/developers/panel/app');
        this.logger.error('   2. Verifique se a aplicação está ativa');
        this.logger.error('   3. Gere um NOVO Access Token de PRODUÇÃO');
        this.logger.error('   4. Atualize MERCADO_PAGO_ACCESS_TOKEN no Render');

        const errorMsg = isTestToken
          ? 'Token de teste sendo usado em produção. Use o token APP_USR-'
          : 'Token do Mercado Pago inválido, expirado ou sem permissões. Gere um novo token.';

        throw new BadRequestException(errorMsg);
      }

      throw new BadRequestException(`Failed to create PIX payment: ${error.message}`);
    }
  }

  /**
   * Get payment details by ID
   */
  async getPayment(paymentId: string): Promise<any> {
    if (!this.payment || !this.accessToken) {
      throw new BadRequestException('Mercado Pago is not configured');
    }

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
    if (!this.payment || !this.accessToken) {
      throw new BadRequestException('Mercado Pago is not configured');
    }

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
    if (!this.payment || !this.accessToken) {
      throw new BadRequestException('Mercado Pago is not configured');
    }

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
    if (!this.accessToken) {
      this.logger.warn('Mercado Pago health check: not configured');
      return {
        status: 'not_configured',
        timestamp: new Date(),
      };
    }

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
