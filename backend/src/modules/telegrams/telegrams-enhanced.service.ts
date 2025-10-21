import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as bcrypt from 'bcrypt';
import { AutoLoginService } from '../auth/services/auto-login.service';
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
  // Cache de registros em andamento
  private pendingRegistrations = new Map<string, PendingRegistration>();
  // Cache de pagamentos PIX pendentes
  private pendingPixPayments = new Map<string, { purchase_id: string; chat_id: number; transaction_id: string; timestamp: number }>();

  // Polling state
  private pollingOffset = 0;
  private isPolling = false;

  constructor(
    private configService: ConfigService,
    private autoLoginService: AutoLoginService,
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
      amount_cents: content.price_cents,
      status: 'pending',
      message: `Compra criada! Escolha o método de pagamento.`,
    };
  }

  /**
   * Envia menu de seleção de método de pagamento
   */
  private async sendPaymentMethodSelection(chatId: number, purchaseId: string, content: any) {
    const priceText = (content.price_cents / 100).toFixed(2);

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
      this.logger.log(`Generating payment URL for purchase ${purchaseId}`);

      // Chamar endpoint do backend para criar payment intent no Stripe
      const response = await axios.post(
        `${this.apiUrl}/api/v1/payments/create`,
        {
          purchase_id: purchaseId,
          payment_method: 'card', // Usar cartão como padrão
          return_url: `https://cinevision.com/payment-success`,
          cancel_url: `https://cinevision.com/payment-cancel`,
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
      await this.handleStartCommand(chatId, text, telegramUserId);
    } else if (text === '/catalogo' || text === '/catalog') {
      await this.showCatalog(chatId);
    } else if (text === '/minhas-compras' || text === '/my-purchases') {
      await this.handleMyPurchasesCommand(chatId, telegramUserId);
    } else if (text === '/meu-id' || text === '/my-id') {
      await this.handleMyIdCommand(chatId, telegramUserId);
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

      await this.sendMessage(chatId, `💳 *Pagamento com Cartão*\n\n🎬 ${purchase.content.title}\n💰 Valor: R$ ${(purchase.amount_cents / 100).toFixed(2)}\n\nClique no botão abaixo para pagar:`, {
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
    try {
      const purchaseId = data.replace('pay_pix_', '');

      await this.sendMessage(chatId, '⏳ Gerando QR Code PIX...');

      // Chamar endpoint para criar pagamento PIX
      const response = await axios.post(
        `${this.apiUrl}/api/v1/payments/pix/create`,
        { purchase_id: purchaseId },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

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
      this.logger.error('Error handling PIX payment:', error);
      await this.sendMessage(chatId, '❌ Erro ao gerar QR Code PIX. Verifique se a chave PIX está configurada no admin.');
    }
  }

  /**
   * Handler para verificar se pagamento PIX foi confirmado
   */
  private async handleCheckPixPayment(chatId: number, data: string) {
    try {
      const purchaseId = data.replace('check_pix_', '');

      await this.sendMessage(chatId, '⏳ Verificando pagamento...');

      // Buscar payment no banco
      const { data: payment, error: paymentError } = await this.supabase
        .from('payments')
        .select('*')
        .eq('purchase_id', purchaseId)
        .eq('provider', 'pix')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (paymentError || !payment) {
        await this.sendMessage(chatId, '❌ Pagamento PIX não encontrado no sistema.');
        return;
      }

      // Verificar status do pagamento
      if (payment.status === 'completed' || payment.status === 'paid') {
        // Pagamento confirmado!
        await this.sendMessage(chatId, '🎉 *Pagamento Confirmado!*\n\n✅ Seu pagamento PIX foi aprovado!\n\n⏳ Preparando seu filme...', {
          parse_mode: 'Markdown'
        });

        // Atualizar status da purchase
        await this.supabase
          .from('purchases')
          .update({ status: 'paid' })
          .eq('id', purchaseId);

        // Entregar conteúdo
        const { data: purchase } = await this.supabase
          .from('purchases')
          .select('*, content(*)')
          .eq('id', purchaseId)
          .single();

        if (purchase) {
          await this.deliverContentAfterPayment({
            ...purchase,
            provider_meta: { telegram_chat_id: chatId.toString() }
          });
        }

        // Limpar cache
        this.pendingPixPayments.delete(purchaseId);

      } else if (payment.status === 'pending') {
        // Pagamento ainda não confirmado
        await this.sendMessage(chatId, `⏳ *Pagamento Pendente*\n\n⚠️ Ainda não identificamos seu pagamento.\n\n*Possíveis motivos:*\n• O pagamento ainda está sendo processado\n• Você ainda não finalizou o pagamento no app bancário\n\n💡 *O que fazer:*\n• Aguarde alguns minutos e clique em "Já paguei" novamente\n• Certifique-se de ter confirmado o pagamento no app\n• Se o problema persistir, entre em contato com o suporte\n\n📱 ID da transação: \`${payment.provider_payment_id}\``, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Verificar Novamente', callback_data: `check_pix_${purchaseId}` }],
              [{ text: '📞 Suporte', url: 'https://wa.me/seunumero' }],
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

      // Criar compra automaticamente
      const { data: purchase, error: purchaseError } = await this.supabase
        .from('purchases')
        .insert({
          user_id: user.id,
          content_id: content.id,
          amount_cents: content.price_cents,
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

        // Atualizar chat_id se mudou
        if (existingUser.telegram_chat_id !== chatId.toString()) {
          await this.supabase
            .from('users')
            .update({ telegram_chat_id: chatId.toString() })
            .eq('id', existingUser.id);
        }

        return existingUser;
      }

      // Usuário não existe, criar automaticamente
      this.logger.log(`Creating new user for telegram_id ${telegramUserId}`);

      const { data: newUser, error: createError } = await this.supabase
        .from('users')
        .insert({
          telegram_id: telegramUserId.toString(),
          telegram_chat_id: chatId.toString(),
          telegram_username: `user_${telegramUserId}`,
          name: `Usuário Telegram ${telegramUserId}`,
          email: `telegram_${telegramUserId}@cinevision.temp`, // Email temporário
          password: await bcrypt.hash(Math.random().toString(36), 12), // Senha aleatória
          role: 'user',
          status: 'active',
        })
        .select()
        .single();

      if (createError || !newUser) {
        this.logger.error('Error creating user:', createError);
        return null;
      }

      this.logger.log(`New user created: ${newUser.id} for telegram_id ${telegramUserId}`);
      return newUser;

    } catch (error) {
      this.logger.error('Error in findOrCreateUserByTelegramId:', error);
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
      } else {
        this.logger.warn(`Parameter "${param}" does not start with "buy_"`);
      }
    } else {
      this.logger.log('No deep link parameter - showing welcome message');
    }

    // Gerar link permanente autenticado do catálogo
    const frontendUrl = this.configService.get('FRONTEND_URL');
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

    const siteUrl = process.env.FRONTEND_URL || 'https://cine-vision-murex.vercel.app';

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
      const frontendUrl = this.configService.get('FRONTEND_URL');
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
      // Buscar compras do usuário (pelo telegram_id)
      const { data: user } = await this.supabase
        .from('users')
        .select('id')
        .eq('telegram_id', telegramUserId.toString())
        .single();

      if (!user) {
        await this.sendMessage(chatId, '📭 Você ainda não está cadastrado.\n\n💡 Crie uma conta para fazer compras e acessar seus filmes!');
        return;
      }

      const { data: purchases } = await this.supabase
        .from('purchases')
        .select('*, content(*)')
        .eq('user_id', user.id)
        .in('status', ['paid', 'COMPLETED', 'completed'])
        .order('created_at', { ascending: false });

      if (!purchases || purchases.length === 0) {
        await this.sendMessage(chatId, '📭 Você ainda não tem compras confirmadas.');
        return;
      }

      let message = '📱 **Minhas Compras**\n\n';
      const buttons = [];

      purchases.forEach((purchase, index) => {
        message += `${index + 1}. **${purchase.content.title}**\n`;
        message += `   💰 R$ ${(purchase.amount_cents / 100).toFixed(2)}\n`;
        message += `   📅 ${new Date(purchase.created_at).toLocaleDateString('pt-BR')}\n\n`;

        // Adicionar botão para assistir cada filme
        buttons.push([{
          text: `▶️ Assistir: ${purchase.content.title}`,
          callback_data: `watch_${purchase.id}_default`
        }]);
      });

      // Buscar idiomas disponíveis para cada compra e criar botões
      for (const purchase of purchases) {
        const { data: languages } = await this.supabase
          .from('content_languages')
          .select('*')
          .eq('content_id', purchase.content_id)
          .eq('is_active', true)
          .eq('upload_status', 'completed');

        if (languages && languages.length > 0) {
          const defaultLang = languages.find(l => l.is_default) || languages[0];
          // Atualizar callback_data com o language_id correto
          const buttonIndex = buttons.findIndex(b =>
            b[0].callback_data === `watch_${purchase.id}_default`
          );
          if (buttonIndex >= 0) {
            buttons[buttonIndex][0].callback_data = `watch_${purchase.id}_${defaultLang.id}`;
          }
        }
      }

      buttons.push([{ text: '🌐 Ver no Site', url: 'https://cinevision.com/dashboard' }]);
      buttons.push([{ text: '🔙 Voltar ao Catálogo', callback_data: 'catalog' }]);

      await this.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: buttons,
        },
      });
    } catch (error) {
      this.logger.error('Error fetching purchases:', error);
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

  private async handleHelpCommand(chatId: number) {
    const helpMessage = `🤖 **Comandos Disponíveis:**

/start - Iniciar o bot
/catalogo - Ver filmes disponíveis
/minhas-compras - Ver suas compras
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

      // NOVO FLUXO: Todas as compras TÊM conta (não há mais compras anônimas)
      const priceText = (purchase.amount_cents / 100).toFixed(2);

      // Gerar link autenticado do dashboard com a compra
      let dashboardUrl = 'https://cinevision.com/dashboard';
      try {
        // Buscar usuário para gerar link autenticado
        const { data: user } = await this.supabase
          .from('users')
          .select('*')
          .eq('id', purchase.user_id)
          .single();

        if (user && user.telegram_id) {
          const frontendUrl = this.configService.get('FRONTEND_URL');
          dashboardUrl = `${frontendUrl}/auth/auto-login?token=${await this.generatePermanentToken(user.telegram_id)}`;
        }
      } catch (error) {
        this.logger.warn('Failed to generate auto-login URL, using default:', error);
      }

      await this.sendMessage(parseInt(chatId),
        `🎉 **Pagamento Confirmado!**\n\n✅ Sua compra de "${content.title}" foi aprovada!\n💰 Valor: R$ ${priceText}\n\n🌐 **O filme foi adicionado ao seu dashboard!**\nAcesse em: ${dashboardUrl}\n\n📺 Escolha o idioma para assistir:`,
        { parse_mode: 'Markdown' }
      );

      // Filtrar apenas idiomas ativos com vídeo
      const activeLanguages = content.content_languages.filter(
        (lang: any) => lang.is_active && lang.video_storage_key && lang.upload_status === 'completed'
      );

      if (activeLanguages.length === 0) {
        this.logger.error('No active languages with video_storage_key found');
        await this.sendMessage(parseInt(chatId), '❌ Nenhum vídeo disponível no momento. Entre em contato com suporte.');
        return;
      }

      // Criar botões para TODOS os idiomas disponíveis
      const buttons = [];
      for (const lang of activeLanguages) {
        const langLabel = lang.language_type === 'dubbed' ? '🎙️ Dublado' :
                         lang.language_type === 'subtitled' ? '📝 Legendado' :
                         '🎬 Original';

        buttons.push([{
          text: `${langLabel} - ${lang.language_name || lang.language_code}`,
          callback_data: `watch_${purchase.id}_${lang.id}`
        }]);
      }

      // NOVO FLUXO: Sempre adicionar botão de dashboard (todas compras têm conta)
      buttons.push([{ text: '🌐 Ver no Dashboard (Auto-Login)', url: dashboardUrl }]);

      await this.sendMessage(parseInt(chatId), `🎬 **${activeLanguages.length} idioma(s) disponível(is):**`, {
        reply_markup: {
          inline_keyboard: buttons,
        },
      });

      // Log de entrega
      this.logger.log(`Content delivered: ${activeLanguages.length} language(s) to purchase ${purchase.id}`);
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
    // Check environment to decide between polling or webhook
    const nodeEnv = this.configService.get<string>('NODE_ENV');

    if (nodeEnv === 'production') {
      // In production, use webhook mode (don't start polling)
      this.logger.log('Production mode: Webhook mode enabled (polling disabled)');
      // Webhook should be configured manually via /setup-webhook endpoint
    } else {
      // In development, use polling
      this.logger.log('Development mode: Starting Telegram bot polling...');
      await this.deleteWebhook(); // Remove webhook if exists
      this.startPolling();
    }
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

      // Create purchase
      const { data: purchase, error: purchaseError } = await this.supabase
        .from('purchases')
        .insert({
          user_id: user.id,
          content_id: content.id,
          amount_cents: content.price_cents,
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
      // Buscar ou criar token permanente para este usuário
      const { data: user } = await this.supabase
        .from('users')
        .select('id')
        .eq('telegram_id', telegramId)
        .single();

      if (!user) {
        this.logger.error(`User not found for telegram_id: ${telegramId}`);
        return '';
      }

      // Buscar token existente que ainda é válido
      const { data: existingToken } = await this.supabase
        .from('auto_login_tokens')
        .select('token')
        .eq('user_id', user.id)
        .eq('telegram_id', telegramId)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingToken) {
        return existingToken.token;
      }

      // Se não existe, criar novo token permanente
      const { token } = await this.autoLoginService.generateAutoLoginToken(
        user.id,
        telegramId,
        '/dashboard'
      );

      return token;
    } catch (error) {
      this.logger.error('Error generating permanent token:', error);
      return '';
    }
  }

}
