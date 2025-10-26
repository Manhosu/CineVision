import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { Purchase, PurchaseStatus, PurchaseDeliveryType } from './entities/purchase.entity';
import { Content } from '../content/entities/content.entity';
import {
  InitiatePurchaseDto,
  InitiatePurchaseResponseDto,
  PaymentWebhookDto,
  PaymentWebhookResponseDto,
  WebhookPaymentStatus
} from './dto';

@Injectable()
export class PurchasesService {
  constructor(
    @InjectRepository(Purchase)
    private purchaseRepository: Repository<Purchase>,
    @InjectRepository(Content)
    private contentRepository: Repository<Content>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private dataSource: DataSource,
  ) {}

  async initiatePurchase(dto: InitiatePurchaseDto): Promise<InitiatePurchaseResponseDto> {
    // Verify content exists
    const content = await this.contentRepository.findOne({ where: { id: dto.content_id } });
    if (!content) {
      throw new NotFoundException(`Content with ID ${dto.content_id} not found`);
    }

    // Generate purchase token
    const purchase_token = uuidv4();

    // Create purchase record
    const purchase = this.purchaseRepository.create({
      user_id: dto.user_id,
      content_id: dto.content_id,
      amount_cents: content.price_cents,
      currency: 'BRL',
      status: PurchaseStatus.PENDING,
      preferred_delivery: dto.preferred_delivery,
      purchase_token,
    });

    const savedPurchase = await this.purchaseRepository.save(purchase);

    // Generate Telegram deep link
    const botUsername = this.configService.get<string>('TELEGRAM_BOT_USERNAME');
    const telegram_deep_link = `https://t.me/${botUsername}?start=${purchase_token}`;

    return {
      id: savedPurchase.id,
      purchase_token,
      telegram_deep_link,
      status: savedPurchase.status,
      amount_cents: savedPurchase.amount_cents,
      currency: savedPurchase.currency,
      preferred_delivery: savedPurchase.preferred_delivery,
      content: {
        id: content.id,
        title: content.title,
        poster_url: content.poster_url,
      },
      created_at: savedPurchase.created_at,
    };
  }

  async findByPurchaseToken(token: string): Promise<Purchase | null> {
    return this.purchaseRepository.findOne({
      where: { purchase_token: token },
      relations: ['content', 'user'],
    });
  }

  async processPaymentWebhook(dto: PaymentWebhookDto): Promise<PaymentWebhookResponseDto> {
    // Find purchase by token
    const purchase = await this.findByPurchaseToken(dto.purchase_token);
    if (!purchase) {
      throw new NotFoundException(`Purchase with token ${dto.purchase_token} not found`);
    }

    // Verify amount matches
    if (purchase.amount_cents !== dto.amount_cents) {
      throw new BadRequestException('Amount mismatch');
    }

    // Update purchase status based on webhook
    const newStatus = this.mapWebhookStatusToPurchaseStatus(dto.status);
    purchase.status = newStatus;
    purchase.payment_provider_id = dto.payment_id;

    if (dto.metadata) {
      purchase.provider_meta = dto.metadata;
    }

    const updatedPurchase = await this.purchaseRepository.save(purchase);

    const response: PaymentWebhookResponseDto = {
      purchase_id: purchase.id,
      status: newStatus,
      processed_at: new Date(),
    };

    // If payment successful, handle content delivery
    if (dto.status === WebhookPaymentStatus.PAID) {
      const delivery = await this.handleContentDelivery(purchase);
      response.delivery = delivery;

      // Notify Telegram bot about successful payment
      await this.notifyBotOfPayment(purchase);
    }

    return response;
  }

  private mapWebhookStatusToPurchaseStatus(status: WebhookPaymentStatus): PurchaseStatus {
    switch (status) {
      case WebhookPaymentStatus.PAID:
        return PurchaseStatus.PAID;
      case WebhookPaymentStatus.FAILED:
      case WebhookPaymentStatus.CANCELLED:
        return PurchaseStatus.FAILED;
      case WebhookPaymentStatus.REFUNDED:
        return PurchaseStatus.REFUNDED;
      default:
        return PurchaseStatus.PENDING;
    }
  }

  private async handleContentDelivery(purchase: Purchase) {
    console.log('DEBUG: handleContentDelivery called for purchase:', purchase.id);
    console.log('DEBUG: preferred_delivery:', purchase.preferred_delivery);

    // Increment weekly_sales for the purchased content
    await this.contentRepository.increment(
      { id: purchase.content_id },
      'weekly_sales',
      1
    );
    console.log('DEBUG: Incremented weekly_sales for content:', purchase.content_id);

    if (purchase.preferred_delivery === PurchaseDeliveryType.SITE) {
      console.log('DEBUG: Generating JWT token for site delivery');

      // Generate JWT access token for streaming
      const payload = {
        sub: purchase.user_id || 'guest',
        content_id: purchase.content_id,
        purchase_id: purchase.id,
        type: 'content_access',
      };

      console.log('DEBUG: JWT payload:', payload);

      const access_token = this.jwtService.sign(payload, { expiresIn: '24h' });
      const expires_at = new Date();
      expires_at.setHours(expires_at.getHours() + 24);

      console.log('DEBUG: Generated access_token:', access_token);
      console.log('DEBUG: expires_at:', expires_at);

      // Update purchase with access token
      purchase.access_token = access_token;
      purchase.access_expires_at = expires_at;

      console.log('DEBUG: About to save purchase with token');
      await this.purchaseRepository.save(purchase);
      console.log('DEBUG: Purchase saved successfully');

      return {
        type: 'site',
        access_token,
        expires_at,
      };
    } else {
      console.log('DEBUG: Telegram delivery, skipping token generation');
      // For Telegram delivery, we'll handle file sending in the bot
      return {
        type: 'telegram',
        telegram_sent: false, // Will be updated by bot
      };
    }
  }

  async findByUserId(userId: string): Promise<Purchase[]> {
    return this.purchaseRepository.find({
      where: { user_id: userId },
      relations: ['content'],
      order: { created_at: 'DESC' },
    });
  }

  async findByTelegramId(telegramId: string): Promise<any[]> {
    // First, find user by telegram ID
    const purchases = await this.purchaseRepository
      .createQueryBuilder('purchase')
      .leftJoinAndSelect('purchase.content', 'content')
      .leftJoinAndSelect('purchase.user', 'user')
      .where('user.telegram_id = :telegramId', { telegramId })
      .orderBy('purchase.created_at', 'DESC')
      .getMany();

    return purchases.map(purchase => ({
      id: purchase.id,
      amount_cents: purchase.amount_cents,
      currency: purchase.currency,
      status: purchase.status,
      created_at: purchase.created_at,
      access_token: purchase.access_token,
      access_expires_at: purchase.access_expires_at,
      content: {
        id: purchase.content.id,
        title: purchase.content.title,
        description: purchase.content.description,
        poster_url: purchase.content.poster_url,
        duration_minutes: purchase.content.duration_minutes,
        release_year: purchase.content.release_year,
        imdb_rating: purchase.content.imdb_rating,
      },
    }));
  }

  async findUserContentList(userId: string): Promise<any[]> {
    const purchases = await this.purchaseRepository.find({
      where: [
        { user_id: userId, status: PurchaseStatus.PAID },
        { user_id: userId, status: PurchaseStatus.COMPLETED }
      ],
      relations: ['content'],
      order: { created_at: 'DESC' },
    });

    // Deduplicate content by content_id (keep most recent purchase)
    const uniqueContentMap = new Map<string, any>();

    for (const purchase of purchases) {
      if (!uniqueContentMap.has(purchase.content.id)) {
        uniqueContentMap.set(purchase.content.id, {
          id: purchase.content.id,
          title: purchase.content.title,
          description: purchase.content.description,
          content_type: purchase.content.type, // Add content_type to differentiate movies from series
          poster_url: purchase.content.poster_url,
          thumbnail_url: purchase.content.poster_url, // Use poster_url as thumbnail
          backdrop_url: purchase.content.banner_url, // Use banner_url as backdrop
          duration_minutes: purchase.content.duration_minutes,
          release_year: purchase.content.release_year,
          imdb_rating: purchase.content.imdb_rating,
          genres: purchase.content.genres ? purchase.content.genres.split(',') : [],
          purchased_at: purchase.created_at,
          access_token: purchase.access_token,
          access_expires_at: purchase.access_expires_at,
        });
      }
    }

    return Array.from(uniqueContentMap.values());
  }

  async findById(id: string): Promise<Purchase | null> {
    return this.purchaseRepository.findOne({
      where: { id },
      relations: ['content', 'user'],
    });
  }

  async verifyAccessToken(token: string): Promise<any> {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new BadRequestException('Invalid or expired access token');
    }
  }

  async cleanupExpiredTokens(): Promise<void> {
    // Remove expired access tokens (run as a cron job)
    await this.purchaseRepository
      .createQueryBuilder()
      .update(Purchase)
      .set({
        access_token: null,
        access_expires_at: null
      })
      .where('access_expires_at < :now', { now: new Date() })
      .execute();
  }

  private async notifyBotOfPayment(purchase: Purchase): Promise<void> {
    try {
      const botUrl = this.configService.get<string>('BOT_WEBHOOK_URL') || 'http://localhost:3003';
      const webhookUrl = `${botUrl}/webhook/payment-confirmed`;

      const payload = {
        purchase_token: purchase.purchase_token,
        status: purchase.status,
        purchase_id: purchase.id,
        content_id: purchase.content_id,
        preferred_delivery: purchase.preferred_delivery,
      };

      // Generate webhook signature
      const signature = this.generateWebhookSignature(payload);

      await axios.post(webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
        },
        timeout: 5000, // 5 second timeout
      });

      console.log(`Successfully notified bot of payment for purchase ${purchase.id}`);
    } catch (error) {
      console.error(`Failed to notify bot of payment for purchase ${purchase.id}:`, error);
      // Don't throw error - this shouldn't fail the main payment process
    }
  }

  private generateWebhookSignature(payload: any): string {
    // TODO: Implement proper HMAC signature generation
    const webhookSecret = this.configService.get<string>('WEBHOOK_SECRET');
    if (!webhookSecret) {
      return 'dev-signature'; // Development fallback
    }

    // In production, use proper HMAC:
    // const crypto = require('crypto');
    // return crypto
    //   .createHmac('sha256', webhookSecret)
    //   .update(JSON.stringify(payload))
    //   .digest('hex');

    return webhookSecret;
  }

  async getWatchProgress(userId: string, contentId: string): Promise<any> {
    try {
      const result = await this.dataSource.query(
        'SELECT * FROM watch_progress WHERE user_id = $1 AND content_id = $2',
        [userId, contentId]
      );

      if (result.length === 0) {
        return {
          progress_seconds: 0,
          total_duration_seconds: 0,
          completed: false,
          last_watched_at: null,
        };
      }

      return result[0];
    } catch (error) {
      console.error('Error getting watch progress:', error);
      return {
        progress_seconds: 0,
        total_duration_seconds: 0,
        completed: false,
        last_watched_at: null,
      };
    }
  }

  async updateWatchProgress(
    userId: string,
    contentId: string,
    progressSeconds: number,
    totalDurationSeconds: number
  ): Promise<any> {
    try {
      const completed = progressSeconds / totalDurationSeconds > 0.9; // Consider 90% as completed

      await this.dataSource.query(
        `INSERT INTO watch_progress (user_id, content_id, progress_seconds, total_duration_seconds, completed, last_watched_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (user_id, content_id)
         DO UPDATE SET
           progress_seconds = EXCLUDED.progress_seconds,
           total_duration_seconds = EXCLUDED.total_duration_seconds,
           completed = EXCLUDED.completed,
           last_watched_at = EXCLUDED.last_watched_at,
           updated_at = EXCLUDED.updated_at`,
        [userId, contentId, progressSeconds, totalDurationSeconds, completed]
      );

      return {
        success: true,
        progress_seconds: progressSeconds,
        total_duration_seconds: totalDurationSeconds,
        completed,
      };
    } catch (error) {
      console.error('Error updating watch progress:', error);
      throw new BadRequestException('Failed to update watch progress');
    }
  }

  async checkUserOwnership(userId: string, contentId: string): Promise<boolean> {
    const purchase = await this.purchaseRepository.findOne({
      where: {
        user_id: userId,
        content_id: contentId,
        status: PurchaseStatus.PAID,
      },
    });

    return !!purchase;
  }
}