import { Controller, Post, Body, Headers, HttpCode, Logger } from '@nestjs/common';
import { MercadoPagoWebhookService } from '../services/mercado-pago-webhook.service';

@Controller('webhooks/mercadopago')
export class MercadoPagoWebhookController {
  private readonly logger = new Logger(MercadoPagoWebhookController.name);

  constructor(
    private readonly webhookService: MercadoPagoWebhookService,
  ) {}

  /**
   * Webhook endpoint for Mercado Pago notifications
   * URL configured in Mercado Pago: https://cinevisionn.onrender.com/api/v1/webhooks/mercadopago
   *
   * Documentation: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
   */
  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Body() body: any,
    @Headers('x-signature') signature: string,
    @Headers('x-request-id') requestId: string,
  ): Promise<{ received: boolean }> {
    this.logger.log(`Received webhook from Mercado Pago - Request ID: ${requestId}`);
    this.logger.debug(`Webhook body: ${JSON.stringify(body)}`);

    try {
      // Verify signature (IMPORTANT for production security)
      if (!this.webhookService.verifySignature(signature, requestId, body)) {
        this.logger.warn('❌ Invalid webhook signature - rejecting request');
        this.logger.warn('This could be a fraudulent webhook attempt');
        return { received: false };
      }

      // Process webhook asynchronously
      // Don't await - return 200 immediately to Mercado Pago
      this.webhookService.handleWebhook(body).catch((error) => {
        this.logger.error(`Error processing webhook asynchronously: ${error.message}`);
      });

      // Return 200 OK immediately
      // Mercado Pago expects a quick response
      return { received: true };
    } catch (error) {
      this.logger.error(`Error in webhook endpoint: ${error.message}`);
      // Still return 200 to prevent retries
      return { received: false };
    }
  }

  /**
   * Health check endpoint for webhook
   */
  @Post('health')
  @HttpCode(200)
  async health(): Promise<{ status: string }> {
    return { status: 'ok' };
  }
}
