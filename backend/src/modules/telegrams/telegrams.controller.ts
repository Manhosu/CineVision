import { Controller, Post, Body, Headers, Logger, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TelegramsService } from './telegrams.service';
import { TelegramsEnhancedService } from './telegrams-enhanced.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
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

  // Igor pediu (04/05): re-acesso pelo dashboard. Cliente já comprou,
  // vai assistir outro dia, clica em "Assistir" — backend valida
  // ownership e gera invite single-use de 24h on-the-fly. Sem expor
  // link permanente que dá pra encaminhar pra terceiros.
  @Post('access-link/:contentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Generate single-use Telegram invite link for purchased content',
    description:
      'Validates the authenticated user owns a paid purchase of contentId, then returns a single-use invite link (24h expiry) generated via Bot API.',
  })
  @ApiResponse({ status: 200, description: 'Invite link generated' })
  @ApiResponse({ status: 403, description: 'User did not purchase this content' })
  @ApiResponse({ status: 400, description: 'Content has no Telegram group configured' })
  async getAccessLink(
    @Param('contentId') contentId: string,
    @GetUser() user: any,
  ) {
    return this.telegramsEnhancedService.getOrCreateAccessLinkForPurchasedContent(
      user.sub,
      contentId,
    );
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Telegram bot webhook handler' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleWebhook(
    @Body() webhookData: any,
    @Headers('x-telegram-bot-api-secret-token') signature?: string
  ) {
    return this.telegramsEnhancedService.handleWebhook(webhookData, signature);
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

  // @Post('setup-webhook')
  // @ApiOperation({ summary: 'Setup Telegram webhook' })
  // @ApiResponse({ status: 200, description: 'Webhook setup successfully' })
  // async setupWebhook(@Body() setupData: { url: string; secretToken?: string }) {
  //   return this.telegramsService.setupWebhook(setupData.url, setupData.secretToken);
  // }

  // @Get('setup-webhook')
  // @ApiOperation({ summary: 'Setup Telegram webhook (auto-detect URL)' })
  // @ApiResponse({ status: 200, description: 'Webhook setup successfully' })
  // async setupWebhookAuto() {
  //   // Auto-detect backend URL from environment
  //   const backendUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || 'https://cinevisionn.onrender.com';
  //   const webhookUrl = `${backendUrl}/api/v1/telegrams/webhook`;

  //   this.logger.log(`Setting up webhook with URL: ${webhookUrl}`);
  //   return this.telegramsService.setupWebhook(webhookUrl);
  // }

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