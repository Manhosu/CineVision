import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { PurchaseStatus, PurchaseDeliveryType } from './entities/purchase.entity';
import {
  InitiatePurchaseDto,
  InitiatePurchaseResponseDto,
  PaymentWebhookDto,
  PaymentWebhookResponseDto,
  WebhookPaymentStatus
} from './dto';

@Injectable()
export class PurchasesSupabaseService {
  private supabase: SupabaseClient;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
                        this.configService.get<string>('SUPABASE_SERVICE_KEY') ||
                        this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY/SUPABASE_ANON_KEY are required');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async initiatePurchase(dto: InitiatePurchaseDto): Promise<InitiatePurchaseResponseDto> {
    // Verify content exists
    const { data: content, error: contentError } = await this.supabase
      .from('content')
      .select('*')
      .eq('id', dto.content_id)
      .single();

    if (contentError || !content) {
      throw new NotFoundException(`Content with ID ${dto.content_id} not found`);
    }

    // Generate purchase token
    const purchase_token = uuidv4();

    // Create purchase record
    const { data: savedPurchase, error: purchaseError } = await this.supabase
      .from('purchases')
      .insert({
        user_id: dto.user_id,
        content_id: dto.content_id,
        amount_cents: content.price_cents,
        currency: 'BRL',
        status: PurchaseStatus.PENDING,
        preferred_delivery: dto.preferred_delivery,
        purchase_token,
      })
      .select()
      .single();

    if (purchaseError || !savedPurchase) {
      throw new BadRequestException('Failed to create purchase');
    }

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

  async findByPurchaseToken(token: string): Promise<any | null> {
    const { data, error } = await this.supabase
      .from('purchases')
      .select(`
        *,
        content(*),
        user:users(*)
      `)
      .eq('purchase_token', token)
      .single();

    if (error) return null;
    return data;
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

    const updateData: any = {
      status: newStatus,
      payment_provider_id: dto.payment_id,
    };

    if (dto.metadata) {
      updateData.provider_meta = dto.metadata;
    }

    const { data: updatedPurchase, error } = await this.supabase
      .from('purchases')
      .update(updateData)
      .eq('id', purchase.id)
      .select()
      .single();

    if (error) {
      throw new BadRequestException('Failed to update purchase');
    }

    const response: PaymentWebhookResponseDto = {
      purchase_id: purchase.id,
      status: newStatus,
      processed_at: new Date(),
    };

    // If payment successful, handle content delivery
    if (dto.status === WebhookPaymentStatus.PAID) {
      const delivery = await this.handleContentDelivery(updatedPurchase);
      response.delivery = delivery;

      // Notify Telegram bot about successful payment
      await this.notifyBotOfPayment(updatedPurchase);
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

  private async handleContentDelivery(purchase: any) {
    console.log('DEBUG: handleContentDelivery called for purchase:', purchase.id);
    console.log('DEBUG: preferred_delivery:', purchase.preferred_delivery);

    // Increment weekly_sales for the purchased content
    const { data: currentContent } = await this.supabase
      .from('content')
      .select('weekly_sales')
      .eq('id', purchase.content_id)
      .single();

    const newWeeklySales = (currentContent?.weekly_sales || 0) + 1;

    await this.supabase
      .from('content')
      .update({ weekly_sales: newWeeklySales })
      .eq('id', purchase.content_id);

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
      const { error } = await this.supabase
        .from('purchases')
        .update({
          access_token,
          access_expires_at: expires_at.toISOString(),
        })
        .eq('id', purchase.id);

      if (error) {
        console.error('DEBUG: Failed to save purchase with token:', error);
      } else {
        console.log('DEBUG: Purchase saved successfully');
      }

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

  async findByUserId(userId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('purchases')
      .select(`
        *,
        content(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching purchases by user ID:', error);
      return [];
    }

    return data || [];
  }

  async findByTelegramId(telegramId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('purchases')
      .select(`
        *,
        content(*),
        user:users(*)
      `)
      .eq('user.telegram_id', telegramId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching purchases by Telegram ID:', error);
      return [];
    }

    return (data || []).map(purchase => ({
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
    console.log('[findUserContentList] Fetching content for user:', userId);

    // Check if user is admin (automatic full access)
    const ADMIN_TELEGRAM_IDS = ['5212925997', '2006803983'];

    const { data: userData } = await this.supabase
      .from('users')
      .select('telegram_id')
      .eq('id', userId)
      .single();

    // Admin users get ALL published content
    if (userData?.telegram_id && ADMIN_TELEGRAM_IDS.includes(userData.telegram_id)) {
      console.log('[findUserContentList] Admin user detected, returning all published content');

      const { data: allContent, error: contentError } = await this.supabase
        .from('content')
        .select(`
          *,
          content_languages(
            id,
            language_name,
            video_url,
            hls_master_url,
            upload_status
          )
        `)
        .eq('status', 'PUBLISHED')
        .order('created_at', { ascending: false });

      if (contentError || !allContent) {
        console.error('[findUserContentList] Error fetching all content for admin:', contentError);
        return [];
      }

      return allContent.map(content => ({
        id: content.id,
        title: content.title,
        description: content.description,
        content_type: content.content_type,
        poster_url: content.poster_url,
        thumbnail_url: content.poster_url,
        backdrop_url: content.banner_url,
        duration_minutes: content.duration_minutes,
        release_year: content.release_year,
        imdb_rating: content.imdb_rating,
        price_cents: content.price_cents,
        telegram_group_link: content.telegram_group_link,
        video_url: content.video_url,
        hls_master_url: content.hls_master_url,
        content_languages: content.content_languages || [],
        total_seasons: content.total_seasons || content.seasons,
        total_episodes: content.total_episodes || content.episodes,
        genres: Array.isArray(content.genres)
          ? content.genres
          : (typeof content.genres === 'string' && content.genres)
            ? content.genres.split(',')
            : [],
        purchased_at: content.created_at,
        access_token: null, // Admins don't need tokens
        access_expires_at: null,
      }));
    }

    // Regular users: fetch purchases
    console.log('[findUserContentList] Regular user, fetching purchases with status:', PurchaseStatus.PAID, 'and', PurchaseStatus.COMPLETED);

    const { data, error } = await this.supabase
      .from('purchases')
      .select(`
        *,
        content(
          *,
          content_languages(
            id,
            language_name,
            video_url,
            hls_master_url,
            upload_status
          )
        )
      `)
      .eq('user_id', userId)
      .in('status', [PurchaseStatus.PAID, PurchaseStatus.COMPLETED])
      .order('created_at', { ascending: false });

    console.log('[findUserContentList] Query result:', { data, error, dataLength: data?.length });

    if (error) {
      console.error('[findUserContentList] Error fetching user content list:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log('[findUserContentList] No purchases found');
      return [];
    }

    console.log('[findUserContentList] Found purchases:', data.length);
    console.log('[findUserContentList] First purchase:', JSON.stringify(data[0], null, 2));

    // Deduplicate content by content_id (keep most recent purchase)
    const uniqueContentMap = new Map<string, any>();

    for (const purchase of data) {
      if (!uniqueContentMap.has(purchase.content.id)) {
        uniqueContentMap.set(purchase.content.id, {
          id: purchase.content.id,
          title: purchase.content.title,
          description: purchase.content.description,
          content_type: purchase.content.content_type, // Add content_type to differentiate movies from series
          poster_url: purchase.content.poster_url,
          thumbnail_url: purchase.content.poster_url, // Use poster_url as thumbnail
          backdrop_url: purchase.content.banner_url, // Use banner_url as backdrop
          duration_minutes: purchase.content.duration_minutes,
          release_year: purchase.content.release_year,
          imdb_rating: purchase.content.imdb_rating,
          price_cents: purchase.content.price_cents,
          telegram_group_link: purchase.content.telegram_group_link, // Add telegram group link for viewing options modal
          video_url: purchase.content.video_url, // Legacy video URL
          hls_master_url: purchase.content.hls_master_url, // Legacy HLS URL
          content_languages: purchase.content.content_languages || [], // Language-based videos
          total_seasons: purchase.content.total_seasons || purchase.content.seasons, // Add season count for series
          total_episodes: purchase.content.total_episodes || purchase.content.episodes, // Add episode count for series
          genres: Array.isArray(purchase.content.genres)
            ? purchase.content.genres
            : (typeof purchase.content.genres === 'string' && purchase.content.genres)
              ? purchase.content.genres.split(',')
              : [],
          purchased_at: purchase.created_at,
          access_token: purchase.access_token,
          access_expires_at: purchase.access_expires_at,
        });
      }
    }

    const uniqueContent = Array.from(uniqueContentMap.values());
    console.log('[findUserContentList] Unique content after deduplication:', uniqueContent.length);

    return uniqueContent;
  }

  async findById(id: string): Promise<any | null> {
    const { data, error } = await this.supabase
      .from('purchases')
      .select(`
        *,
        content(*),
        user:users(*)
      `)
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  }

  async verifyAccessToken(token: string): Promise<any> {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new BadRequestException('Invalid or expired access token');
    }
  }

  async cleanupExpiredTokens(): Promise<void> {
    // Remove expired access tokens
    await this.supabase
      .from('purchases')
      .update({
        access_token: null,
        access_expires_at: null,
      })
      .lt('access_expires_at', new Date().toISOString());
  }

  private async notifyBotOfPayment(purchase: any): Promise<void> {
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
    const webhookSecret = this.configService.get<string>('WEBHOOK_SECRET');
    if (!webhookSecret) {
      return 'dev-signature'; // Development fallback
    }

    return webhookSecret;
  }

  async getWatchProgress(userId: string, contentId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('watch_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('content_id', contentId)
        .single();

      if (error || !data) {
        return {
          progress_seconds: 0,
          total_duration_seconds: 0,
          completed: false,
          last_watched_at: null,
        };
      }

      return data;
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
      const now = new Date().toISOString();

      const { error } = await this.supabase
        .from('watch_progress')
        .upsert({
          user_id: userId,
          content_id: contentId,
          progress_seconds: progressSeconds,
          total_duration_seconds: totalDurationSeconds,
          completed,
          last_watched_at: now,
          updated_at: now,
        }, {
          onConflict: 'user_id,content_id'
        });

      if (error) {
        throw error;
      }

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
    // Check if user is admin (automatic full access)
    const ADMIN_TELEGRAM_IDS = ['5212925997', '2006803983'];

    const { data: userData } = await this.supabase
      .from('users')
      .select('telegram_id')
      .eq('id', userId)
      .single();

    // Admin users have automatic access to all content
    if (userData?.telegram_id && ADMIN_TELEGRAM_IDS.includes(userData.telegram_id)) {
      return true;
    }

    // Regular users: check purchase record
    const { data, error } = await this.supabase
      .from('purchases')
      .select('id')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .eq('status', PurchaseStatus.PAID)
      .single();

    return !!data && !error;
  }
}
