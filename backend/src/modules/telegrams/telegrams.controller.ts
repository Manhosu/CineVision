import { Controller, Post, Body, Headers, Logger, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TelegramsService } from './telegrams.service';
import { TelegramsEnhancedService } from './telegrams-enhanced.service';
import {
  InitiateTelegramPurchaseDto,
  TelegramPurchaseResponseDto,
  VerifyEmailDto,
  VerifyEmailResponseDto,
} from './dto';

@ApiTags('telegrams')
@Controller('telegrams')
export class TelegramsController {
  private readonly logger = new Logger(TelegramsController.name);

  constructor(
    private readonly telegramsService: TelegramsService,
    private readonly telegramsEnhancedService: TelegramsEnhancedService,
  ) {
    this.logger.log('TelegramsController initialized');
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Telegram bot webhook handler' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleWebhook(
    @Body() webhookData: any,
    @Headers('x-telegram-bot-api-secret-token') signature?: string
  ) {
    return this.telegramsService.handleWebhook(webhookData, signature);
  }

  @Post('send-notification')
  @ApiOperation({ summary: 'Send notification via Telegram' })
  @ApiResponse({ status: 200, description: 'Notification sent successfully' })
  async sendNotification(@Body() notificationData: any) {
    return this.telegramsService.sendNotification(
      notificationData.chatId,
      notificationData.message
    );
  }

  @Post('setup-webhook')
  @ApiOperation({ summary: 'Setup Telegram webhook' })
  @ApiResponse({ status: 200, description: 'Webhook setup successfully' })
  async setupWebhook(@Body() setupData: { url: string; secretToken?: string }) {
    return this.telegramsService.setupWebhook(setupData.url, setupData.secretToken);
  }

  @Get('setup-webhook')
  @ApiOperation({ summary: 'Setup Telegram webhook (auto-detect URL)' })
  @ApiResponse({ status: 200, description: 'Webhook setup successfully' })
  async setupWebhookAuto() {
    // Auto-detect backend URL from environment
    const backendUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || 'https://cinevisionn.onrender.com';
    const webhookUrl = `${backendUrl}/api/v1/telegrams/webhook`;

    this.logger.log(`Setting up webhook with URL: ${webhookUrl}`);
    return this.telegramsService.setupWebhook(webhookUrl);
  }

  @Post('payment-confirmation')
  @ApiOperation({ summary: 'Send payment confirmation' })
  @ApiResponse({ status: 200, description: 'Payment confirmation sent' })
  async sendPaymentConfirmation(@Body() data: { chatId: string; purchaseData: any }) {
    return this.telegramsService.sendPaymentConfirmation(data.chatId, data.purchaseData);
  }

  @Post('new-release-notification')
  @ApiOperation({ summary: 'Send new release notification' })
  @ApiResponse({ status: 200, description: 'New release notification sent' })
  async sendNewReleaseNotification(@Body() data: { chatId: string; movieData: any }) {
    return this.telegramsService.sendNewReleaseNotification(data.chatId, data.movieData);
  }

  @Post('verify-email')
  @ApiOperation({ summary: 'Verify if email exists in system' })
  @ApiResponse({ status: 200, description: 'Email verification result', type: VerifyEmailResponseDto })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto): Promise<VerifyEmailResponseDto> {
    return this.telegramsEnhancedService.verifyUserEmail(verifyEmailDto);
  }

  @Post('purchase')
  @ApiOperation({ summary: 'Initiate Telegram purchase' })
  @ApiResponse({ status: 200, description: 'Purchase initiated', type: TelegramPurchaseResponseDto })
  async initiatePurchase(@Body() purchaseDto: InitiateTelegramPurchaseDto): Promise<TelegramPurchaseResponseDto> {
    return this.telegramsEnhancedService.initiateTelegramPurchase(purchaseDto);
  }

  @Post('payment-success')
  @ApiOperation({ summary: 'Handle payment success callback' })
  @ApiResponse({ status: 200, description: 'Payment success handled' })
  async handlePaymentSuccess(@Body() data: { purchase_id: string }) {
    return this.telegramsEnhancedService.handlePaymentConfirmation(data.purchase_id);
  }

  @Post('payment-cancel')
  @ApiOperation({ summary: 'Handle payment cancellation' })
  @ApiResponse({ status: 200, description: 'Payment cancellation handled' })
  async handlePaymentCancel(@Body() data: { purchase_id: string }) {
    this.logger.log(`Payment cancelled for purchase ${data.purchase_id}`);
    return { message: 'Payment cancelled', purchase_id: data.purchase_id };
  }

  @Post('miniapp/purchase')
  @ApiOperation({ summary: 'Initiate purchase from Telegram Mini App' })
  @ApiResponse({ status: 200, description: 'Mini App purchase initiated' })
  async initiateMiniAppPurchase(@Body() data: {
    telegram_id: number;
    movie_id: string;
    movie_title: string;
    movie_price: number;
    init_data: string;
  }) {
    return this.telegramsEnhancedService.handleMiniAppPurchase(data);
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async healthCheck() {
    return {
      status: 'ok',
      service: 'telegrams',
      timestamp: new Date().toISOString(),
    };
  }
}