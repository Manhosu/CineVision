import { Controller, Post, Body, Headers, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TelegramsService } from './telegrams.service';

@ApiTags('telegrams')
@Controller('telegrams')
export class TelegramsController {
  private readonly logger = new Logger(TelegramsController.name);

  constructor(private readonly telegramsService: TelegramsService) {
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
}