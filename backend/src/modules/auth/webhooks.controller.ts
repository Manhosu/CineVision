import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Headers,
  RawBody,
  UnauthorizedException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
} from '@nestjs/swagger';
import { TelegramAuthService } from './services/telegram-auth.service';
import { TelegramCallbackDto, TelegramCallbackResponseDto } from './dto/telegram-callback.dto';
import { PurchasesService } from '../purchases/purchases.service';
import { PaymentsService } from '../payments/payments.service';
import { PaymentWebhookDto, PaymentWebhookResponseDto } from '../purchases/dto';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private purchasesService: PurchasesService,
    private paymentsService: PaymentsService,
    @Optional() private telegramAuthService?: TelegramAuthService,
  ) {}

  @Post('telegram/link-callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Telegram bot callback for authentication',
    description: 'This endpoint is called by the Telegram bot to complete the authentication flow'
  })
  @ApiResponse({
    status: 200,
    description: 'Telegram authentication successful',
    type: TelegramCallbackResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  @ApiResponse({ status: 401, description: 'Invalid signature' })
  async telegramLinkCallback(
    @Body() callbackDto: TelegramCallbackDto,
  ): Promise<TelegramCallbackResponseDto> {
    if (!this.telegramAuthService) {
      throw new BadRequestException('Telegram authentication is not available');
    }
    return this.telegramAuthService.processTelegramCallback(callbackDto);
  }

  @Post('payments/stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Stripe webhook handler',
    description: 'Receives payment status updates from Stripe with signature verification',
  })
  @ApiHeader({
    name: 'stripe-signature',
    description: 'Stripe webhook signature for verification',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Stripe webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook payload' })
  @ApiResponse({ status: 401, description: 'Invalid webhook signature' })
  async stripeWebhook(
    @RawBody() payload: Buffer,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    const payloadString = payload.toString('utf8');
    return this.paymentsService.handleStripeWebhook(payloadString, signature);
  }

  @Post('payments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Payment provider webhook (legacy)',
    description: 'Legacy webhook for custom payment providers. Use /webhooks/payments/stripe for Stripe.',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment webhook processed successfully',
    type: PaymentWebhookResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid webhook payload' })
  @ApiResponse({ status: 404, description: 'Purchase not found' })
  async paymentWebhook(
    @Body() webhookDto: PaymentWebhookDto,
  ): Promise<PaymentWebhookResponseDto> {
    // Legacy handler - uses the PurchasesService for backward compatibility
    return this.purchasesService.processPaymentWebhook(webhookDto);
  }
}