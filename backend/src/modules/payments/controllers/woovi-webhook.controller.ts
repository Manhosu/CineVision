import { Controller, Post, Body, HttpCode, Logger, Req, Get, RawBodyRequest, Headers } from '@nestjs/common';
import { WooviWebhookService } from '../services/woovi-webhook.service';
import { WooviService } from '../services/woovi.service';
import { Request } from 'express';

@Controller('webhooks/woovi')
export class WooviWebhookController {
  private readonly logger = new Logger(WooviWebhookController.name);

  constructor(
    private readonly webhookService: WooviWebhookService,
    private readonly wooviService: WooviService,
  ) {}

  /**
   * Webhook endpoint for Woovi PIX notifications
   * URL configured in Woovi: https://cinevisionn.onrender.com/api/v1/webhooks/woovi
   *
   * Documentation: https://developers.woovi.com/en/docs/webhook
   *
   * Woovi sends POST requests with payment events like:
   * - OPENPIX:CHARGE_COMPLETED
   * - OPENPIX:TRANSACTION_RECEIVED
   */
  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Body() body: any,
    @Headers('x-webhook-signature') signature: string,
    @Req() request: RawBodyRequest<Request>,
  ): Promise<{ received: boolean }> {
    const clientIp = request.ip || request.headers['x-forwarded-for'] as string;
    this.logger.log(`Received webhook from Woovi - IP: ${clientIp}`);
    this.logger.debug(`Webhook event: ${body.event}`);

    try {
      // Verify webhook signature if secret is configured
      const rawBody = request.rawBody?.toString() || JSON.stringify(body);
      if (!this.webhookService.verifyWebhook(signature, rawBody)) {
        this.logger.warn('Webhook signature verification failed - rejecting request');
        return { received: false };
      }

      // Process webhook asynchronously
      // Don't await - return 200 immediately to Woovi
      this.webhookService.handleWebhook(body).catch((error) => {
        this.logger.error(`Error processing webhook asynchronously: ${error.message}`);
      });

      // Return 200 OK immediately
      return { received: true };
    } catch (error) {
      this.logger.error(`Error in webhook endpoint: ${error.message}`);
      return { received: false };
    }
  }

  /**
   * Woovi test webhook endpoint
   * Woovi sends a test request when configuring webhooks
   */
  @Post('test')
  @HttpCode(200)
  async handleTestWebhook(@Body() body: any): Promise<{ received: boolean }> {
    this.logger.log(`Received test webhook from Woovi: ${JSON.stringify(body)}`);
    return { received: true };
  }

  /**
   * Health check endpoint for webhook
   */
  @Get('health')
  @HttpCode(200)
  async health(): Promise<{ status: string }> {
    return { status: 'ok' };
  }

  /**
   * Endpoint to register webhook URL with Woovi
   * Call this once to configure the webhook in Woovi
   * POST /api/v1/webhooks/woovi/register
   */
  @Post('register')
  @HttpCode(200)
  async registerWebhook(): Promise<any> {
    try {
      const webhookUrl = 'https://cinevisionn.onrender.com/api/v1/webhooks/woovi';
      this.logger.log(`Registering webhook URL: ${webhookUrl}`);

      const result = await this.wooviService.registerWebhook(webhookUrl);

      this.logger.log('Webhook registered successfully');
      return {
        success: true,
        webhookUrl,
        result,
      };
    } catch (error) {
      this.logger.error(`Failed to register webhook: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Endpoint to list webhooks
   * GET /api/v1/webhooks/woovi/list
   */
  @Get('list')
  @HttpCode(200)
  async listWebhooks(): Promise<any> {
    try {
      const webhooks = await this.wooviService.listWebhooks();
      return {
        success: true,
        webhooks,
      };
    } catch (error) {
      this.logger.error(`Failed to list webhooks: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
