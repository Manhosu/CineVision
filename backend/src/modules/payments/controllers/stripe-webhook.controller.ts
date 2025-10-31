import {
  Controller,
  Post,
  Headers,
  RawBodyRequest,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request } from 'express';
import { StripeService } from '../services/stripe.service';
import { StripeWebhookService } from '../services/stripe-webhook.service';
import { StripeWebhookSupabaseService } from '../services/stripe-webhook-supabase.service';

@ApiTags('Webhooks')
@Controller('webhooks/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);
  private readonly webhookService: any;

  constructor(
    private stripeService: StripeService,
    @Optional() private typeormWebhookService?: StripeWebhookService,
    @Optional() private supabaseWebhookService?: StripeWebhookSupabaseService,
  ) {
    // Use Supabase service if available, otherwise fall back to TypeORM
    this.webhookService = this.supabaseWebhookService || this.typeormWebhookService;

    if (!this.webhookService) {
      this.logger.error('No webhook service available!');
    } else {
      this.logger.log(`Using ${this.supabaseWebhookService ? 'Supabase' : 'TypeORM'} webhook service`);
    }
  }

  @Post()
  @ApiOperation({ summary: 'Stripe webhook endpoint' })
  @ApiExcludeEndpoint() // Hide from public Swagger docs
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    this.logger.log('Received Stripe webhook');

    try {
      // Get raw body (must be configured in main.ts)
      const rawBody = req.rawBody;

      if (!rawBody) {
        this.logger.error('No raw body available for webhook verification');
        throw new Error('Raw body required for webhook verification');
      }

      // Verify webhook signature
      const event = this.stripeService.verifyWebhookSignature(rawBody, signature);

      this.logger.log(`Verified webhook event: ${event.type}`);

      // Process webhook event
      await this.webhookService.handleWebhookEvent(event);

      return { received: true };
    } catch (error) {
      this.logger.error(`Webhook processing failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}
