import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

@Injectable()
export class TelegramsEnhancedService implements OnModuleInit {
  private readonly logger = new Logger(TelegramsEnhancedService.name);
  private readonly botToken: string;
  private readonly webhookSecret: string;
  private readonly botApiUrl: string;
  private readonly supabase: SupabaseClient;
  private readonly apiUrl: string;
  private readonly s3Client: S3Client;
  private catalogSyncService: any; // Will be injected by setter to avoid circular dependency

  // Cache temporário de compras pendentes (em produção, usar Redis)
  private pendingPurchases = new Map<string, PendingPurchase>();
  // Cache de verificações de e-mail aguardando resposta
  private emailVerifications = new Map<string, { chat_id: number; content_id: string; timestamp: number }>();

  // Polling state
  private pollingOffset = 0;
  private isPolling = false;

  constructor(private configService: ConfigService) {
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

    // Initialize S3 client for presigned URLs
    this.s3Client = new S3Client({
      region: 'us-east-2',
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
      },
    });

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

    // Criar registro de compra no Supabase
    const { data: purchase, error: purchaseError } = await this.supabase
      .from('purchases')
      .insert({
        user_id: verification.user_id,
        content_id: content.id,
        amount_cents: content.price_cents,
        currency: content.currency || 'BRL',
        status: 'pending',
        preferred_delivery: 'telegram',
      })
      .select()
      .single();

    if (purchaseError || !purchase) {
      throw new BadRequestException('Erro ao criar compra');
    }

    // Gerar link de pagamento Stripe via API backend
    const paymentUrl = await this.generatePaymentUrl(purchase.id, content);

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

    return {
      purchase_id: purchase.id,
      payment_url: paymentUrl,
      amount_cents: content.price_cents,
      status: 'pending',
      message: `Compra vinculada à conta ${dto.user_email}. Após o pagamento, o filme aparecerá em "Meus Filmes" no site e você receberá o link aqui no Telegram.`,
    };
  }

  /**
   * Processa compra SEM conta (anônima - entrega apenas no Telegram)
   */
  private async processAnonymousPurchase(
    dto: InitiateTelegramPurchaseDto,
    content: any,
  ): Promise<TelegramPurchaseResponseDto> {
    // Criar registro de compra anônima (sem user_id)
    const { data: purchase, error: purchaseError } = await this.supabase
      .from('purchases')
      .insert({
        user_id: null, // Compra anônima
        content_id: content.id,
        amount_cents: content.price_cents,
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
      amount_cents: content.price_cents,
      status: 'pending',
      message: 'Compra sem cadastro. Após o pagamento, você receberá o filme diretamente aqui no chat. Os dados não serão salvos no sistema.',
    };
  }

  /**
   * Gera URL de pagamento via backend API
   */
  private async generatePaymentUrl(purchaseId: string, content: any): Promise<string> {
    try {
      // Chamar endpoint do backend para criar payment intent no Stripe
      const response = await axios.post(
        `${this.apiUrl}/api/v1/payments/create`,
        {
          purchase_id: purchaseId,
          payment_method: 'pix', // ou 'card'
          return_url: `${this.apiUrl}/api/v1/telegram/payment-success`,
          cancel_url: `${this.apiUrl}/api/v1/telegram/payment-cancel`,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data.payment_url || `${this.apiUrl}/checkout/${purchaseId}`;
    } catch (error) {
      this.logger.error('Error generating payment URL:', error);
      // Fallback para URL direta
      return `${this.apiUrl}/checkout/${purchaseId}`;
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

        // Entregar filme baseado no tipo
        await this.deliverMovie(purchase);
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

      // Entregar o filme
      await this.deliverMovie(purchase, pendingPurchase);

      // Limpar cache
      this.pendingPurchases.delete(purchaseId);
    } catch (error) {
      this.logger.error('Error handling payment confirmation:', error);
      throw error;
    }
  }

  /**
   * Entrega o filme via Telegram (com ou sem conta)
   */
  private async deliverMovie(purchase: any, cachedData?: PendingPurchase) {
    const content = purchase.content;
    const chatId = cachedData?.chat_id || purchase.provider_meta?.telegram_chat_id;

    if (!chatId) {
      this.logger.error('No chat_id found for purchase delivery');
      return;
    }

    // Buscar vídeo do filme (versão dublada ou legendada)
    const { data: contentLanguages } = await this.supabase
      .from('content_languages')
      .select('*')
      .eq('content_id', content.id)
      .eq('is_active', true)
      .order('is_default', { ascending: false });

    const videoLanguage = contentLanguages?.[0];

    if (!videoLanguage || !videoLanguage.video_storage_key) {
      await this.sendMessage(parseInt(chatId), `❌ Erro: Vídeo do filme "${content.title}" não disponível. Entre em contato com o suporte.`);
      return;
    }

    // Gerar signed URL do S3 para o vídeo
    const videoUrl = await this.generateSignedVideoUrl(videoLanguage.video_storage_key);

    // Mensagem de confirmação
    const message = `✅ **Pagamento Confirmado!**

🎬 **${content.title}**
${content.description || ''}
💰 Valor pago: R$ ${(purchase.amount_cents / 100).toFixed(2)}

${cachedData?.purchase_type === PurchaseType.WITH_ACCOUNT
  ? '✨ O filme foi adicionado à sua conta! Você pode assistir no site em "Meus Filmes".\n\n'
  : '📱 Você comprou sem cadastro. O filme está disponível apenas neste chat.\n\n'
}🔗 **Link para assistir:** ${videoUrl}

${cachedData?.purchase_type === PurchaseType.WITH_ACCOUNT
  ? '🌐 Acesse também: https://cinevision.com/dashboard'
  : '⚠️ Salve este link! Ele é válido por 7 dias.'
}`;

    await this.sendMessage(parseInt(chatId), message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '▶️ Assistir Agora', url: videoUrl }],
          ...(cachedData?.purchase_type === PurchaseType.WITH_ACCOUNT
            ? [[{ text: '🌐 Ver no Site', url: 'https://cinevision.com/dashboard' }]]
            : []
          ),
        ],
      },
    });
  }

  /**
   * Gera URL assinada do S3 para acesso temporário ao vídeo
   */
  private async generateSignedVideoUrl(storageKey: string): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: 'cinevision-video',
        Key: storageKey,
      });

      // Gerar presigned URL válida por 4 horas (14400 segundos)
      const presignedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 14400,
      });

      this.logger.log(`Generated presigned URL for key: ${storageKey}`);
      return presignedUrl;
    } catch (error) {
      this.logger.error('Error generating signed URL:', error);
      throw new Error('Failed to generate video access URL');
    }
  }

  // ==================== CALLBACKS DO BOT ====================

  async handleWebhook(webhookData: any, signature?: string) {
    try {
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
        await this.processMessage(webhookData.message);
      } else if (webhookData.callback_query) {
        await this.processCallbackQuery(webhookData.callback_query);
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

    // Register user as active for catalog sync notifications
    if (this.catalogSyncService) {
      this.catalogSyncService.registerActiveUser(chatId, telegramUserId);
    }

    if (text?.startsWith('/start')) {
      await this.handleStartCommand(chatId, text);
    } else if (text === '/catalogo' || text === '/catalog') {
      await this.showCatalog(chatId);
    } else if (text === '/minhas-compras' || text === '/my-purchases') {
      await this.handleMyPurchasesCommand(chatId, telegramUserId);
    } else if (text === '/ajuda' || text === '/help') {
      await this.handleHelpCommand(chatId);
    } else {
      // Verificar se está aguardando e-mail
      const key = `email_${chatId}`;
      const verification = this.emailVerifications.get(key);

      if (verification && text?.includes('@')) {
        // Processar e-mail recebido
        await this.processEmailInput(chatId, telegramUserId, text, verification.content_id);
        this.emailVerifications.delete(key);
      }
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
        await this.sendMessage(chatId, `❌ ${verification.message}\n\nDeseja comprar sem cadastro?`, {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Sim, comprar sem cadastro', callback_data: `buy_anon_${contentId}` },
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

  private async processCallbackQuery(callbackQuery: any) {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const telegramUserId = callbackQuery.from.id;

    // Register user as active for catalog sync notifications
    if (this.catalogSyncService) {
      this.catalogSyncService.registerActiveUser(chatId, telegramUserId);
    }

    await this.answerCallbackQuery(callbackQuery.id);

    if (data === 'catalog') {
      await this.showCatalog(chatId);
    } else if (data?.startsWith('buy_')) {
      await this.handleBuyCallback(chatId, telegramUserId, data);
    } else if (data?.startsWith('watch_')) {
      await this.handleWatchVideoCallback(chatId, telegramUserId, data);
    } else if (data === 'my_purchases') {
      await this.handleMyPurchasesCommand(chatId, telegramUserId);
    } else if (data === 'help') {
      await this.handleHelpCommand(chatId);
    }
  }

  private async handleBuyCallback(chatId: number, telegramUserId: number, data: string) {
    const parts = data.split('_');
    const contentId = parts[parts.length - 1];
    const isAnonymous = parts[1] === 'anon';

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

    if (isAnonymous) {
      // Compra anônima direta
      await this.sendMessage(chatId, '🔐 Gerando link de pagamento...');

      const purchase = await this.initiateTelegramPurchase({
        chat_id: chatId.toString(),
        telegram_user_id: telegramUserId,
        content_id: contentId,
        purchase_type: PurchaseType.ANONYMOUS,
      });

      await this.sendMessage(chatId, `💳 **Pagamento Anônimo**\n\n${purchase.message}\n\n💰 Valor: R$ ${(purchase.amount_cents / 100).toFixed(2)}`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '💳 Pagar Agora', url: purchase.payment_url }],
          ],
        },
      });
    } else {
      // Perguntar se possui conta
      await this.sendMessage(chatId, `🎬 **${content.title}**\n\n💰 R$ ${(content.price_cents / 100).toFixed(2)}\n\nVocê já possui uma conta na CineVision?`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Sim, tenho conta', callback_data: `has_account_${contentId}` },
              { text: '🚫 Não possuo conta', callback_data: `buy_anon_${contentId}` },
            ],
            [{ text: '🔙 Voltar ao catálogo', callback_data: 'catalog' }],
          ],
        },
      });
    }
  }

  private async handleStartCommand(chatId: number, text: string) {
    const welcomeMessage = `🎬 **Bem-vindo ao CineVision Bot!**

Aqui você pode:
• 🛒 Comprar filmes
• 📱 Assistir online ou baixar
• 💾 Receber filmes no Telegram
• 🔔 Notificações de lançamentos

Use /catalogo para ver os filmes disponíveis!`;

    await this.sendMessage(chatId, welcomeMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎬 Ver Catálogo', callback_data: 'catalog' }],
          [{ text: '📱 Minhas Compras', callback_data: 'my_purchases' }],
          [{ text: '❓ Ajuda', callback_data: 'help' }],
        ],
      },
    });
  }

  private async showCatalog(chatId: number) {
    try {
      const { data: movies } = await this.supabase
        .from('content')
        .select('*')
        .eq('status', 'PUBLISHED')
        .eq('content_type', 'movie')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!movies || movies.length === 0) {
        await this.sendMessage(chatId, '📭 Catálogo vazio. Em breve teremos novos filmes!');
        return;
      }

      let catalogMessage = '🎬 **Catálogo de Filmes**\n\n';
      const keyboard = [];

      movies.forEach((movie, index) => {
        catalogMessage += `${index + 1}. **${movie.title}**\n`;
        catalogMessage += `   💰 R$ ${(movie.price_cents / 100).toFixed(2)}\n`;
        if (movie.release_year) {
          catalogMessage += `   📅 ${movie.release_year}\n`;
        }
        catalogMessage += '\n';

        keyboard.push([{ text: `🛒 Comprar: ${movie.title}`, callback_data: `buy_${movie.id}` }]);
      });

      await this.sendMessage(chatId, catalogMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: keyboard,
        },
      });
    } catch (error) {
      this.logger.error('Error showing catalog:', error);
      await this.sendMessage(chatId, '❌ Erro ao carregar catálogo.');
    }
  }

  private async handleMyPurchasesCommand(chatId: number, telegramUserId: number) {
    try {
      // Buscar compras do usuário (pelo telegram_id)
      const { data: user } = await this.supabase
        .from('users')
        .select('id')
        .eq('telegram_id', telegramUserId.toString())
        .single();

      if (!user) {
        await this.sendMessage(chatId, '📭 Você ainda não fez nenhuma compra com conta cadastrada.\n\n💡 Compras anônimas não ficam salvas.');
        return;
      }

      const { data: purchases } = await this.supabase
        .from('purchases')
        .select('*, content(*)')
        .eq('user_id', user.id)
        .eq('status', 'paid')
        .order('created_at', { ascending: false });

      if (!purchases || purchases.length === 0) {
        await this.sendMessage(chatId, '📭 Você ainda não tem compras confirmadas.');
        return;
      }

      let message = '📱 **Minhas Compras**\n\n';
      purchases.forEach((purchase, index) => {
        message += `${index + 1}. **${purchase.content.title}**\n`;
        message += `   💰 R$ ${(purchase.amount_cents / 100).toFixed(2)}\n`;
        message += `   📅 ${new Date(purchase.created_at).toLocaleDateString('pt-BR')}\n\n`;
      });

      await this.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🌐 Ver no Site', url: 'https://cinevision.com/dashboard' }],
            [{ text: '🔙 Voltar', callback_data: 'catalog' }],
          ],
        },
      });
    } catch (error) {
      this.logger.error('Error fetching purchases:', error);
      await this.sendMessage(chatId, '❌ Erro ao buscar compras.');
    }
  }

  private async handleHelpCommand(chatId: number) {
    const helpMessage = `🤖 **Comandos Disponíveis:**

/start - Iniciar o bot
/catalogo - Ver filmes disponíveis
/minhas-compras - Ver suas compras
/ajuda - Mostrar esta ajuda

💡 **Como funciona:**
1️⃣ Escolha um filme do catálogo
2️⃣ Decida se quer vincular à sua conta ou comprar sem cadastro
3️⃣ Faça o pagamento via Stripe
4️⃣ Receba o filme aqui no chat!

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

      const response = await axios.post(url, payload);
      return response.data;
    } catch (error) {
      this.logger.error('Error sending message:', error);
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
   */
  async deliverContentAfterPayment(purchase: any): Promise<void> {
    try {
      const chatId = purchase.provider_meta?.telegram_chat_id;
      if (!chatId) {
        this.logger.warn(`No telegram chat_id found in purchase ${purchase.id} provider_meta`);
        return;
      }

      this.logger.log(`Delivering content to Telegram chat ${chatId} for purchase ${purchase.id}`);

      // Buscar content e languages
      const { data: content, error: contentError } = await this.supabase
        .from('content')
        .select('*, content_languages(*)')
        .eq('id', purchase.content_id)
        .single();

      if (contentError || !content) {
        this.logger.error('Content not found:', contentError);
        await this.sendMessage(parseInt(chatId), '❌ Erro ao buscar conteúdo. Entre em contato com suporte.');
        return;
      }

      if (!content.content_languages || content.content_languages.length === 0) {
        this.logger.error('No languages found for content:', purchase.content_id);
        await this.sendMessage(parseInt(chatId), '❌ Vídeo não disponível. Entre em contato com suporte.');
        return;
      }

      // Enviar mensagem de sucesso
      const priceText = (purchase.amount_cents / 100).toFixed(2);
      await this.sendMessage(parseInt(chatId),
        `🎉 **Pagamento Confirmado!**\n\n✅ Sua compra de "${content.title}" foi aprovada!\n💰 Valor: R$ ${priceText}\n\n📺 Escolha o idioma para assistir:`,
        { parse_mode: 'Markdown' }
      );

      // Criar botões para cada idioma disponível
      const buttons = [];
      for (const lang of content.content_languages) {
        if (lang.is_active && lang.video_storage_key) {
          const langLabel = lang.language_type === 'dubbed' ? '🎙️ Dublado' : '📝 Legendado';
          buttons.push([{
            text: `${langLabel} - ${lang.language_code}`,
            callback_data: `watch_${purchase.id}_${lang.id}`
          }]);
        }
      }

      if (buttons.length === 0) {
        this.logger.error('No active languages with video_storage_key found');
        await this.sendMessage(parseInt(chatId), '❌ Nenhum vídeo disponível no momento. Entre em contato com suporte.');
        return;
      }

      await this.sendMessage(parseInt(chatId), '🎬 Clique para assistir:', {
        reply_markup: {
          inline_keyboard: buttons,
        },
      });

      this.logger.log(`Content delivery completed for purchase ${purchase.id}`);
    } catch (error) {
      this.logger.error('Error delivering content to Telegram:', error);
      // Não fazer throw para não quebrar o webhook do Stripe
    }
  }

  /**
   * Handler para callback de assistir vídeo (watch_<purchase_id>_<language_id>)
   */
  private async handleWatchVideoCallback(chatId: number, telegramUserId: number, data: string) {
    try {
      // Extrair IDs: watch_<purchase_id>_<language_id>
      const parts = data.split('_');
      if (parts.length < 3) {
        await this.sendMessage(chatId, '❌ Link inválido.');
        return;
      }

      const purchaseId = parts[1];
      const languageId = parts[2];

      this.logger.log(`Watch request from chat ${chatId}: purchase=${purchaseId}, language=${languageId}`);

      // Verificar se a compra existe e está paga
      const { data: purchase, error: purchaseError } = await this.supabase
        .from('purchases')
        .select('*, content(*)')
        .eq('id', purchaseId)
        .eq('status', 'paid')
        .single();

      if (purchaseError || !purchase) {
        this.logger.warn(`Purchase ${purchaseId} not found or not paid`);
        await this.sendMessage(chatId, '❌ Compra não encontrada ou pagamento não confirmado.');
        return;
      }

      // Buscar language específico
      const { data: language, error: langError } = await this.supabase
        .from('content_languages')
        .select('*')
        .eq('id', languageId)
        .eq('content_id', purchase.content_id)
        .single();

      if (langError || !language || !language.video_storage_key) {
        this.logger.error(`Language ${languageId} not found or no video_storage_key`);
        await this.sendMessage(chatId, '❌ Vídeo não encontrado.');
        return;
      }

      // Gerar presigned URL do S3
      await this.sendMessage(chatId, '⏳ Gerando link de acesso...');

      const videoUrl = await this.generateSignedVideoUrl(language.video_storage_key);

      // Calcular tamanho do arquivo em GB
      const sizeGB = language.file_size_bytes
        ? (language.file_size_bytes / (1024 * 1024 * 1024)).toFixed(2)
        : 'Desconhecido';

      // Enviar link do vídeo
      const message = `🎬 **${purchase.content.title}**\n\n${language.language_name}\n\n📊 Tamanho: ${sizeGB} GB\n⏱️  Link válido por: 4 horas\n\n💡 **Como assistir:**\n• Clique no botão abaixo\n• O vídeo abrirá no navegador\n• Você pode assistir online ou baixar\n\n⚠️ **Importante:**\n• Link expira em 4 horas\n• Você pode solicitar novo link a qualquer momento`;

      await this.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '▶️ Assistir Agora', url: videoUrl }],
            [{ text: '🔄 Gerar Novo Link', callback_data: data }],
            [{ text: '🔙 Minhas Compras', callback_data: 'my_purchases' }],
          ],
        },
      });

      this.logger.log(`Video URL sent to chat ${chatId} for language ${languageId}`);
    } catch (error) {
      this.logger.error('Error handling watch video callback:', error);
      await this.sendMessage(chatId, '❌ Erro ao gerar link do vídeo. Tente novamente em alguns segundos.');
    }
  }

  // ==================== POLLING METHODS ====================

  async onModuleInit() {
    // Start polling for local development
    this.logger.log('Starting Telegram bot polling...');
    await this.deleteWebhook(); // Remove webhook if exists
    this.startPolling();
  }

  private async deleteWebhook() {
    try {
      const url = `${this.botApiUrl}/deleteWebhook`;
      await axios.post(url);
      this.logger.log('Webhook deleted successfully');
    } catch (error) {
      this.logger.error('Error deleting webhook:', error);
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
        for (const update of response.data.result) {
          await this.handleUpdate(update);
          this.pollingOffset = update.update_id + 1;
        }
      }
    } catch (error) {
      this.logger.error('Polling error:', error.message);
    }

    // Continue polling
    setTimeout(() => this.poll(), 100);
  }

  private async handleUpdate(update: any) {
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

}
