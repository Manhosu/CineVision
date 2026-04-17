import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';
// AWS SDK removed - content delivery via Telegram only
import * as bcrypt from 'bcrypt';
import { AutoLoginService } from '../auth/services/auto-login.service';
import { PixProviderFactory } from '../payments/providers/pix-provider.factory';
import {
  InitiateTelegramPurchaseDto,
  TelegramPurchaseResponseDto,
  VerifyEmailDto,
  VerifyEmailResponseDto,
  PurchaseType,
} from './dto';

interface PendingPurchase {
  chat_id: string;
  telegram_user_id: number;
  content_id: string;
  purchase_type: PurchaseType;
  user_email?: string;
  user_id?: string;
  timestamp: number;
}

interface PendingRegistration {
  chat_id: number;
  telegram_user_id: number;
  content_id?: string;
  step: 'name' | 'email' | 'password';
  data: {
    name?: string;
    email?: string;
    password?: string;
  };
  timestamp: number;
}

interface PendingRequest {
  chat_id: number;
  telegram_user_id: number;
  step: 'title' | 'type';
  data: {
    title?: string;
    type?: 'movie' | 'series';
  };
  timestamp: number;
}

@Injectable()
export class TelegramsEnhancedService implements OnModuleInit {
  private readonly logger = new Logger(TelegramsEnhancedService.name);
  private readonly botToken: string;
  private readonly webhookSecret: string;
  private readonly botApiUrl: string;
  private readonly supabase: SupabaseClient;
  private readonly apiUrl: string;
  private readonly s3Client: any; // AWS SDK removed
  private catalogSyncService: any; // Will be injected by setter to avoid circular dependency

  // Cache temporário de compras pendentes (em produção, usar Redis)
  private pendingPurchases = new Map<string, PendingPurchase>();
  // Cache de verificações de e-mail aguardando resposta
  private emailVerifications = new Map<string, { chat_id: number; content_id: string; timestamp: number }>();
  // Cache de registros em andamento
  private pendingRegistrations = new Map<string, PendingRegistration>();
  // Cache de pagamentos PIX pendentes
  private pendingPixPayments = new Map<string, { purchase_id: string; chat_id: number; transaction_id: string; timestamp: number }>();
  // Cache de solicitações de conteúdo em andamento
  private pendingContentRequests = new Map<string, PendingRequest>();

  // Polling state
  private pollingOffset = 0;
  private isPolling = false;
  private conflictRetries = 0;
  private readonly MAX_CONFLICT_RETRIES = 10;
  // Deduplication: track processed update/callback IDs to prevent duplicate handling
  private processedUpdates = new Set<number>();
  private processedCallbacks = new Set<string>();
  private readonly MAX_PROCESSED_CACHE = 500;

  constructor(
    private configService: ConfigService,
    private autoLoginService: AutoLoginService,
    private pixProviderFactory: PixProviderFactory,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.webhookSecret = this.configService.get<string>('TELEGRAM_WEBHOOK_SECRET');
    this.botApiUrl = `https://api.telegram.org/bot${this.botToken}`;
    this.apiUrl = this.configService.get<string>('API_URL') || 'http://localhost:3001';

    // Initialize Supabase client
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
                        this.configService.get<string>('SUPABASE_SERVICE_KEY') ||
                        this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);

    // AWS S3 client removed - content delivery via Telegram only
    this.s3Client = null;

    this.logger.log('TelegramsEnhancedService initialized');
    this.logger.log(`Bot token configured: ${!!this.botToken}`);
    this.logger.log(`Supabase configured: ${!!supabaseUrl}`);
    this.logger.log(`S3 client initialized for region: us-east-2`);
  }

  /**
   * Set catalog sync service (called by TelegramCatalogSyncService to avoid circular dependency)
   */
  setCatalogSyncService(service: any) {
    this.catalogSyncService = service;
  }

  // ==================== NOVO FLUXO: VERIFICAÇÃO DE E-MAIL ====================

  /**
   * Verifica se um e-mail existe no sistema CineVision
   */
  async verifyUserEmail(dto: VerifyEmailDto): Promise<VerifyEmailResponseDto> {
    try {
      const { data: user, error } = await this.supabase
        .from('users')
        .select('id, email')
        .eq('email', dto.email)
        .single();

      if (error || !user) {
        return {
          exists: false,
          message: 'E-mail não encontrado no sistema. Você pode comprar sem cadastro!',
        };
      }

      // Atualizar telegram_id se ainda não estiver vinculado
      if (user.id) {
        await this.supabase
          .from('users')
          .update({ telegram_id: dto.telegram_user_id.toString() })
          .eq('id', user.id);
      }

      return {
        exists: true,
        user_id: user.id,
        message: 'E-mail encontrado! Vinculando compra à sua conta...',
      };
    } catch (error) {
      this.logger.error('Error verifying email:', error);
      throw new BadRequestException('Erro ao verificar e-mail');
    }
  }

  // ==================== NOVO FLUXO: COMPRA COM/SEM CONTA ====================

  /**
   * Inicia processo de compra via Telegram Bot
   * Suporta 2 fluxos: COM conta (vincula ao usuário) e SEM conta (anônimo)
   */
  async initiateTelegramPurchase(dto: InitiateTelegramPurchaseDto): Promise<TelegramPurchaseResponseDto> {
    try {
      // 1. Buscar informações do conteúdo
      const { data: content, error: contentError } = await this.supabase
        .from('content')
        .select('*')
        .eq('id', dto.content_id)
        .single();

      if (contentError || !content) {
        throw new NotFoundException('Filme não encontrado');
      }

      // 2. Processar baseado no tipo de compra
      if (dto.purchase_type === PurchaseType.WITH_ACCOUNT) {
        return await this.processPurchaseWithAccount(dto, content);
      } else {
        return await this.processAnonymousPurchase(dto, content);
      }
    } catch (error) {
      this.logger.error('Error initiating Telegram purchase:', error);
      throw error;
    }
  }

  /**
   * Processa compra COM conta (vincula ao usuário existente)
   */
  private async processPurchaseWithAccount(
    dto: InitiateTelegramPurchaseDto,
    content: any,
  ): Promise<TelegramPurchaseResponseDto> {
    if (!dto.user_email) {
      throw new BadRequestException('E-mail é obrigatório para compra com conta');
    }

    // Verificar se usuário existe
    const verification = await this.verifyUserEmail({
      email: dto.user_email,
      telegram_user_id: dto.telegram_user_id,
    });

    if (!verification.exists) {
      throw new NotFoundException('Usuário não encontrado. Use a opção "Não possuo conta"');
    }

    // Calcular preco com desconto
    const { finalPrice } = await this.calculateFinalPrice(content);

    // Criar registro de compra no Supabase
    const { data: purchase, error: purchaseError } = await this.supabase
      .from('purchases')
      .insert({
        user_id: verification.user_id,
        content_id: content.id,
        amount_cents: finalPrice,
        currency: content.currency || 'BRL',
        status: 'pending',
        preferred_delivery: 'telegram',
        provider_meta: {
          telegram_chat_id: dto.chat_id,
          telegram_user_id: dto.telegram_user_id,
        },
      })
      .select()
      .single();

    if (purchaseError || !purchase) {
      throw new BadRequestException('Erro ao criar compra');
    }

    // Salvar no cache temporário
    this.pendingPurchases.set(purchase.id, {
      chat_id: dto.chat_id,
      telegram_user_id: dto.telegram_user_id,
      content_id: content.id,
      purchase_type: dto.purchase_type,
      user_email: dto.user_email,
      user_id: verification.user_id,
      timestamp: Date.now(),
    });

    // Enviar mensagem para escolher método de pagamento
    await this.sendPaymentMethodSelection(parseInt(dto.chat_id), purchase.id, content);

    return {
      purchase_id: purchase.id,
      payment_url: '', // Será gerado quando usuário escolher método
      amount_cents: finalPrice,
      status: 'pending',
      message: `Compra criada! Escolha o método de pagamento.`,
    };
  }

  /**
   * Calcula preco final com desconto ativo (se houver)
   */
  private async calculateFinalPrice(content: any): Promise<{ finalPrice: number; originalPrice: number; discountPercentage: number }> {
    const originalPrice = content.price_cents;
    try {
      const now = new Date().toISOString();
      const { data: activeDiscounts } = await this.supabase
        .from('discounts')
        .select('*')
        .eq('is_active', true)
        .lte('starts_at', now)
        .gte('ends_at', now)
        .order('discount_value', { ascending: false });

      if (activeDiscounts && activeDiscounts.length > 0) {
        let bestDiscount: any = null;

        // 1. Individual discount (for this specific content)
        const individual = activeDiscounts.find(d => d.discount_scope === 'individual' && d.scope_id === content.id);
        if (individual) bestDiscount = individual;

        // 2. Category discount (for any category this content belongs to)
        if (!bestDiscount) {
          const { data: contentCats } = await this.supabase
            .from('content_categories')
            .select('category_id')
            .eq('content_id', content.id);
          const catIds = (contentCats || []).map((cc: any) => cc.category_id);
          if (catIds.length > 0) {
            const categoryDiscount = activeDiscounts.find(d => d.discount_scope === 'category' && catIds.includes(d.scope_id));
            if (categoryDiscount) bestDiscount = categoryDiscount;
          }
        }

        // 3. Global discount
        if (!bestDiscount) {
          const global = activeDiscounts.find(d => d.discount_scope === 'global');
          if (global) bestDiscount = global;
        }

        if (bestDiscount) {
          let finalPrice: number;
          let pct: number;
          if (bestDiscount.discount_type === 'percentage') {
            pct = bestDiscount.discount_value;
            finalPrice = Math.max(0, originalPrice - Math.round(originalPrice * (pct / 100)));
          } else {
            finalPrice = Math.max(0, originalPrice - bestDiscount.discount_value);
            pct = Math.round(((originalPrice - finalPrice) / originalPrice) * 100);
          }
          return { finalPrice, originalPrice, discountPercentage: pct };
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to check discounts: ${err}`);
    }
    return { finalPrice: originalPrice, originalPrice, discountPercentage: 0 };
  }

  /**
   * Envia menu de seleção de método de pagamento
   */
  private async sendPaymentMethodSelection(chatId: number, purchaseId: string, content: any) {
    const { finalPrice, originalPrice, discountPercentage } = await this.calculateFinalPrice(content);
    const priceText = discountPercentage > 0
      ? `~R$ ${(originalPrice / 100).toFixed(2)}~ R$ ${(finalPrice / 100).toFixed(2)} (${discountPercentage}% OFF)`
      : `R$ ${(originalPrice / 100).toFixed(2)}`;

    await this.sendMessage(chatId, `💳 *Escolha o método de pagamento:*\n\n🎬 ${content.title}\n💰 Valor: R$ ${priceText}\n\nSelecione uma opção:`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💳 Cartão de Crédito', callback_data: `pay_stripe_${purchaseId}` },
          ],
          [
            { text: '📱 PIX', callback_data: `pay_pix_${purchaseId}` },
          ],
          [
            { text: '🔙 Cancelar', callback_data: 'catalog' },
          ],
        ],
      },
    });
  }

  /**
   * Processa compra SEM conta (anônima - entrega apenas no Telegram)
   */
  private async processAnonymousPurchase(
    dto: InitiateTelegramPurchaseDto,
    content: any,
  ): Promise<TelegramPurchaseResponseDto> {
    // Calcular preco com desconto
    const { finalPrice } = await this.calculateFinalPrice(content);

    // Criar registro de compra anônima (sem user_id)
    const { data: purchase, error: purchaseError } = await this.supabase
      .from('purchases')
      .insert({
        user_id: null, // Compra anônima
        content_id: content.id,
        amount_cents: finalPrice,
        currency: content.currency || 'BRL',
        status: 'pending',
        preferred_delivery: 'telegram',
        // Armazenar telegram_user_id no provider_meta
        provider_meta: {
          telegram_user_id: dto.telegram_user_id,
          telegram_chat_id: dto.chat_id,
          anonymous_purchase: true,
        },
      })
      .select()
      .single();

    if (purchaseError || !purchase) {
      throw new BadRequestException('Erro ao criar compra');
    }

    // Gerar link de pagamento
    const paymentUrl = await this.generatePaymentUrl(purchase.id, content);

    // Salvar no cache
    this.pendingPurchases.set(purchase.id, {
      chat_id: dto.chat_id,
      telegram_user_id: dto.telegram_user_id,
      content_id: content.id,
      purchase_type: dto.purchase_type,
      timestamp: Date.now(),
    });

    return {
      purchase_id: purchase.id,
      payment_url: paymentUrl,
      amount_cents: finalPrice,
      status: 'pending',
      message: 'Compra sem cadastro. Após o pagamento, você receberá o filme diretamente aqui no chat. Os dados não serão salvos no sistema.',
    };
  }

  /**
   * Gera URL de pagamento via backend API
   */
  private async generatePaymentUrl(purchaseId: string, content: any): Promise<string> {
    try {
      this.logger.log(`Generating payment URL for purchase ${purchaseId}`);

      // Chamar endpoint do backend para criar payment intent no Stripe
      // O backend já configura as URLs corretas de success e cancel com os tokens necessários
      const response = await axios.post(
        `${this.apiUrl}/api/v1/payments/create`,
        {
          purchase_id: purchaseId,
          payment_method: 'card', // Usar cartão como padrão
          // return_url e cancel_url serão gerados automaticamente pelo backend
          // com os tokens e IDs corretos
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(`Payment URL generated successfully: ${response.data.payment_url}`);
      return response.data.payment_url || `${this.apiUrl}/checkout/${purchaseId}`;
    } catch (error) {
      this.logger.error('Error generating payment URL:', error);
      this.logger.error('Error details:', error.response?.data || error.message);
      throw new BadRequestException('Erro ao gerar link de pagamento');
    }
  }

  // ==================== WEBHOOK: CONFIRMAÇÃO DE PAGAMENTO ====================

  /**
   * Processa confirmação de pagamento e entrega o filme
   */
  async handlePaymentConfirmation(purchaseId: string) {
    try {
      const pendingPurchase = this.pendingPurchases.get(purchaseId);

      if (!pendingPurchase) {
        this.logger.warn(`Purchase ${purchaseId} not found in cache`);
        // Tentar buscar do banco
        const { data: purchase } = await this.supabase
          .from('purchases')
          .select('*, content(*)')
          .eq('id', purchaseId)
          .single();

        if (!purchase) {
          throw new NotFoundException('Compra não encontrada');
        }

        // Entregar conteúdo via grupo Telegram + Dashboard (NUNCA no chat privado)
        await this.deliverContentAfterPayment(purchase);
        return;
      }

      // Atualizar status da compra
      await this.supabase
        .from('purchases')
        .update({ status: 'paid' })
        .eq('id', purchaseId);

      // Buscar dados completos
      const { data: purchase } = await this.supabase
        .from('purchases')
        .select('*, content(*)')
        .eq('id', purchaseId)
        .single();

      if (!purchase) {
        throw new NotFoundException('Compra não encontrada');
      }

      // Entregar conteúdo via grupo Telegram + Dashboard (NUNCA no chat privado)
      await this.deliverContentAfterPayment(purchase);

      // Limpar cache
      this.pendingPurchases.delete(purchaseId);
    } catch (error) {
      this.logger.error('Error handling payment confirmation:', error);
      throw error;
    }
  }


  /**
   * Adds a user directly to the Telegram group (requires bot admin with invite permission)
   * @param groupLink - The group's invite link or chat ID
   * @param telegramUserId - Telegram user ID to add
   * @returns true if user was added successfully, false otherwise
   */
  private async addUserToGroup(groupLink: string, telegramUserId: number): Promise<boolean> {
    try {
      this.logger.log(`Attempting to add user ${telegramUserId} to group: ${groupLink}`);

      const chatId = await this.getChatIdFromLink(groupLink);

      if (!chatId) {
        this.logger.warn(`Could not extract chat ID from link: ${groupLink}`);
        return false;
      }

      // Try to add the user directly to the group
      const response = await axios.post(`${this.botApiUrl}/addChatMember`, {
        chat_id: chatId,
        user_id: telegramUserId,
      });

      if (response.data.ok) {
        this.logger.log(`✅ Successfully added user ${telegramUserId} to group ${chatId}`);

        await this.supabase.from('system_logs').insert({
          type: 'telegram_group',
          level: 'info',
          message: `Auto-added user ${telegramUserId} to group ${chatId}`,
        });

        return true;
      } else {
        this.logger.warn(`Could not add user automatically: ${response.data.description}`);
        return false;
      }
    } catch (error) {
      this.logger.warn(`Error adding user to group: ${error.message}`);
      return false;
    }
  }

  /**
   * Creates a single-use invite link for a Telegram group
   * @param groupLink - The group's invite link (e.g., https://t.me/+AbCdEfGhIjK)
   * @param userId - User ID for logging purposes
   * @returns Single-use invite link or null if failed
   */
  private async createInviteLinkForUser(groupLink: string, userId: string): Promise<string | null> {
    try {
      // Extract chat ID from the group link
      // Telegram group links format: https://t.me/+AbCdEfGhIjK or https://t.me/joinchat/AbCdEfGhIjK
      // We need the chat ID to create an invite link
      // For private groups, we'll use the link as-is since we can't get chat_id directly

      this.logger.log(`Creating invite link for user ${userId} to group: ${groupLink}`);

      // Try to get chat from the link
      // Note: This requires the bot to already be in the group
      const chatId = await this.getChatIdFromLink(groupLink);

      if (!chatId) {
        this.logger.error(`Could not extract chat ID from link: ${groupLink}`);

        await this.supabase.from('system_logs').insert({
          type: 'telegram_group',
          level: 'error',
          message: `Failed to extract chat ID from group link for user ${userId}. Link: ${groupLink}`,
        });

        return null;
      }

      // Create invite link with member limit = 1 and expire date = 24 hours
      const expireDate = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours from now

      const response = await axios.post(`${this.botApiUrl}/createChatInviteLink`, {
        chat_id: chatId,
        member_limit: 1, // Only one user can use this link
        expire_date: expireDate,
        name: `Compra - User ${userId.substring(0, 8)}`, // Optional name for the link
      });

      if (response.data.ok) {
        const inviteLink = response.data.result.invite_link;
        this.logger.log(`Created invite link for user ${userId}: ${inviteLink}`);

        await this.supabase.from('system_logs').insert({
          type: 'telegram_group',
          level: 'info',
          message: `Created single-use invite link for user ${userId} to chat ${chatId}`,
        });

        return inviteLink;
      } else {
        this.logger.error(`Failed to create invite link: ${response.data.description}`);

        await this.supabase.from('system_logs').insert({
          type: 'telegram_group',
          level: 'error',
          message: `Failed to create invite link for user ${userId}: ${response.data.description}`,
        });

        return null;
      }
    } catch (error) {
      this.logger.error(`Error creating invite link for user ${userId}:`, error);

      await this.supabase.from('system_logs').insert({
        type: 'telegram_group',
        level: 'error',
        message: `Exception creating invite link for user ${userId}: ${error.message}`,
      });

      return null;
    }
  }

  /**
   * Extracts chat ID from a Telegram group link or ID
   * @param groupLink - The group's invite link, username, or chat ID
   * @returns Chat ID or null if not found
   */
  private async getChatIdFromLink(groupLink: string): Promise<string | null> {
    try {
      // Check if it's already a numeric Chat ID (e.g., -1001234567890)
      if (/^-?\d+$/.test(groupLink.trim())) {
        this.logger.log(`Detected numeric Chat ID: ${groupLink}`);
        return groupLink.trim();
      }

      // For public groups with username (e.g., https://t.me/groupname or @groupname)
      let username: string | null = null;

      // Extract from URL
      const urlMatch = groupLink.match(/https:\/\/t\.me\/([^\/\?+]+)/);
      if (urlMatch && !groupLink.includes('+') && !groupLink.includes('joinchat')) {
        username = urlMatch[1];
      }

      // Extract from @username format
      const atMatch = groupLink.match(/^@?([a-zA-Z0-9_]+)$/);
      if (atMatch) {
        username = atMatch[1];
      }

      if (username) {
        this.logger.log(`Extracted username: ${username}`);

        // Get chat info using username
        const response = await axios.post(`${this.botApiUrl}/getChat`, {
          chat_id: `@${username}`
        });

        if (response.data.ok) {
          const chatId = response.data.result.id.toString();
          this.logger.log(`Retrieved Chat ID from username: ${chatId}`);
          return chatId;
        }
      }

      // For private groups with invite links (https://t.me/+AbCdEfGhIjK)
      // We cannot get chat_id directly from invite links due to Telegram API limitations
      // The admin MUST provide the numeric Chat ID instead
      this.logger.warn(`Cannot extract Chat ID from private group invite link: ${groupLink}`);
      this.logger.warn(`Admin should provide the numeric Chat ID (e.g., -1001234567890) instead of the invite link.`);

      await this.supabase.from('system_logs').insert({
        type: 'telegram_group',
        level: 'warn',
        message: `Failed to extract Chat ID from link: ${groupLink}. Admin should provide numeric Chat ID for private groups.`,
      });

      return null;

    } catch (error) {
      this.logger.error('Error extracting chat ID from link:', error);
      return null;
    }
  }

  // ==================== CALLBACKS DO BOT ====================

  async handleWebhook(webhookData: any, signature?: string) {
    try {
      this.logger.log('🔔 Webhook received:', JSON.stringify(webhookData).substring(0, 200));

      // Validate webhook signature if provided
      if (signature && this.webhookSecret) {
        const isValid = this.validateWebhookSignature(webhookData, signature);
        if (!isValid) {
          this.logger.warn('Invalid webhook signature');
          return { status: 'invalid_signature' };
        }
      }

      // Process different types of updates
      if (webhookData.message) {
        this.logger.log('📩 Processing message update');
        await this.processMessage(webhookData.message);
      } else if (webhookData.callback_query) {
        this.logger.log('🔘 Processing callback query');
        await this.processCallbackQuery(webhookData.callback_query);
      } else {
        this.logger.warn('⚠️ Unknown webhook update type:', Object.keys(webhookData));
      }

      return { status: 'processed' };
    } catch (error) {
      this.logger.error('Error processing webhook:', error);
      return { status: 'error', error: error.message };
    }
  }

  private validateWebhookSignature(data: any, signature: string): boolean {
    const secretKey = createHmac('sha256', 'WebAppData').update(this.webhookSecret).digest();
    const expectedSignature = createHmac('sha256', secretKey)
      .update(JSON.stringify(data))
      .digest('hex');

    return signature === expectedSignature;
  }

  private async processMessage(message: any) {
    const chatId = message.chat.id;
    const text = message.text;
    const telegramUserId = message.from.id;
    const messageId = message.message_id;

    // Deduplicate messages
    const msgKey = `msg_${chatId}_${messageId}`;
    if (this.processedCallbacks.has(msgKey)) {
      this.logger.debug(`Skipping duplicate message ${msgKey}`);
      return;
    }
    this.processedCallbacks.add(msgKey);
    if (this.processedCallbacks.size > this.MAX_PROCESSED_CACHE) {
      const first = this.processedCallbacks.values().next().value;
      this.processedCallbacks.delete(first);
    }

    this.logger.log(`📨 processMessage called - chatId: ${chatId}, text: "${text}", telegramUserId: ${telegramUserId}`);

    // Check if user is blocked before processing any command
    try {
      const { data: userData } = await this.supabase
        .from('users')
        .select('blocked')
        .eq('telegram_id', telegramUserId.toString())
        .single();

      if (userData?.blocked === true) {
        this.logger.warn(`🚫 Blocked user ${telegramUserId} tried to interact`);
        await this.sendMessage(chatId, '🚫 Sua conta foi bloqueada. Entre em contato com o suporte para mais informações.');
        return;
      }
    } catch (e) {
      // User not found yet — allow to proceed (will be created on /start)
    }

    // Register user as active for catalog sync notifications
    if (this.catalogSyncService) {
      this.catalogSyncService.registerActiveUser(chatId, telegramUserId);
    }

    // Verificar se usuário está em processo de solicitação de conteúdo
    const requestKey = `request_${chatId}`;
    const pendingRequest = this.pendingContentRequests.get(requestKey);
    if (pendingRequest && text && !text.startsWith('/')) {
      await this.handleRequestStep(chatId, telegramUserId, text, pendingRequest);
      return;
    }

    if (text?.startsWith('/start')) {
      await this.handleStartCommand(chatId, text, telegramUserId);
    } else if (text === '/catalogo' || text === '/catalog') {
      await this.showCatalog(chatId);
    } else if (text === '/minhas-compras' || text === '/my-purchases') {
      await this.handleMyPurchasesCommand(chatId, telegramUserId);
    } else if (text === '/meu-id' || text === '/my-id') {
      await this.handleMyIdCommand(chatId, telegramUserId);
    } else if (text === '/solicitar' || text === '/request') {
      await this.handleRequestCommand(chatId, telegramUserId);
    } else if (text === '/minhas-solicitacoes' || text === '/my-requests') {
      await this.handleMyRequestsCommand(chatId, telegramUserId);
    } else if (text === '/ajuda' || text === '/help') {
      await this.handleHelpCommand(chatId);
    }
  }

  private async processEmailInput(chatId: number, telegramUserId: number, email: string, contentId: string) {
    try {
      const verification = await this.verifyUserEmail({
        email: email.trim(),
        telegram_user_id: telegramUserId,
      });

      if (verification.exists) {
        await this.sendMessage(chatId, `✅ ${verification.message}\n\n🔐 Gerando link de pagamento...`);

        // Iniciar compra COM conta
        const purchase = await this.initiateTelegramPurchase({
          chat_id: chatId.toString(),
          telegram_user_id: telegramUserId,
          content_id: contentId,
          purchase_type: PurchaseType.WITH_ACCOUNT,
          user_email: email.trim(),
        });

        await this.sendMessage(chatId, `💳 **Link de Pagamento**\n\n${purchase.message}\n\n🔗 Clique no botão abaixo para pagar:`, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💳 Pagar Agora', url: purchase.payment_url }],
            ],
          },
        });
      } else {
        // NOVO FLUXO: Email não encontrado → Sugerir criar conta
        await this.sendMessage(chatId, `❌ E-mail não encontrado!\n\n💡 Crie uma conta agora para continuar:`, {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📝 Criar Conta', callback_data: `create_account_${contentId}` },
                { text: '🔙 Voltar', callback_data: 'catalog' },
              ],
            ],
          },
        });
      }
    } catch (error) {
      this.logger.error('Error processing email input:', error);
      await this.sendMessage(chatId, '❌ Erro ao processar e-mail. Tente novamente.');
    }
  }

  /**
   * Handler para processar cada etapa do registro de conta
   */
  private async handleRegistrationStep(chatId: number, telegramUserId: number, text: string, pendingReg: PendingRegistration) {
    const regKey = `reg_${chatId}`;

    try {
      if (pendingReg.step === 'name') {
        // Validar nome
        if (!text || text.trim().length < 3) {
          await this.sendMessage(chatId, '❌ Nome inválido. Por favor, digite seu nome completo (mínimo 3 caracteres):');
          return;
        }

        // Salvar nome e pedir email
        pendingReg.data.name = text.trim();
        pendingReg.step = 'email';
        this.pendingRegistrations.set(regKey, pendingReg);

        await this.sendMessage(chatId, `✅ Nome: ${text.trim()}\n\n📧 Agora digite seu e-mail:`);

      } else if (pendingReg.step === 'email') {
        // Validar email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(text)) {
          await this.sendMessage(chatId, '❌ E-mail inválido. Por favor, digite um e-mail válido:');
          return;
        }

        // Verificar se email já existe
        const { data: existingUser } = await this.supabase
          .from('users')
          .select('id')
          .eq('email', text.trim())
          .single();

        if (existingUser) {
          await this.sendMessage(chatId, '❌ Este e-mail já está cadastrado! Use a opção "Sim, tenho conta" ou tente outro e-mail.');
          this.pendingRegistrations.delete(regKey);
          return;
        }

        // Salvar email e pedir senha
        pendingReg.data.email = text.trim();
        pendingReg.step = 'password';
        this.pendingRegistrations.set(regKey, pendingReg);

        await this.sendMessage(chatId, `✅ E-mail: ${text.trim()}\n\n🔐 Agora crie uma senha (mínimo 6 caracteres):`);

      } else if (pendingReg.step === 'password') {
        // Validar senha
        if (!text || text.length < 6) {
          await this.sendMessage(chatId, '❌ Senha muito curta. Digite uma senha com pelo menos 6 caracteres:');
          return;
        }

        pendingReg.data.password = text;

        // CRIAR CONTA
        await this.sendMessage(chatId, '⏳ Criando sua conta...');

        const hashedPassword = await bcrypt.hash(text, 12);

        const { data: newUser, error: userError } = await this.supabase
          .from('users')
          .insert({
            name: pendingReg.data.name,
            email: pendingReg.data.email,
            password: hashedPassword,
            telegram_id: telegramUserId.toString(),
            telegram_chat_id: chatId.toString(),
            telegram_username: pendingReg.data.name, // Pode ser atualizado depois
            role: 'user',
            status: 'active',
          })
          .select()
          .single();

        if (userError || !newUser) {
          this.logger.error('Error creating user:', userError);
          await this.sendMessage(chatId, '❌ Erro ao criar conta. Tente novamente mais tarde.');
          this.pendingRegistrations.delete(regKey);
          return;
        }

        // Sucesso!
        await this.sendMessage(chatId, `🎉 **Conta criada com sucesso!**\n\n👤 Nome: ${newUser.name}\n📧 E-mail: ${newUser.email}\n\n✅ Sua conta foi vinculada ao Telegram!`, {
          parse_mode: 'Markdown'
        });

        // Se houver um content_id pendente, iniciar compra
        if (pendingReg.content_id) {
          await this.sendMessage(chatId, '🔐 Gerando link de pagamento...');

          const purchase = await this.initiateTelegramPurchase({
            chat_id: chatId.toString(),
            telegram_user_id: telegramUserId,
            content_id: pendingReg.content_id,
            purchase_type: PurchaseType.WITH_ACCOUNT,
            user_email: newUser.email,
          });

          await this.sendMessage(chatId, `💳 **Link de Pagamento**\n\n${purchase.message}`, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '💳 Pagar Agora', url: purchase.payment_url }],
                [{ text: '🎬 Ver Catálogo', callback_data: 'catalog' }],
              ],
            },
          });
        } else {
          await this.sendMessage(chatId, 'Agora você pode comprar filmes e eles aparecerão automaticamente no seu dashboard!', {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎬 Ver Catálogo', callback_data: 'catalog' }],
                [{ text: '🌐 Acessar Site', url: 'https://cinevision.com' }],
              ],
            },
          });
        }

        // Limpar registro pendente
        this.pendingRegistrations.delete(regKey);
      }
    } catch (error) {
      this.logger.error('Error in registration step:', error);
      await this.sendMessage(chatId, '❌ Erro ao processar registro. Tente novamente com /start');
      this.pendingRegistrations.delete(regKey);
    }
  }

  private async processCallbackQuery(callbackQuery: any) {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const telegramUserId = callbackQuery.from.id;
    const callbackId = callbackQuery.id;

    // Deduplicate callback queries
    if (this.processedCallbacks.has(callbackId)) {
      this.logger.debug(`Skipping duplicate callback ${callbackId}`);
      return;
    }
    this.processedCallbacks.add(callbackId);
    if (this.processedCallbacks.size > this.MAX_PROCESSED_CACHE) {
      const first = this.processedCallbacks.values().next().value;
      this.processedCallbacks.delete(first);
    }

    // Check if user is blocked before processing callback
    try {
      const { data: userData } = await this.supabase
        .from('users')
        .select('blocked')
        .eq('telegram_id', telegramUserId.toString())
        .single();

      if (userData?.blocked === true) {
        this.logger.warn(`🚫 Blocked user ${telegramUserId} tried callback interaction`);
        await this.answerCallbackQuery(callbackId);
        await this.sendMessage(chatId, '🚫 Sua conta foi bloqueada. Entre em contato com o suporte para mais informações.');
        return;
      }
    } catch (e) {
      // User not found — allow
    }

    // Register user as active for catalog sync notifications
    if (this.catalogSyncService) {
      this.catalogSyncService.registerActiveUser(chatId, telegramUserId);
    }

    await this.answerCallbackQuery(callbackId);

    if (data === 'catalog') {
      await this.showCatalog(chatId);
    } else if (data?.startsWith('buy_')) {
      await this.handleBuyCallback(chatId, telegramUserId, data);
    } else if (data?.startsWith('watch_')) {
      await this.handleWatchVideoCallback(chatId, telegramUserId, data);
    } else if (data?.startsWith('pay_pix_')) {
      await this.handlePixPayment(chatId, data);
    } else if (data?.startsWith('pay_stripe_')) {
      await this.handleStripePayment(chatId, data);
    } else if (data?.startsWith('check_pix_')) {
      await this.handleCheckPixPayment(chatId, data);
    } else if (data === 'my_purchases') {
      await this.handleMyPurchasesCommand(chatId, telegramUserId);
    } else if (data === 'help') {
      await this.handleHelpCommand(chatId);
    } else if (data === 'request_type_movie') {
      await this.completeContentRequest(chatId, telegramUserId, 'movie');
    } else if (data === 'request_type_series') {
      await this.completeContentRequest(chatId, telegramUserId, 'series');
    } else if (data === 'request_cancel') {
      const requestKey = `request_${chatId}`;
      this.pendingContentRequests.delete(requestKey);
      await this.sendMessage(chatId, '❌ Solicitação cancelada.', {
        reply_markup: {
          inline_keyboard: [[{ text: '🎬 Ver Catálogo', callback_data: 'catalog' }]]
        }
      });
    } else if (data === 'request_new') {
      await this.handleRequestCommand(chatId, telegramUserId);
    }
  }

  /**
   * Handler para pagamento com Stripe (Cartão)
   */
  private async handleStripePayment(chatId: number, data: string) {
    try {
      const purchaseId = data.replace('pay_stripe_', '');

      await this.sendMessage(chatId, '⏳ Gerando link de pagamento com cartão...');

      // Buscar purchase
      const { data: purchase, error } = await this.supabase
        .from('purchases')
        .select('*, content(*)')
        .eq('id', purchaseId)
        .single();

      if (error || !purchase) {
        await this.sendMessage(chatId, '❌ Compra não encontrada.');
        return;
      }

      // Gerar URL de pagamento Stripe
      const paymentUrl = await this.generatePaymentUrl(purchaseId, purchase.content);

      const content = purchase.content;
      const originalPrice = content.price_cents;
      const finalPrice = purchase.amount_cents;
      const hasDiscount = finalPrice < originalPrice;
      const priceText = hasDiscount
        ? `~R$ ${(originalPrice / 100).toFixed(2)}~ *R$ ${(finalPrice / 100).toFixed(2)}* (${Math.round(((originalPrice - finalPrice) / originalPrice) * 100)}% OFF)`
        : `R$ ${(finalPrice / 100).toFixed(2)}`;

      await this.sendMessage(chatId, `💳 *Pagamento com Cartão*\n\n🎬 ${content.title}\n💰 Valor: ${priceText}\n\nClique no botão abaixo para pagar:`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '💳 Pagar com Cartão', url: paymentUrl }],
            [{ text: '🔙 Voltar', callback_data: 'catalog' }],
          ],
        },
      });
    } catch (error) {
      this.logger.error('Error handling Stripe payment:', error);
      await this.sendMessage(chatId, '❌ Erro ao gerar link de pagamento. Tente novamente.');
    }
  }

  /**
   * Handler para pagamento com PIX
   */
  private async handlePixPayment(chatId: number, data: string) {
    const purchaseId = data.replace('pay_pix_', '');
    try {

      // Cleanup expired cache entries (> 5 min) to prevent stale locks
      const FIVE_MINUTES = 5 * 60 * 1000;
      for (const [key, val] of this.pendingPixPayments.entries()) {
        if (Date.now() - val.timestamp > FIVE_MINUTES) {
          this.logger.log(`🧹 Removing expired PIX cache entry: ${key}`);
          this.pendingPixPayments.delete(key);
        }
      }

      // Prevent duplicate PIX generation for the same purchase
      if (this.pendingPixPayments.has(purchaseId)) {
        this.logger.warn(`PIX already being generated for purchase ${purchaseId}, skipping duplicate`);
        return;
      }
      // Mark as in-progress immediately
      this.pendingPixPayments.set(purchaseId, {
        purchase_id: purchaseId,
        chat_id: chatId,
        transaction_id: 'generating',
        timestamp: Date.now(),
      });

      await this.sendMessage(chatId, '⏳ Gerando QR Code PIX...');

      this.logger.log(`Creating PIX payment for purchase ${purchaseId} via ${this.apiUrl}`);

      // Chamar endpoint para criar pagamento PIX (com timeout maior para cold start do Render)
      const response = await axios.post(
        `${this.apiUrl}/api/v1/payments/pix/create`,
        { purchase_id: purchaseId },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 60000, // 60s timeout para cold start
        }
      );

      this.logger.log(`PIX payment response received: ${JSON.stringify(response.data?.provider_payment_id || 'no id')}`);

      const pixData = response.data;

      // Salvar no cache
      this.pendingPixPayments.set(purchaseId, {
        purchase_id: purchaseId,
        chat_id: chatId,
        transaction_id: pixData.provider_payment_id,
        timestamp: Date.now(),
      });

      // Enviar QR Code como foto (se disponível)
      if (pixData.qr_code_image) {
        try {
          // Converter base64 para Buffer
          const imageBuffer = Buffer.from(pixData.qr_code_image, 'base64');

          // Criar FormData para enviar a imagem
          const FormData = require('form-data');
          const form = new FormData();
          form.append('chat_id', chatId.toString());
          form.append('photo', imageBuffer, {
            filename: 'qrcode.png',
            contentType: 'image/png',
          });
          form.append('caption', `📱 *Pagamento PIX*\n\n💰 Valor: R$ ${pixData.amount_brl}\n⏱️ Válido por: 1 hora\n\n*Como pagar:*\n1. Abra seu app bancário\n2. Escaneie o QR Code acima\n3. Confirme o pagamento\n\nOu use o código Pix Copia e Cola abaixo:`);
          form.append('parse_mode', 'Markdown');

          await axios.post(`${this.botApiUrl}/sendPhoto`, form, {
            headers: form.getHeaders(),
          });

          this.logger.log('QR Code image sent successfully');
        } catch (photoError) {
          this.logger.warn('Could not send QR Code as photo:', photoError.message);
        }
      }

      // Enviar código copia e cola
      await this.sendMessage(chatId, `\`${pixData.copy_paste_code}\``, {
        parse_mode: 'Markdown'
      });

      // Enviar botão "Já paguei"
      await this.sendMessage(chatId, '✅ *Após realizar o pagamento, clique no botão abaixo:*', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Já paguei!', callback_data: `check_pix_${purchaseId}` }],
            [{ text: '❌ Cancelar', callback_data: 'catalog' }],
          ],
        },
      });

    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message || 'Erro desconhecido';
      const statusCode = error.response?.status || 'N/A';
      this.logger.error(`PIX payment error [${statusCode}]: ${errorMsg}`);
      if (error.response?.data) {
        this.logger.error(`PIX API response: ${JSON.stringify(error.response.data)}`);
      }

      let userMessage = '❌ Erro ao gerar QR Code PIX. Por favor, tente novamente ou contate o suporte.';

      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        userMessage = '❌ O servidor demorou para responder. Tente novamente em alguns segundos.';
        this.logger.error('🚨 PIX TIMEOUT - Server may be cold starting');
      } else if (errorMsg.includes('not configured') || errorMsg.includes('não está configurado')) {
        userMessage = '❌ Sistema de pagamento PIX temporariamente indisponível. Contate o suporte.';
        this.logger.error('🚨 PIX PROVIDER NOT CONFIGURED');
      } else if (statusCode === 401 || statusCode === 403 || errorMsg.includes('UNAUTHORIZED')) {
        userMessage = '❌ Erro de autenticação com o provedor de pagamento. Contate o suporte.';
        this.logger.error('🚨 PIX CREDENTIALS INVALID');
      }

      // Remove from cache so user can retry
      this.pendingPixPayments.delete(purchaseId);
      await this.sendMessage(chatId, userMessage);
    }
  }

  /**
   * Handler para verificar se pagamento PIX foi confirmado
   */
  private async handleCheckPixPayment(chatId: number, data: string) {
    try {
      const purchaseId = data.replace('check_pix_', '');

      await this.sendMessage(chatId, '⏳ Verificando pagamento...');

      // Buscar payment no banco (any PIX provider: woovi, pix/oasyfy, etc)
      const { data: payment, error: paymentError } = await this.supabase
        .from('payments')
        .select('*')
        .eq('purchase_id', purchaseId)
        .eq('payment_method', 'pix')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (paymentError || !payment) {
        await this.sendMessage(chatId, '❌ Pagamento PIX não encontrado no sistema.');
        return;
      }

      // Verificar status do pagamento
      if (payment.status === 'completed' || payment.status === 'paid' || payment.status === 'pago') {
        // Buscar dados da compra
        const { data: purchase } = await this.supabase
          .from('purchases')
          .select('*, content(*)')
          .eq('id', purchaseId)
          .single();

        // Idempotency: if already delivered, just confirm to user without re-sending
        if (purchase?.delivery_sent) {
          this.logger.log(`📦 Purchase ${purchaseId} already delivered, sending short confirmation`);
          const frontendUrl = this.configService.get('FRONTEND_URL') || 'https://www.cinevisionapp.com.br';
          const dashboardUrl = `${frontendUrl}/auth/telegram-login?telegram_id=${chatId}&redirect=/dashboard`;
          await this.sendMessage(chatId,
            `✅ *Pagamento já confirmado!*\n\nSeu conteudo ja foi entregue. Acesse pelo botao abaixo.\n\n🛍 Para realizar novas compras no aplicativo, digite /start`,
            { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🎬 Assistir Agora', url: dashboardUrl }]] } }
          );
          this.pendingPixPayments.delete(purchaseId);
          return;
        }

        // Atualizar status da purchase
        await this.supabase
          .from('purchases')
          .update({ status: 'paid', delivery_sent: true })
          .eq('id', purchaseId);

        if (purchase) {
          // Increment sales counters
          try {
            this.logger.log(`Incrementing sales counters for content ${purchase.content_id}`);
            const { error: rpcError } = await this.supabase.rpc('increment_content_sales', {
              content_id: purchase.content_id,
            });

            if (rpcError) {
              this.logger.warn('RPC increment_content_sales not found, using manual update');
              const content = Array.isArray(purchase.content) ? purchase.content[0] : purchase.content;
              await this.supabase
                .from('content')
                .update({
                  weekly_sales: (content?.weekly_sales || 0) + 1,
                  total_sales: (content?.total_sales || 0) + 1,
                  purchases_count: (content?.purchases_count || 0) + 1,
                })
                .eq('id', purchase.content_id);
            }
          } catch (salesError) {
            this.logger.error(`Failed to increment sales counters: ${salesError.message}`);
          }

          // Enviar mensagem UNICA de confirmacao
          const content = Array.isArray(purchase.content) ? purchase.content[0] : purchase.content;
          const contentTitle = content?.title || 'Conteudo';
          const priceText = (purchase.amount_cents / 100).toFixed(2);
          const frontendUrl = this.configService.get('FRONTEND_URL') || 'https://www.cinevisionapp.com.br';
          const dashboardUrl = `${frontendUrl}/auth/telegram-login?telegram_id=${chatId}&redirect=/dashboard`;

          await this.sendMessage(chatId,
            `✅ *Pagamento Confirmado!*\n\n` +
            `🎬 *${contentTitle}*\n` +
            `💰 Valor: R$ ${priceText}\n\n` +
            `Seu conteudo ja esta disponivel! Acesse pelo botao abaixo.\n\n` +
            `🛍 Para realizar novas compras no aplicativo, digite /start`,
            {
              parse_mode: 'Markdown',
              reply_markup: { inline_keyboard: [[{ text: '🎬 Assistir Agora', url: dashboardUrl }]] },
            }
          );
        } else {
          await this.sendMessage(chatId, '✅ *Pagamento Confirmado!*\n\nSeu conteudo esta sendo preparado.\n\n🛍 Para realizar novas compras no aplicativo, digite /start', {
            parse_mode: 'Markdown'
          });
        }

        // Limpar cache
        this.pendingPixPayments.delete(purchaseId);

      } else if (payment.status === 'pending') {
        // Consultar provider PIX diretamente como fallback (webhook pode não ter chegado)
        try {
          const pixProvider = this.pixProviderFactory.getProvider();
          const providerStatus = await pixProvider.getPaymentStatus(payment.provider_payment_id);
          this.logger.log(`Provider status for ${payment.provider_payment_id}: ${providerStatus.status}`);

          if (providerStatus.status === 'approved') {
            // Pagamento confirmado no provider! Atualizar banco
            this.logger.log(`Payment ${payment.provider_payment_id} confirmed by provider. Updating DB...`);

            await this.supabase.from('payments').update({
              status: 'pago',
              paid_at: new Date().toISOString(),
            }).eq('id', payment.id);

            await this.supabase.from('purchases').update({
              status: 'paid',
              delivery_sent: true,
            }).eq('id', purchaseId);

            // Buscar purchase e enviar confirmação
            const { data: confirmedPurchase } = await this.supabase
              .from('purchases').select('*, content(*)').eq('id', purchaseId).single();

            if (confirmedPurchase) {
              const content = Array.isArray(confirmedPurchase.content) ? confirmedPurchase.content[0] : confirmedPurchase.content;
              const contentTitle = content?.title || 'Conteudo';
              const priceText = (confirmedPurchase.amount_cents / 100).toFixed(2);
              const frontendUrl = this.configService.get('FRONTEND_URL') || 'https://www.cinevisionapp.com.br';
              const dashUrl = `${frontendUrl}/auth/telegram-login?telegram_id=${chatId}&redirect=/dashboard`;

              await this.sendMessage(chatId,
                `✅ *Pagamento Confirmado!*\n\n🎬 *${contentTitle}*\n💰 Valor: R$ ${priceText}\n\nSeu conteudo ja esta disponivel! Acesse pelo botao abaixo.\n\n🛍 Para realizar novas compras no aplicativo, digite /start`,
                { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🎬 Assistir Agora', url: dashUrl }]] } }
              );
            }

            this.pendingPixPayments.delete(purchaseId);
            return;
          }
        } catch (providerError) {
          this.logger.error(`Error checking provider status: ${providerError.message}`);
        }

        // Pagamento ainda não confirmado
        await this.sendMessage(chatId, `⏳ *Pagamento Pendente*\n\n⚠️ Ainda não identificamos seu pagamento.\n\n*Possíveis motivos:*\n• O pagamento ainda está sendo processado\n• Você ainda não finalizou o pagamento no app bancário\n\n💡 *O que fazer:*\n• Aguarde alguns minutos e clique em "Já paguei" novamente\n• Certifique-se de ter confirmado o pagamento no app\n• Se o problema persistir, entre em contato com o suporte\n\n📱 ID da transação: \`${payment.provider_payment_id}\``, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Verificar Novamente', callback_data: `check_pix_${purchaseId}` }],
              [{ text: '📞 Suporte', url: 'https://t.me/CineVisionOfc' }],
              [{ text: '🔙 Voltar', callback_data: 'catalog' }],
            ],
          },
        });

      } else {
        // Pagamento com outro status (cancelado, expirado, etc)
        await this.sendMessage(chatId, `❌ *Status do Pagamento: ${payment.status}*\n\nO pagamento não foi confirmado.\n\n💡 Tente fazer uma nova compra ou entre em contato com o suporte.`, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 Voltar ao Catálogo', callback_data: 'catalog' }],
            ],
          },
        });
      }

    } catch (error) {
      this.logger.error('Error checking PIX payment:', error);
      await this.sendMessage(chatId, '❌ Erro ao verificar pagamento. Tente novamente em alguns instantes.');
    }
  }

  /**
   * Handler para quando usuário diz que TEM conta
   */
  private async handleHasAccountCallback(chatId: number, telegramUserId: number, data: string) {
    const contentId = data.replace('has_account_', '');

    await this.sendMessage(chatId, '✉️ Por favor, digite seu e-mail cadastrado:');

    // Guardar no cache que está aguardando email
    this.emailVerifications.set(`email_${chatId}`, {
      chat_id: chatId,
      content_id: contentId,
      timestamp: Date.now(),
    });
  }

  /**
   * Handler para quando usuário quer CRIAR conta
   */
  private async handleCreateAccountCallback(chatId: number, telegramUserId: number, data: string) {
    const contentId = data.replace('create_account_', '');

    await this.sendMessage(chatId, '📝 **Criação de Conta**\n\nVamos criar sua conta em 3 passos simples:\n\n1️⃣ Nome completo\n2️⃣ E-mail\n3️⃣ Senha\n\n👤 Digite seu nome completo:', {
      parse_mode: 'Markdown'
    });

    // Iniciar fluxo de registro
    this.pendingRegistrations.set(`reg_${chatId}`, {
      chat_id: chatId,
      telegram_user_id: telegramUserId,
      content_id: contentId,
      step: 'name',
      data: {},
      timestamp: Date.now(),
    });
  }

  private async handleBuyCallback(chatId: number, telegramUserId: number, data: string) {
    const parts = data.split('_');
    const contentId = parts[parts.length - 1];

    // Buscar info do filme
    const { data: content } = await this.supabase
      .from('content')
      .select('*')
      .eq('id', contentId)
      .single();

    if (!content) {
      await this.sendMessage(chatId, '❌ Filme não encontrado.');
      return;
    }

    // NOVO FLUXO: Autenticação automática via Telegram ID
    await this.sendMessage(chatId, '⏳ Processando sua compra...');

    try {
      // Buscar ou criar usuário automaticamente usando Telegram ID
      const user = await this.findOrCreateUserByTelegramId(telegramUserId, chatId);

      if (!user) {
        await this.sendMessage(chatId, '❌ Erro ao processar usuário. Tente novamente.');
        return;
      }

      // Calcular preco com desconto
      const { finalPrice } = await this.calculateFinalPrice(content);

      // Criar compra com preco final (com desconto se houver)
      const { data: purchase, error: purchaseError } = await this.supabase
        .from('purchases')
        .insert({
          user_id: user.id,
          content_id: content.id,
          amount_cents: finalPrice,
          currency: content.currency || 'BRL',
          status: 'pending',
          preferred_delivery: 'telegram',
          provider_meta: {
            telegram_user_id: telegramUserId,
            telegram_chat_id: chatId.toString(),
          },
        })
        .select()
        .single();

      if (purchaseError || !purchase) {
        this.logger.error('Error creating purchase:', purchaseError);
        await this.sendMessage(chatId, '❌ Erro ao criar compra. Tente novamente.');
        return;
      }

      // Salvar no cache
      this.pendingPurchases.set(purchase.id, {
        chat_id: chatId.toString(),
        telegram_user_id: telegramUserId,
        content_id: content.id,
        purchase_type: PurchaseType.WITH_ACCOUNT,
        user_id: user.id,
        timestamp: Date.now(),
      });

      // Enviar menu de seleção de pagamento
      await this.sendPaymentMethodSelection(chatId, purchase.id, content);

    } catch (error) {
      this.logger.error('Error in handleBuyCallback:', error);
      await this.sendMessage(chatId, '❌ Erro ao processar compra. Tente novamente.');
    }
  }

  /**
   * Busca usuário pelo Telegram ID ou cria um novo automaticamente
   */
  private async findOrCreateUserByTelegramId(telegramUserId: number, chatId: number): Promise<any> {
    try {
      // Tentar buscar usuário existente
      const { data: existingUser } = await this.supabase
        .from('users')
        .select('*')
        .eq('telegram_id', telegramUserId.toString())
        .single();

      if (existingUser) {
        this.logger.log(`User found with telegram_id ${telegramUserId}: ${existingUser.id}`);

        // Buscar dados atualizados do Telegram
        const telegramUserData = await this.getTelegramUserData(chatId);

        // Atualizar dados do usuário se mudaram (chat_id, username, nome)
        const updates: any = {};

        if (existingUser.telegram_chat_id !== chatId.toString()) {
          updates.telegram_chat_id = chatId.toString();
        }

        if (telegramUserData) {
          if (telegramUserData.username && existingUser.telegram_username !== telegramUserData.username) {
            updates.telegram_username = telegramUserData.username;
          }

          const fullName = `${telegramUserData.first_name || ''} ${telegramUserData.last_name || ''}`.trim();
          if (fullName && existingUser.name !== fullName) {
            updates.name = fullName;
          }
        }

        if (Object.keys(updates).length > 0) {
          await this.supabase
            .from('users')
            .update(updates)
            .eq('id', existingUser.id);

          this.logger.log(`Updated user data for telegram_id ${telegramUserId}:`, updates);
        }

        return { ...existingUser, ...updates };
      }

      // Usuário não existe, criar automaticamente
      this.logger.log(`Creating new user for telegram_id ${telegramUserId}`);

      // Buscar dados do Telegram para criar usuário com informações corretas
      const telegramUserData = await this.getTelegramUserData(chatId);

      const userName = telegramUserData
        ? `${telegramUserData.first_name || ''} ${telegramUserData.last_name || ''}`.trim()
        : `Usuário Telegram ${telegramUserId}`;

      const username = telegramUserData?.username || `user_${telegramUserId}`;

      const { data: newUser, error: createError } = await this.supabase
        .from('users')
        .insert({
          telegram_id: telegramUserId.toString(),
          telegram_chat_id: chatId.toString(),
          telegram_username: username,
          name: userName,
          email: `telegram_${telegramUserId}@cinevision.temp`, // Email temporário
          password_hash: await bcrypt.hash(Math.random().toString(36), 12), // Senha aleatória
          role: 'user',
          status: 'active',
        })
        .select()
        .single();

      if (createError || !newUser) {
        this.logger.error('Error creating user:', createError);
        return null;
      }

      this.logger.log(`New user created: ${newUser.id} for telegram_id ${telegramUserId} (${userName})`);
      return newUser;

    } catch (error) {
      this.logger.error('Error in findOrCreateUserByTelegramId:', error);
      return null;
    }
  }

  /**
   * Busca dados do usuário do Telegram via API
   */
  private async getTelegramUserData(chatId: number): Promise<any> {
    try {
      const response = await axios.get(`${this.botApiUrl}/getChat`, {
        params: { chat_id: chatId }
      });

      if (response.data?.ok && response.data?.result) {
        return {
          first_name: response.data.result.first_name,
          last_name: response.data.result.last_name,
          username: response.data.result.username,
        };
      }

      return null;
    } catch (error) {
      this.logger.warn(`Could not fetch Telegram user data for chatId ${chatId}:`, error.message);
      return null;
    }
  }

  private async handleStartCommand(chatId: number, text: string, telegramUserId?: number) {
    this.logger.log(`handleStartCommand called - chatId: ${chatId}, text: "${text}", telegramUserId: ${telegramUserId}`);

    // Buscar ou criar usuário automaticamente
    const user = await this.findOrCreateUserByTelegramId(telegramUserId || chatId, chatId);

    if (!user) {
      await this.sendMessage(chatId, '❌ Erro ao processar usuário. Tente novamente com /start');
      return;
    }

    // Verificar se há parâmetro no /start (deep link para compra direta)
    // Formato: /start buy_CONTENT_ID
    const parts = text.split(' ');
    this.logger.log(`Split text into ${parts.length} parts:`, parts);

    if (parts.length > 1) {
      const param = parts[1];
      this.logger.log(`Deep link parameter found: "${param}"`);

      // Se o parâmetro começa com "buy_", é uma deep link de compra
      if (param.startsWith('buy_')) {
        const contentId = param.replace('buy_', '');
        this.logger.log(`🎬 Deep link detected: buying content ${contentId}`);

        // Processar compra diretamente
        await this.handleBuyCallback(chatId, telegramUserId || chatId, param);
        return;
      }
      // Se o parâmetro começa com "request_", é uma solicitação de conteúdo
      else if (param.startsWith('request_')) {
        try {
          // Decodificar o payload em base64
          const encodedTitle = param.replace('request_', '');
          // Adicionar padding se necessário
          const padding = '='.repeat((4 - (encodedTitle.length % 4)) % 4);
          const decodedTitle = decodeURIComponent(Buffer.from(encodedTitle + padding, 'base64').toString());

          this.logger.log(`📝 Deep link detected: content request for "${decodedTitle}"`);

          // Criar a solicitação diretamente com o título já preenchido
          // Pedir apenas o tipo (filme ou série)
          const requestKey = `request_${chatId}`;
          this.pendingContentRequests.set(requestKey, {
            chat_id: chatId,
            telegram_user_id: telegramUserId || chatId,
            step: 'type',
            data: {
              title: decodedTitle,
            },
            timestamp: Date.now(),
          });

          await this.sendMessage(
            chatId,
            `📝 *Solicitação de Conteúdo*\n\n` +
            `📺 Título: *${decodedTitle}*\n\n` +
            `Que tipo de conteúdo você está procurando?`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '🎬 Filme', callback_data: 'request_type_movie' },
                    { text: '📺 Série', callback_data: 'request_type_series' },
                  ],
                ],
              },
            },
          );
          return;
        } catch (error) {
          this.logger.error(`Error decoding request payload: ${error.message}`);
          await this.sendMessage(chatId, '❌ Erro ao processar solicitação. Por favor, use /solicitar para fazer seu pedido.');
        }
      }
      // Handle payment success redirect from Stripe
      else if (param.startsWith('payment_success_')) {
        const purchaseId = param.replace('payment_success_', '');
        this.logger.log(`✅ Payment success redirect for purchase ${purchaseId}`);

        // Buscar dados da compra para mensagem completa
        const { data: purchase } = await this.supabase
          .from('purchases')
          .select('*, content(*)')
          .eq('id', purchaseId)
          .single();

        if (purchase) {
          const content = Array.isArray(purchase.content) ? purchase.content[0] : purchase.content;
          const contentTitle = content?.title || 'Conteudo';
          const priceText = (purchase.amount_cents / 100).toFixed(2);
          const frontendUrl = this.configService.get('FRONTEND_URL') || 'https://www.cinevisionapp.com.br';
          const dashboardUrl = `${frontendUrl}/auth/telegram-login?telegram_id=${chatId}&redirect=/dashboard`;

          await this.sendMessage(chatId,
            `✅ *Pagamento Confirmado!*\n\n` +
            `🎬 *${contentTitle}*\n` +
            `💰 Valor: R$ ${priceText}\n\n` +
            `Seu conteudo ja esta disponivel! Acesse pelo botao abaixo.\n\n` +
            `🛍 Para realizar novas compras no aplicativo, digite /start`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🎬 Assistir Agora', url: dashboardUrl }],
                ],
              },
            }
          );
        } else {
          await this.sendMessage(chatId,
            '✅ *Pagamento Confirmado!*\n\n' +
            'Seu conteudo esta sendo preparado.\n\n' +
            '🛍 Para realizar novas compras no aplicativo, digite /start',
            { parse_mode: 'Markdown' }
          );
        }
        return;
      }
      // Handle payment cancellation redirect from Stripe
      else if (param.startsWith('payment_cancel_')) {
        const purchaseId = param.replace('payment_cancel_', '');
        this.logger.log(`❌ Payment cancelled for purchase ${purchaseId}`);

        await this.sendMessage(chatId,
          '❌ *Pagamento Cancelado*\n\n' +
          'Não se preocupe! Você pode tentar novamente quando quiser.\n\n' +
          'Use /catalogo para ver os filmes disponíveis ou clique no botão abaixo:',
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎬 Ver Catálogo', callback_data: 'catalog' }],
                [{ text: '📱 Minhas Compras', callback_data: 'my_purchases' }],
              ],
            },
          }
        );
        return;
      } else {
        this.logger.warn(`Parameter "${param}" does not start with "buy_", "request_", "payment_success_" or "payment_cancel_"`);
      }
    } else {
      this.logger.log('No deep link parameter - showing welcome message');
    }

    // Gerar link permanente autenticado do catálogo
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'https://www.cinevisionapp.com.br';
    const catalogUrl = `${frontendUrl}/auth/telegram-login?telegram_id=${user.telegram_id}&redirect=/`;

    const welcomeMessage = `🎬 *Bem-vindo ao CineVision!*

🍿 Seu cinema favorito agora no Telegram!

👤 *Seu ID do Telegram:* \`${telegramUserId}\`
🔐 *Login automático:* Usamos seu ID do Telegram como sua identificação única no sistema!

✨ *Como funciona:*
1️⃣ Navegue pelo nosso catálogo no site
2️⃣ Escolha o filme que deseja
3️⃣ Clique em "Comprar no Telegram"
4️⃣ Finalize o pagamento aqui mesmo (PIX ou Cartão)
5️⃣ Receba o filme instantaneamente!

💡 *Importante:* Todas as suas compras ficam vinculadas ao seu ID do Telegram automaticamente. Não precisa criar senha ou fazer login!

👇 Clique no botão abaixo para ver nosso catálogo:`;

    const siteUrl = process.env.FRONTEND_URL || 'https://www.cinevisionapp.com.br';

    await this.sendMessage(chatId, welcomeMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌐 Ver Catálogo Completo', url: catalogUrl }],
          [{ text: '📱 Minhas Compras', callback_data: 'my_purchases' }],
          [{ text: '❓ Ajuda', callback_data: 'help' }],
        ],
      },
    });
  }

  private async showCatalog(chatId: number) {
    try {
      this.logger.log(`Fetching catalog for chat ${chatId}`);

      // Buscar usuário pelo chat_id
      const { data: user } = await this.supabase
        .from('users')
        .select('id, telegram_id')
        .eq('telegram_chat_id', chatId.toString())
        .single();

      if (!user || !user.telegram_id) {
        await this.sendMessage(chatId, '❌ Usuário não encontrado. Por favor, envie /start para começar.');
        return;
      }

      // Gerar link permanente de auto-login baseado no telegram_id
      const frontendUrl = this.configService.get('FRONTEND_URL') || 'https://www.cinevisionapp.com.br';
      const autoLoginUrl = `${frontendUrl}/auth/telegram-login?telegram_id=${user.telegram_id}&redirect=/`;

      await this.sendMessage(chatId,
        '🎬 *Catálogo de Filmes*\n\n' +
        'Acesse o catálogo completo clicando no botão abaixo.\n\n' +
        'Você será automaticamente conectado e poderá navegar, comprar e assistir filmes!',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎬 Ver Catálogo Completo', url: autoLoginUrl }],
            ],
          },
        }
      );
    } catch (error) {
      this.logger.error('Error showing catalog:', error);
      await this.sendMessage(chatId, '❌ Erro ao carregar catálogo.');
    }
  }

  private async handleMyPurchasesCommand(chatId: number, telegramUserId: number) {
    try {
      // Gerar link da dashboard com autologin baseado no telegram_id
      const frontendUrl = this.configService.get('FRONTEND_URL') || 'https://www.cinevisionapp.com.br';
      const dashboardUrl = `${frontendUrl}/auth/telegram-login?telegram_id=${telegramUserId}&redirect=/dashboard`;

      const message = `📱 *Minhas Compras*

🎬 Acesse sua dashboard para ver todos os filmes e séries que você comprou!

✨ *Recursos da Dashboard:*
• 🎥 Assistir online com player HD
• 📥 Baixar conteúdo
• 📊 Histórico de compras
• 🔐 Acesso automático sem senha

👇 Clique no botão abaixo para acessar:`;

      await this.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎬 Abrir Dashboard', url: dashboardUrl }],
            [{ text: '🔙 Voltar ao Menu', callback_data: 'start' }],
          ],
        },
      });
    } catch (error) {
      this.logger.error('Error sending dashboard link:', error);
      await this.sendMessage(chatId, '❌ Erro ao buscar compras.');
    }
  }

  private async handleMyIdCommand(chatId: number, telegramUserId: number) {
    const message = `👤 *Seu ID do Telegram*

🔢 ID: \`${telegramUserId}\`

ℹ️ *Para que serve?*
• Seu ID é sua identificação única no sistema CineVision
• Todas as compras ficam vinculadas a este ID
• Não precisa criar senha ou fazer login manual
• Use este ID para suporte técnico se necessário

🔐 *Segurança:*
O sistema identifica você automaticamente pelo Telegram, sem necessidade de senhas ou cadastros manuais!`;

    await this.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎬 Ver Catálogo', callback_data: 'catalog' }],
          [{ text: '📱 Minhas Compras', callback_data: 'my_purchases' }],
          [{ text: '🔙 Voltar', callback_data: 'start' }],
        ],
      },
    });
  }

  // ==================== SOLICITAÇÃO DE CONTEÚDO ====================

  /**
   * Comando /solicitar - Inicia o fluxo de solicitação de filme ou série
   */
  private async handleRequestCommand(chatId: number, telegramUserId: number) {
    try {
      const requestKey = `request_${chatId}`;

      // Iniciar novo processo de solicitação
      this.pendingContentRequests.set(requestKey, {
        chat_id: chatId,
        telegram_user_id: telegramUserId,
        step: 'title',
        data: {},
        timestamp: Date.now(),
      });

      await this.sendMessage(chatId,
        `📝 **Solicitar Conteúdo**\n\n` +
        `Por favor, digite o nome do filme ou série que você gostaria de assistir:\n\n` +
        `💡 _Exemplo: Superman 2025, Breaking Bad, etc._`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      this.logger.error('Error in handleRequestCommand:', error);
      await this.sendMessage(chatId, '❌ Erro ao iniciar solicitação. Tente novamente com /solicitar');
    }
  }

  /**
   * Processa cada etapa do fluxo de solicitação
   */
  private async handleRequestStep(chatId: number, telegramUserId: number, text: string, pendingReq: PendingRequest) {
    const requestKey = `request_${chatId}`;

    try {
      if (pendingReq.step === 'title') {
        // Validar título
        if (!text || text.trim().length < 2) {
          await this.sendMessage(chatId, '❌ Título muito curto. Por favor, digite o nome do conteúdo:');
          return;
        }

        // Salvar título e pedir tipo
        pendingReq.data.title = text.trim();
        pendingReq.step = 'type';
        this.pendingContentRequests.set(requestKey, pendingReq);

        await this.sendMessage(chatId,
          `✅ Conteúdo: **${text.trim()}**\n\n` +
          `Agora, selecione o tipo:`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🎬 Filme', callback_data: 'request_type_movie' },
                  { text: '📺 Série', callback_data: 'request_type_series' }
                ],
                [{ text: '🔙 Cancelar', callback_data: 'request_cancel' }]
              ]
            }
          }
        );

      }
    } catch (error) {
      this.logger.error('Error in handleRequestStep:', error);
      this.pendingContentRequests.delete(requestKey);
      await this.sendMessage(chatId, '❌ Erro ao processar solicitação. Tente novamente com /solicitar');
    }
  }

  /**
   * Finaliza a solicitação e salva no banco
   */
  private async completeContentRequest(chatId: number, telegramUserId: number, type: 'movie' | 'series') {
    const requestKey = `request_${chatId}`;
    const pendingReq = this.pendingContentRequests.get(requestKey);

    if (!pendingReq || !pendingReq.data.title) {
      await this.sendMessage(chatId, '❌ Solicitação inválida. Use /solicitar para começar novamente.');
      this.pendingContentRequests.delete(requestKey);
      return;
    }

    try {
      // Buscar ou criar usuário
      const user = await this.findOrCreateUserByTelegramId(telegramUserId, chatId);

      if (!user) {
        await this.sendMessage(chatId, '❌ Erro ao identificar usuário. Tente /start primeiro.');
        return;
      }

      // Criar solicitação no banco
      const { data, error } = await this.supabase
        .from('content_requests')
        .insert({
          requested_title: pendingReq.data.title,
          description: `Tipo: ${type === 'movie' ? 'Filme' : 'Série'}`,
          content_type: type,
          user_id: user.id,
          telegram_chat_id: chatId.toString(),
          status: 'pending',
          notify_when_added: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        this.logger.error('Error creating content request:', error);
        await this.sendMessage(chatId, '❌ Erro ao salvar solicitação. Tente novamente mais tarde.');
        return;
      }

      // Limpar cache
      this.pendingContentRequests.delete(requestKey);

      // Enviar confirmação
      await this.sendMessage(chatId,
        `✅ **Solicitação Enviada!**\n\n` +
        `📽️ Conteúdo: ${pendingReq.data.title}\n` +
        `🎭 Tipo: ${type === 'movie' ? 'Filme' : 'Série'}\n` +
        `👤 ID do Telegram: ${telegramUserId}\n\n` +
        `Sua solicitação foi recebida! Você será notificado aqui no Telegram assim que o conteúdo for adicionado à plataforma.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎬 Ver Catálogo', callback_data: 'catalog' }],
              [{ text: '📝 Nova Solicitação', callback_data: 'request_new' }]
            ]
          }
        }
      );

      this.logger.log(`Content request created: ${pendingReq.data.title} (${type}) by user ${user.id}`);

    } catch (error) {
      this.logger.error('Error completing content request:', error);
      this.pendingContentRequests.delete(requestKey);
      await this.sendMessage(chatId, '❌ Erro ao processar solicitação. Tente novamente com /solicitar');
    }
  }

  /**
   * Comando /minhas-solicitacoes - Lista as solicitações do usuário
   */
  private async handleMyRequestsCommand(chatId: number, telegramUserId: number) {
    try {
      // Buscar usuário
      const user = await this.findOrCreateUserByTelegramId(telegramUserId, chatId);

      if (!user) {
        await this.sendMessage(chatId, '❌ Erro ao identificar usuário. Tente /start primeiro.');
        return;
      }

      // Buscar solicitações do usuário
      const { data: requests, error } = await this.supabase
        .from('content_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        this.logger.error('Error fetching user requests:', error);
        await this.sendMessage(chatId, '❌ Erro ao buscar suas solicitações.');
        return;
      }

      if (!requests || requests.length === 0) {
        await this.sendMessage(chatId,
          `📋 **Minhas Solicitações**\n\n` +
          `Você ainda não fez nenhuma solicitação.\n\n` +
          `Use /solicitar para solicitar um filme ou série!`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[{ text: '📝 Fazer Solicitação', callback_data: 'request_new' }]]
            }
          }
        );
        return;
      }

      // Formatar lista de solicitações
      let message = `📋 **Suas Solicitações** (${requests.length})\n\n`;

      requests.forEach((req, index) => {
        const statusEmoji = req.status === 'pending' ? '⏳' :
                           req.status === 'completed' ? '✅' :
                           req.status === 'in_progress' ? '🔄' : '❌';
        const typeEmoji = req.content_type === 'movie' ? '🎬' : '📺';
        const date = new Date(req.created_at).toLocaleDateString('pt-BR');

        message += `${index + 1}. ${statusEmoji} ${typeEmoji} **${req.requested_title}**\n`;
        message += `   Status: ${this.getStatusText(req.status)}\n`;
        message += `   Data: ${date}\n\n`;
      });

      message += `💡 _Você será notificado quando o conteúdo for adicionado!_`;

      await this.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📝 Nova Solicitação', callback_data: 'request_new' }],
            [{ text: '🎬 Ver Catálogo', callback_data: 'catalog' }]
          ]
        }
      });

    } catch (error) {
      this.logger.error('Error in handleMyRequestsCommand:', error);
      await this.sendMessage(chatId, '❌ Erro ao buscar solicitações. Tente novamente.');
    }
  }

  /**
   * Converte status para texto legível
   */
  private getStatusText(status: string): string {
    const statusMap = {
      'pending': 'Pendente',
      'in_progress': 'Em Andamento',
      'completed': 'Adicionado ✅',
      'rejected': 'Rejeitado',
      'cancelled': 'Cancelado'
    };
    return statusMap[status] || status;
  }

  private async handleHelpCommand(chatId: number) {
    const helpMessage = `🤖 **Comandos Disponíveis:**

/start - Iniciar o bot
/catalogo - Ver filmes disponíveis
/minhas-compras - Ver suas compras
/solicitar - Solicitar filme ou série
/minhas-solicitacoes - Ver suas solicitações
/meu-id - Ver seu ID do Telegram
/ajuda - Mostrar esta ajuda

💡 **Como funciona:**
1️⃣ Escolha um filme do catálogo
2️⃣ Sua conta é criada automaticamente usando seu ID do Telegram
3️⃣ Escolha o método de pagamento (PIX ou Cartão)
4️⃣ Receba o filme aqui no chat e no dashboard!

🔐 **Segurança:**
• Não precisa criar login ou senha
• Seu ID do Telegram funciona como login automático
• Todas as compras ficam vinculadas ao seu perfil

🎬 Aproveite nosso catálogo!`;

    await this.sendMessage(chatId, helpMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎬 Ver Catálogo', callback_data: 'catalog' }],
          [{ text: '🔙 Voltar', callback_data: 'start' }],
        ],
      },
    });
  }

  // Helper methods
  async sendMessage(chatId: number, text: string, options?: any) {
    try {
      const url = `${this.botApiUrl}/sendMessage`;
      const payload = {
        chat_id: chatId,
        text,
        ...options,
      };

      this.logger.log(`Sending message to chat ${chatId}:`, JSON.stringify(payload, null, 2));

      const response = await axios.post(url, payload);
      return response.data;
    } catch (error) {
      this.logger.error('Error sending message:', error);
      this.logger.error('Response data:', error.response?.data);
      this.logger.error('Payload was:', JSON.stringify({
        chat_id: chatId,
        text,
        ...options,
      }, null, 2));
      throw error;
    }
  }

  private async answerCallbackQuery(callbackQueryId: string, text?: string) {
    try {
      const url = `${this.botApiUrl}/answerCallbackQuery`;
      const payload = {
        callback_query_id: callbackQueryId,
        text,
      };

      const response = await axios.post(url, payload);
      return response.data;
    } catch (error) {
      this.logger.error('Error answering callback query:', error);
      throw error;
    }
  }

  async setupWebhook(url: string, secretToken?: string) {
    try {
      const webhookUrl = `${this.botApiUrl}/setWebhook`;
      const payload: any = {
        url,
        allowed_updates: ['message', 'callback_query'],
      };

      if (secretToken) {
        payload.secret_token = secretToken;
      }

      const response = await axios.post(webhookUrl, payload);

      if (response.data.ok) {
        this.logger.log(`Webhook configured successfully: ${url}`);
        return { status: 'success', data: response.data };
      } else {
        this.logger.error('Failed to setup webhook:', response.data);
        return { status: 'error', error: response.data.description };
      }
    } catch (error) {
      this.logger.error('Error setting up webhook:', error);
      return { status: 'error', error: error.message };
    }
  }

  // ==================== VIDEO DELIVERY AFTER PAYMENT ====================

  /**
   * Entrega o conteúdo ao usuário via Telegram após pagamento confirmado
   * Chamado pelo PaymentsService quando purchase status = 'paid'
   *
   * - Se compra COM CONTA: Adiciona ao dashboard + Envia no Telegram
   * - Se compra SEM CONTA: Envia apenas no Telegram
   * - Envia TODOS os idiomas disponíveis (dublado, legendado, etc.)
   */

  /**
   * PUBLIC API: Deliver content to user after successful payment
   * Called by webhook services (Stripe, Woovi) after payment confirmation
   * @param purchase - Purchase object with content_id and provider_meta.telegram_chat_id
   */
  public async deliverContentAfterPayment(purchase: any): Promise<void> {
    try {
      // Idempotency: skip if already delivered
      if (purchase.delivery_sent) {
        this.logger.log(`📦 Content already delivered for purchase ${purchase.id}, skipping (idempotency)`);
        return;
      }

      const chatId = purchase.provider_meta?.telegram_chat_id;
      if (!chatId) {
        this.logger.warn(`No telegram chat_id found in purchase ${purchase.id} provider_meta`);
        return;
      }

      // Mark as delivered BEFORE sending to prevent race conditions
      await this.supabase.from('purchases').update({ delivery_sent: true }).eq('id', purchase.id);

      this.logger.log(`Delivering content to Telegram chat ${chatId} for purchase ${purchase.id}`);

      // Buscar content e languages (including telegram_group_link)
      const { data: content, error: contentError } = await this.supabase
        .from('content')
        .select('*, content_languages(*), telegram_group_link')
        .eq('id', purchase.content_id)
        .single();

      if (contentError || !content) {
        this.logger.error('Content not found:', contentError);
        await this.sendMessage(parseInt(chatId), '❌ Erro ao buscar conteúdo. Entre em contato com suporte.');
        return;
      }

      // Log se não houver idiomas, mas NÃO interrompa o fluxo
      const hasLanguages = content.content_languages && content.content_languages.length > 0;
      if (!hasLanguages) {
        this.logger.warn(`No languages found for content ${purchase.content_id}, but will still check for Telegram group and send dashboard link`);
      }

      // NOVO FLUXO: Todas as compras TÊM conta (não há mais compras anônimas)
      const priceText = (purchase.amount_cents / 100).toFixed(2);

      // Gerar link autenticado do dashboard com a compra
      let dashboardUrl = 'https://cinevision.com/dashboard';
      let tokenGenerated = false;

      try {
        // Buscar usuário para gerar link autenticado
        const { data: user, error: userError } = await this.supabase
          .from('users')
          .select('*')
          .eq('id', purchase.user_id)
          .single();

        if (userError || !user) {
          this.logger.error(`Failed to fetch user ${purchase.user_id} for auto-login token generation:`, userError?.message);

          await this.supabase.from('system_logs').insert({
            type: 'delivery',
            level: 'error',
            message: `Failed to fetch user ${purchase.user_id} for purchase ${purchase.id}: ${userError?.message || 'User not found'}`,
          });
        } else if (!user.telegram_id) {
          this.logger.error(`User ${user.id} has no telegram_id, cannot generate auto-login token`);

          await this.supabase.from('system_logs').insert({
            type: 'delivery',
            level: 'error',
            message: `User ${user.id} (${user.name}) has no telegram_id for purchase ${purchase.id}, auto-login disabled`,
          });
        } else {
          // User found with telegram_id, try to generate token
          this.logger.log(`Generating auto-login token for user ${user.id} (telegram_id: ${user.telegram_id})`);

          try {
            // Generate auto-login link to dashboard
            const token = await this.generatePermanentToken(user.telegram_id);
            const frontendUrl = this.configService.get('FRONTEND_URL') || 'https://www.cinevisionapp.com.br';
            dashboardUrl = `${frontendUrl}/auth/auto-login?token=${token}`;
            tokenGenerated = true;

            this.logger.log(`Auto-login token generated successfully for user ${user.id}`);
          } catch (tokenError) {
            this.logger.error(`Failed to generate auto-login token for user ${user.id}:`, tokenError);

            await this.supabase.from('system_logs').insert({
              type: 'delivery',
              level: 'error',
              message: `Failed to generate auto-login token for user ${user.id} (telegram_id: ${user.telegram_id}): ${tokenError.message}`,
            });

            // Continue with fallback URL
            this.logger.warn('Continuing with fallback dashboard URL (no auto-login)');
          }
        }
      } catch (error) {
        this.logger.error('Unexpected error in auto-login token generation:', error);

        await this.supabase.from('system_logs').insert({
          type: 'delivery',
          level: 'error',
          message: `Unexpected error generating auto-login for purchase ${purchase.id}: ${error.message}`,
        });
      }

      // Enviar mensagem de confirmação com botões inline
      const frontendUrl = this.configService.get('FRONTEND_URL') || 'https://www.cinevisionapp.com.br';
      const catalogUrl = tokenGenerated
        ? dashboardUrl.replace('/dashboard', '/catalog')
        : `${frontendUrl}/catalog`;

      await this.sendMessage(parseInt(chatId),
        `👇 Clique no botão abaixo para ver nosso catálogo:`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🌐 Ver Catálogo Completo', url: catalogUrl }],
              [{ text: '📱 Minhas Compras', url: dashboardUrl }],
              [{ text: '❓ Ajuda', callback_data: 'help' }]
            ]
          }
        }
      );

      // Check if content has Telegram group configured
      let telegramInviteLink: string | null = null;
      let telegramGroupAvailable = false;
      let userAddedAutomatically = false;

      if (content.telegram_group_link) {
        this.logger.log(`Content has Telegram group: ${content.telegram_group_link}`);
        telegramGroupAvailable = true;

        // Get user's telegram_id to add them to the group
        const { data: user } = await this.supabase
          .from('users')
          .select('id, telegram_id')
          .eq('id', purchase.user_id)
          .single();

        if (user && user.telegram_id) {
          // STRATEGY 1: Try to add user automatically to the group
          this.logger.log(`Attempting to add user ${user.telegram_id} automatically to group...`);
          userAddedAutomatically = await this.addUserToGroup(
            content.telegram_group_link,
            parseInt(user.telegram_id)
          );

          if (!userAddedAutomatically) {
            // STRATEGY 2: If automatic add fails, create invite link as fallback
            this.logger.log(`Auto-add failed, creating invite link for purchase ${purchase.id}...`);
            telegramInviteLink = await this.createInviteLinkForUser(content.telegram_group_link, user.id);

            if (telegramInviteLink) {
              this.logger.log(`Created invite link for purchase ${purchase.id}: ${telegramInviteLink}`);
            } else {
              // STRATEGY 3: Last resort - use original group link
              this.logger.warn(`Could not create custom invite link, using original: ${content.telegram_group_link}`);
              telegramInviteLink = content.telegram_group_link;
            }
          }
        }
      }

      // Log successful delivery (mensagem de confirmacao ja enviada pelo handleCheckPixPayment)
      await this.supabase.from('system_logs').insert({
        type: 'delivery',
        level: 'info',
        message: `Delivered content ${content.id} to user ${purchase.user_id} for purchase ${purchase.id} (hasLanguages: ${hasLanguages}, telegramGroupAvailable: ${telegramGroupAvailable})`,
      });

      // Log de entrega
      this.logger.log(`Content delivered to purchase ${purchase.id}: dashboard=${dashboardUrl}, telegram=${telegramGroupAvailable ? 'yes' : 'no'}`);
    } catch (error) {
      this.logger.error('Error delivering content to Telegram:', error);
      // Não fazer throw para não quebrar o webhook do Stripe
    }
  }

  /**
   * Handler para callback de assistir vídeo (watch_<purchase_id>_<language_id>)
   * DESABILITADO: Vídeos agora só estão disponíveis via grupo do Telegram e dashboard
   */
  private async handleWatchVideoCallback(chatId: number, telegramUserId: number, data: string) {
    this.logger.log(`Watch video callback disabled - redirecting to dashboard. Chat: ${chatId}, Data: ${data}`);

    // Redirecionar usuário para o dashboard
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'https://www.cinevisionapp.com.br';
    const dashboardUrl = `${frontendUrl}/auth/telegram-login?telegram_id=${telegramUserId}&redirect=/dashboard`;

    await this.sendMessage(chatId,
      `📱 **Assistir Conteúdo**\n\n✨ Os vídeos estão disponíveis em:\n\n**1️⃣ Grupo do Telegram**\n   Se você comprou um conteúdo com grupo, o vídeo está disponível lá!\n\n**2️⃣ Dashboard Online**\n   Acesse sua dashboard para assistir no navegador\n\n🎬 Clique no botão abaixo para acessar sua dashboard:`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🌐 Abrir Dashboard', url: dashboardUrl }],
            [{ text: '🔙 Voltar ao Menu', callback_data: 'start' }],
          ],
        },
      }
    );
  }

  // ==================== POLLING METHODS ====================

  async onModuleInit() {
    this.logger.log('🤖 Starting Telegram bot...');

    // Use webhook mode in production
    const backendUrl = this.configService.get('BACKEND_URL') || this.configService.get('RENDER_EXTERNAL_URL') || (this.configService.get('NODE_ENV') === 'production' ? 'https://cinevisionn.onrender.com' : null);
    if (backendUrl) {
      // Webhook mode — no 409 conflicts, no duplicate messages
      const webhookUrl = `${backendUrl}/api/v1/telegrams/webhook`;
      try {
        const url = `${this.botApiUrl}/setWebhook`;
        const response = await axios.post(url, {
          url: webhookUrl,
          allowed_updates: ['message', 'callback_query'],
          drop_pending_updates: true,
        });
        if (response.data.ok) {
          this.logger.log(`✅ Webhook set: ${webhookUrl}`);
          return; // Don't start polling — webhook handles everything
        }
        this.logger.warn('Failed to set webhook, falling back to polling:', response.data);
      } catch (error) {
        this.logger.warn(`Webhook setup failed (${error.message}), falling back to polling`);
      }
    }

    // Fallback: polling mode (local dev or webhook failed)
    this.logger.log('Using POLLING mode (no webhook URL available)');
    await this.deleteWebhook();
    await this.skipPendingUpdates();
    this.startPolling();
    this.logger.log('✅ Telegram bot polling started successfully');
  }

  /**
   * Skip all pending Telegram updates so restarts don't reprocess old messages.
   * Calls getUpdates with offset=-1 to get the latest update_id, then sets
   * pollingOffset to lastUpdateId+1 so only NEW updates are processed.
   */
  private async skipPendingUpdates() {
    try {
      const url = `${this.botApiUrl}/getUpdates`;
      const response = await axios.post(url, { offset: -1, limit: 1, timeout: 0 });
      if (response.data.ok && response.data.result.length > 0) {
        const lastUpdate = response.data.result[response.data.result.length - 1];
        this.pollingOffset = lastUpdate.update_id + 1;
        this.logger.log(`⏭️ Skipped pending updates. Polling from offset ${this.pollingOffset}`);
      } else {
        this.logger.log('No pending updates to skip');
      }
    } catch (error) {
      this.logger.error('Error skipping pending updates:', error.message);
    }
  }

  private async deleteWebhook() {
    try {
      const url = `${this.botApiUrl}/deleteWebhook`;
      const response = await axios.post(url, {
        drop_pending_updates: true
      });

      if (response.data.ok) {
        this.logger.log('Webhook deleted successfully');
      } else {
        this.logger.warn('Failed to delete webhook:', response.data);
      }
    } catch (error) {
      this.logger.error('Error deleting webhook:', error.message);
    }
  }

  private startPolling() {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;
    this.poll();
  }

  private async poll() {
    if (!this.isPolling) {
      return;
    }

    try {
      const url = `${this.botApiUrl}/getUpdates`;
      const response = await axios.post(url, {
        offset: this.pollingOffset,
        timeout: 30,
        allowed_updates: ['message', 'callback_query'],
      });

      if (response.data.ok && response.data.result.length > 0) {
        // Reset conflict retries on successful poll
        this.conflictRetries = 0;

        for (const update of response.data.result) {
          await this.handleUpdate(update);
          this.pollingOffset = update.update_id + 1;
        }
      }
    } catch (error) {
      // Handle 409 Conflict error (concurrent polling or webhook active)
      if (error.response?.status === 409) {
        this.conflictRetries++;

        if (this.conflictRetries >= this.MAX_CONFLICT_RETRIES) {
          this.logger.warn(`Max conflict retries (${this.MAX_CONFLICT_RETRIES}) reached. Auto-restarting in 60s...`);
          this.isPolling = false;
          // Auto-restart after 60 seconds cooldown
          setTimeout(() => {
            this.conflictRetries = 0;
            this.logger.log('Auto-restarting polling after cooldown...');
            this.startPolling();
          }, 60000);
          return;
        }

        this.logger.error(`Conflict detected (409): Another instance may be polling (retry ${this.conflictRetries}/${this.MAX_CONFLICT_RETRIES})`);
        this.logger.log('Attempting to delete webhook and retry...');
        await this.deleteWebhook();
        // Wait 10 seconds before retrying to give other instance time to stabilize
        setTimeout(() => this.poll(), 10000);
        return;
      }

      this.logger.error('Polling error:', error.message);
    }

    // Continue polling
    setTimeout(() => this.poll(), 100);
  }

  private async handleUpdate(update: any) {
    // Deduplication: skip if already processed
    if (update.update_id && this.processedUpdates.has(update.update_id)) {
      this.logger.debug(`Skipping duplicate update ${update.update_id}`);
      return;
    }
    if (update.update_id) {
      this.processedUpdates.add(update.update_id);
      // Evict old entries to prevent memory leak
      if (this.processedUpdates.size > this.MAX_PROCESSED_CACHE) {
        const first = this.processedUpdates.values().next().value;
        this.processedUpdates.delete(first);
      }
    }

    try {
      if (update.message) {
        await this.handleMessage(update.message);
      } else if (update.callback_query) {
        await this.handleCallbackQuery(update.callback_query);
      }
    } catch (error) {
      this.logger.error('Error handling update:', error);
    }
  }

  private async handleMessage(message: any) {
    await this.processMessage(message);
  }

  private async handleCallbackQuery(callbackQuery: any) {
    await this.processCallbackQuery(callbackQuery);
  }

  // ==================== TELEGRAM MINI APP ====================

  /**
   * Handle purchase initiated from Telegram Mini App
   * User clicks "Buy" in Mini App, which sends movie info to bot
   */
  async handleMiniAppPurchase(data: {
    telegram_id: number;
    movie_id: string;
    movie_title: string;
    movie_price: number;
    init_data: string;
  }): Promise<any> {
    try {
      this.logger.log(`Mini App purchase request - telegram_id: ${data.telegram_id}, movie_id: ${data.movie_id}`);

      // Validate Telegram init_data (optional but recommended for production)
      // const isValid = this.validateTelegramWebAppData(data.init_data);
      // if (!isValid) {
      //   throw new BadRequestException('Invalid Telegram Web App data');
      // }

      // Find or create user by Telegram ID (same as handleBuyCallback)
      let user = await this.findOrCreateUserByTelegramId(data.telegram_id, data.telegram_id);

      if (!user || !user.telegram_chat_id) {
        throw new NotFoundException('User not found. Please start the bot first with /start');
      }

      const chatId = parseInt(user.telegram_chat_id);

      // Get movie content
      const { data: content, error: contentError } = await this.supabase
        .from('content')
        .select('*')
        .eq('id', data.movie_id)
        .single();

      if (contentError || !content) {
        throw new NotFoundException('Movie not found');
      }

      // Calculate price with active discounts
      const { finalPrice: miniAppFinalPrice } = await this.calculateFinalPrice(content);

      // Create purchase
      const { data: purchase, error: purchaseError } = await this.supabase
        .from('purchases')
        .insert({
          user_id: user.id,
          content_id: content.id,
          amount_cents: miniAppFinalPrice,
          currency: content.currency || 'BRL',
          status: 'pending',
          preferred_delivery: 'telegram',
          provider_meta: {
            telegram_user_id: data.telegram_id,
            telegram_chat_id: chatId.toString(),
            source: 'mini_app',
          },
        })
        .select()
        .single();

      if (purchaseError || !purchase) {
        throw new BadRequestException('Failed to create purchase');
      }

      // Save in cache
      this.pendingPurchases.set(purchase.id, {
        chat_id: chatId.toString(),
        telegram_user_id: data.telegram_id,
        content_id: content.id,
        purchase_type: PurchaseType.WITH_ACCOUNT,
        user_id: user.id,
        timestamp: Date.now(),
      });

      // Send message to bot with payment options
      await this.sendMessage(chatId, `🎬 *Compra via Mini App*\n\n✅ "${content.title}" foi adicionado ao carrinho!\n\n💰 Valor: R$ ${(content.price_cents / 100).toFixed(2)}\n\n👇 Escolha o método de pagamento:`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '💳 Cartão de Crédito', callback_data: `pay_stripe_${purchase.id}` }],
            [{ text: '📱 PIX', callback_data: `pay_pix_${purchase.id}` }],
            [{ text: '🔙 Cancelar', callback_data: 'catalog' }],
          ],
        },
      });

      return {
        success: true,
        message: 'Purchase sent to Telegram bot',
        purchase_id: purchase.id,
      };
    } catch (error) {
      this.logger.error('Error handling Mini App purchase:', error);
      throw error;
    }
  }

  /**
   * Helper method to generate permanent token for Telegram user
   */
  private async generatePermanentToken(telegramId: string): Promise<string> {
    try {
      this.logger.log(`Generating permanent token for telegram_id: ${telegramId}`);

      // Buscar ou criar token permanente para este usuário
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('id')
        .eq('telegram_id', telegramId)
        .single();

      if (userError || !user) {
        this.logger.error(`User not found for telegram_id: ${telegramId}`, userError?.message);

        // Log to system_logs for monitoring
        await this.supabase.from('system_logs').insert({
          type: 'auto_login',
          level: 'error',
          message: `Failed to find user for telegram_id ${telegramId}: ${userError?.message || 'User not found'}`,
        });

        throw new Error(`User not found for telegram_id: ${telegramId}`);
      }

      this.logger.log(`Found user ${user.id}, checking for existing token`);

      // Buscar token existente que ainda é válido
      // IMPORTANTE: Não usar .single() aqui pois pode não existir token ainda
      const { data: existingTokens, error: tokenError } = await this.supabase
        .from('auto_login_tokens')
        .select('token')
        .eq('user_id', user.id)
        .eq('telegram_id', telegramId)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      // Se encontrou token válido, retornar
      if (existingTokens && existingTokens.length > 0) {
        this.logger.log(`Found existing valid token for user ${user.id}`);
        return existingTokens[0].token;
      }

      // Se não existe, criar novo token permanente
      this.logger.log(`No existing token found, creating new one for user ${user.id}`);

      const { token } = await this.autoLoginService.generateAutoLoginToken(
        user.id,
        telegramId,
        '/dashboard'
      );

      this.logger.log(`Successfully created new token for user ${user.id}`);

      // Log success to system_logs
      await this.supabase.from('system_logs').insert({
        type: 'auto_login',
        level: 'info',
        message: `Auto-login token created for telegram_id ${telegramId}, user ${user.id}`,
      });

      return token;
    } catch (error) {
      this.logger.error('Error generating permanent token:', error);

      // Log to system_logs for monitoring
      await this.supabase.from('system_logs').insert({
        type: 'auto_login',
        level: 'error',
        message: `Failed to generate permanent token for telegram_id ${telegramId}: ${error.message}`,
      });

      // Re-throw the error instead of silently returning empty string
      throw error;
    }
  }

  // ==================== ADMIN NOTIFICATIONS ====================

  /**
   * Send notification to admin Telegram chat
   * Used for critical system alerts like failed content deliveries
   */
  async sendAdminNotification(message: string, additionalData?: any): Promise<void> {
    try {
      // Get admin telegram chat ID from environment or admin_settings
      const adminChatId = this.configService.get<string>('ADMIN_TELEGRAM_CHAT_ID');

      if (!adminChatId) {
        this.logger.warn('ADMIN_TELEGRAM_CHAT_ID not configured - cannot send admin notification');
        this.logger.warn('Admin notification message:', message);
        if (additionalData) {
          this.logger.warn('Additional data:', JSON.stringify(additionalData, null, 2));
        }
        return;
      }

      // Format message with timestamp
      const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      let formattedMessage = `🚨 *ADMIN ALERT*\n\n`;
      formattedMessage += `⏰ ${timestamp}\n\n`;
      formattedMessage += message;

      if (additionalData) {
        formattedMessage += `\n\n📊 *Dados Adicionais:*\n`;
        formattedMessage += '```\n';
        formattedMessage += JSON.stringify(additionalData, null, 2);
        formattedMessage += '\n```';
      }

      // Send message to admin
      await this.sendMessage(parseInt(adminChatId), formattedMessage, {
        parse_mode: 'Markdown',
      });

      this.logger.log(`Admin notification sent to chat ${adminChatId}`);
    } catch (error) {
      this.logger.error('Failed to send admin notification:', error.message);
      // Don't throw - notification failure shouldn't break main flow
    }
  }

  /**
   * Send notification about failed content delivery
   */
  async notifyDeliveryFailure(purchase: any, error: any): Promise<void> {
    const errorMessage = error?.message || 'Unknown error';
    const errorStack = error?.stack || 'No stack trace';

    const message = `❌ *Falha na Entrega de Conteúdo*\n\n` +
      `🆔 Purchase ID: \`${purchase.id}\`\n` +
      `👤 User ID: \`${purchase.user_id || 'anonymous'}\`\n` +
      `🎬 Content ID: \`${purchase.content_id}\`\n` +
      `💬 Telegram Chat ID: \`${purchase.provider_meta?.telegram_chat_id || 'N/A'}\`\n\n` +
      `⚠️ *Erro:* ${errorMessage}\n\n` +
      `📋 *Ação Necessária:*\n` +
      `1. Verificar logs do sistema\n` +
      `2. Verificar se o conteúdo existe no S3\n` +
      `3. Tentar reenvio manual se necessário`;

    const additionalData = {
      purchase_id: purchase.id,
      user_id: purchase.user_id,
      content_id: purchase.content_id,
      telegram_chat_id: purchase.provider_meta?.telegram_chat_id,
      error: errorMessage,
      stack: errorStack,
      timestamp: new Date().toISOString(),
    };

    await this.sendAdminNotification(message, additionalData);
  }

}
