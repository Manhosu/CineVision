import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException, OnModuleInit } from '@nestjs/common';
import { createHmac } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';
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
import { getEffectivePriceCents } from '../content/utils/pricing';

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
  // Igor (04/07): OrdersService injetado via setter pro handlePurchaseIntent
  // (Cenário 3) delegar criação de order + PIX. Evita dependência circular
  // entre OrdersModule e TelegramsModule que se importam mutuamente.
  private ordersService: any;

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
  // Cache de usuários aguardando digitar número WhatsApp
  private pendingWhatsappCapture = new Map<number, true>();
  // Igor (15/05): cliente que pagou mas ainda não compartilhou o WhatsApp.
  // Enquanto está aqui, o bot bloqueia o acesso ao grupo até o contato chegar.
  // chatId → { userId, contentId } da compra aguardando liberação.
  private pendingWhatsappGate = new Map<number, { userId: string; contentId: string }>();

  // Polling state
  private pollingOffset = 0;
  private isPolling = false;
  private conflictRetries = 0;
  private readonly MAX_CONFLICT_RETRIES = 10;
  // Deduplication: track processed update/callback IDs to prevent duplicate handling
  private processedUpdates = new Set<number>();
  private processedCallbacks = new Set<string>();
  private readonly MAX_PROCESSED_CACHE = 500;

  // Igor (07/06): cache de tokens dos bots cadastrados em telegram_bots.
  // Suporta múltiplos bots paralelos — cada conteúdo aponta pro bot que
  // é admin do grupo daquele filme (content.delivery_bot_id). Quando o
  // botId é null, usa o bot default (token do env var carregado no
  // constructor abaixo). TTL curto pra refletir mudanças no painel admin
  // sem precisar reiniciar o serviço.
  private botCache = new Map<string, { token: string; apiUrl: string; fetchedAt: number }>();
  private readonly BOT_CACHE_TTL_MS = 5 * 60 * 1000;
  // Cache username por botId para evitar query no DB a cada mensagem
  private botUsernameCache = new Map<string, string>();
  // Cache do UUID do bot padrão (rota legada /webhook sem botId no path)
  private defaultBotIdCache: string | null = null;

  // Igor (07/06): contexto de "qual bot estamos respondendo agora". Setado
  // por handleWebhook(botId) e lido por sendMessage/sendChatAction/etc.
  // Assim cliente que falou no bot 2 recebe resposta DO bot 2 sem precisar
  // propagar botId manualmente em cada chamada de sendMessage no pipeline.
  private readonly botContext = new AsyncLocalStorage<{ botId: string | null }>();
  private currentBotId(): string | null {
    return this.botContext.getStore()?.botId || null;
  }

  // Resolve o UUID do bot atual: usa explicitBotId se passado, cai no ALS,
  // e por último busca o bot padrão pelo token do env (rota legada /webhook).
  private async resolveCurrentBotId(explicitBotId?: string): Promise<string | null> {
    if (explicitBotId) return explicitBotId;
    const fromCtx = this.currentBotId();
    if (fromCtx) return fromCtx;
    if (this.defaultBotIdCache) return this.defaultBotIdCache;
    const defaultToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!defaultToken) return null;
    try {
      const { data } = await this.supabase.from('telegram_bots').select('id').eq('token', defaultToken).single();
      if (data?.id) this.defaultBotIdCache = data.id;
      return data?.id || null;
    } catch {
      return null;
    }
  }

  // Retorna o username real do bot que está respondendo agora (contexto multi-bot).
  // Corrige bug onde bot_username era gravado com o env var em vez do bot real.
  private async currentBotUsername(): Promise<string> {
    const fallback = process.env.TELEGRAM_BOT_USERNAME || 'CineVisionApp_rbot';
    const botId = this.currentBotId();
    if (!botId) return fallback;
    if (this.botUsernameCache.has(botId)) return this.botUsernameCache.get(botId)!;
    try {
      const { data } = await this.supabase.from('telegram_bots').select('username').eq('id', botId).single();
      const username = data?.username || fallback;
      this.botUsernameCache.set(botId, username);
      return username;
    } catch {
      return fallback;
    }
  }

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

  /** Igor (04/07): setter pro OrdersService (Cenário 3 depende dele). */
  setOrdersService(service: any) {
    this.ordersService = service;
  }

  /**
   * Igor reportou (04/05): bot estava enviando link com `cine-vision-murex.vercel.app`
   * em vez do domínio oficial. Causa: env var `FRONTEND_URL` no Render
   * estava com a URL Vercel antiga. Em vez de depender só da env var,
   * sanitizamos: se a URL configurada apontar pra `vercel.app`, ignora
   * e retorna o domínio oficial. Assim o bot fica imune a env var
   * obsoleta sem precisar redeploy.
   */
  private getFrontendUrl(): string {
    const OFFICIAL = 'https://www.cinevisionapp.com.br';
    const configured = this.configService.get<string>('FRONTEND_URL');
    if (!configured) return OFFICIAL;
    if (/vercel\.app/i.test(configured)) {
      this.logger.warn(
        `FRONTEND_URL "${configured}" aponta pra Vercel (legado). Forçando ${OFFICIAL}.`,
      );
      return OFFICIAL;
    }
    return configured;
  }

  /**
   * Igor (07/06): resolve a base URL da Bot API pra um bot específico
   * cadastrado em `telegram_bots`. Quando botId é null/undefined ou
   * resolve pro bot default, retorna `this.botApiUrl` (do env var,
   * bootstrap).
   *
   * Cache em memória com TTL pra não bater no banco a cada chamada;
   * invalidar via `invalidateBotCache(botId)` quando admin editar o bot.
   *
   * Fallback de segurança: se o bot existe mas tem token vazio no banco,
   * cai pro env var atual — mantém o sistema rodando enquanto admin
   * configura tokens corretos via painel.
   */
  private async apiUrlForBot(botId?: string | null): Promise<string> {
    if (!botId) return this.botApiUrl;
    const cached = this.botCache.get(botId);
    if (cached && Date.now() - cached.fetchedAt < this.BOT_CACHE_TTL_MS) {
      return cached.apiUrl;
    }
    try {
      const { data } = await this.supabase
        .from('telegram_bots')
        .select('token, status')
        .eq('id', botId)
        .maybeSingle();
      const token = (data?.token || '').trim() || this.botToken;
      const apiUrl = `https://api.telegram.org/bot${token}`;
      this.botCache.set(botId, { token, apiUrl, fetchedAt: Date.now() });
      return apiUrl;
    } catch (err: any) {
      this.logger.warn(
        `apiUrlForBot(${botId}) lookup failed: ${err.message} — falling back to default bot`,
      );
      return this.botApiUrl;
    }
  }

  /** Igor (07/06): invalida cache de um bot — admin trocou token, etc. */
  public invalidateBotCache(botId?: string) {
    if (!botId) this.botCache.clear();
    else this.botCache.delete(botId);
  }

  /**
   * Igor (04/07): metadata do bot pro branch de bot promocional.
   * Retorna colunas relevantes pro handler de /start decidir se é
   * promo (mensagem CTA) ou oficial (fluxo padrão), e pro handleBuyCallback
   * decidir se desvia pro promo (Cenário 3).
   */
  /**
   * Igor (09/07 + 11/07): resolve bot promocional vinculado a um content pro
   * frontend público. Retorna { available, username, reason }.
   *
   * Guards:
   * - content tem promotional_bot_id
   * - bot promo existe, is_promotional=true, status=active
   * - grace period: bot criado há < PROMO_BOT_GRACE_MS (default 24h) NUNCA
   *   é considerado stale (evita bug do Igor 11/07 — bot recém-cadastrado
   *   caía em stale 5min depois sem tráfego orgânico)
   * - depois do grace: se last_seen_ok_at > PROMO_BOT_STALE_MS (default 30min),
   *   considera stale. Cron @Cron('*_/2 * * * *') no admin-bots.service
   *   refresha via getMe pra bot real ficar sempre fresco.
   *
   * `reason` ajuda no debug no frontend (log console).
   * Não expõe token — só username pra montar t.me/<user>?start=...
   */
  public async getPromoBotForContent(contentId: string): Promise<{
    available: boolean;
    username?: string;
    is_release?: boolean;
    reason?: string;
  }> {
    try {
      const { data: content } = await this.supabase
        .from('content')
        .select('id, promotional_bot_id, is_release')
        .eq('id', contentId)
        .maybeSingle();
      if (!content?.promotional_bot_id) return { available: false, reason: 'no_promo_bot_id' };
      const { data: bot } = await this.supabase
        .from('telegram_bots')
        .select('username, status, is_promotional, last_seen_ok_at, created_at')
        .eq('id', content.promotional_bot_id)
        .maybeSingle();
      if (!bot) return { available: false, reason: 'bot_not_found' };
      if (!bot.is_promotional) return { available: false, reason: 'not_promotional' };
      if (bot.status !== 'active') return { available: false, reason: `status_${bot.status}` };

      // Igor (11/07): grace period. Bot criado nas últimas 24h nunca é stale.
      const GRACE_MS = parseInt(process.env.PROMO_BOT_GRACE_MS || '86400000', 10); // 24h
      const STALE_MS = parseInt(process.env.PROMO_BOT_STALE_MS || '1800000', 10);  // 30min
      const createdMs = bot.created_at
        ? Date.now() - new Date(bot.created_at).getTime()
        : Number.MAX_SAFE_INTEGER;

      if (bot.last_seen_ok_at && createdMs > GRACE_MS) {
        const ageMs = Date.now() - new Date(bot.last_seen_ok_at).getTime();
        if (ageMs > STALE_MS) return { available: false, reason: 'stale' };
      }
      return {
        available: true,
        username: bot.username,
        is_release: !!content.is_release,
        reason: 'ok',
      };
    } catch (err: any) {
      this.logger.warn(`getPromoBotForContent failed: ${err.message}`);
      return { available: false, reason: 'error' };
    }
  }

  public async getBotMeta(botId: string): Promise<{
    id: string;
    username: string;
    display_name: string | null;
    custom_display_name: string | null;
    status: string;
    is_promotional: boolean;
    promotional_content_id: string | null;
    promotional_target_url: string | null;
    last_seen_ok_at: string | null;
  } | null> {
    try {
      const { data } = await this.supabase
        .from('telegram_bots')
        .select('id, username, display_name, custom_display_name, status, is_promotional, promotional_content_id, promotional_target_url, last_seen_ok_at')
        .eq('id', botId)
        .maybeSingle();
      return (data as any) || null;
    } catch (err: any) {
      this.logger.warn(`getBotMeta(${botId}) failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Igor (07/06): atalho — resolve a apiUrl do bot do contexto atual
   * (AsyncLocalStorage do webhook). Se não há contexto, cai no bot default.
   * Use em TODA chamada `axios.post('${this.botApiUrl}/...')` que faz parte
   * de fluxo de webhook, senão a chamada vai sair pelo bot errado e a
   * resposta do cliente é misturada entre bots (BUG do Igor 07/06 noite).
   */
  private async apiUrlForCurrent(): Promise<string> {
    const ctxBotId = this.currentBotId();
    return ctxBotId ? await this.apiUrlForBot(ctxBotId) : this.botApiUrl;
  }

  /**
   * Igor (07/06): sorteia bot ativo de atendimento e retorna deeplink
   * `t.me/<username>?start=<...>`. Usado pelo botão "Comprar no Telegram"
   * do site. Distribui carga entre os N bots ativos (com peso opcional).
   *
   * Se nenhum bot ativo (cenário degenerado), retorna deeplink do bot do
   * env var como fallback. Nunca devolve erro 500 — sempre alguma URL.
   *
   * Quando `startParam` é passado, anexa `?start=<encoded>`. Caso
   * contrário, retorna só o base URL.
   */
  public async getStartDeeplink(startParam?: string): Promise<{ url: string; bot_username: string }> {
    let chosen: { username: string } | null = null;
    try {
      const { data: bots } = await this.supabase
        .from('telegram_bots')
        .select('username, attendance_weight')
        .contains('roles', ['attendance'])
        .eq('status', 'active')
        // Igor (04/07): defesa em profundidade — bots promocionais nunca
        // entram na rotação de atendimento. Constraint SQL já garante isso
        // (bot promo não pode ter role attendance), mas filtro explícito
        // aqui torna a intenção do código evidente.
        .eq('is_promotional', false);
      const pool = (bots || []).filter((b) => (b.attendance_weight ?? 0) > 0);
      if (pool.length) {
        // Sorteio ponderado: soma dos pesos → escolhe ponto aleatório.
        const totalWeight = pool.reduce((acc, b) => acc + (b.attendance_weight || 1), 0);
        let r = Math.random() * totalWeight;
        for (const b of pool) {
          r -= b.attendance_weight || 1;
          if (r <= 0) {
            chosen = { username: b.username };
            break;
          }
        }
        if (!chosen) chosen = { username: pool[pool.length - 1].username };
      }
    } catch (err: any) {
      this.logger.warn(`getStartDeeplink lookup failed: ${err.message} — falling back to env username`);
    }
    const username =
      chosen?.username ||
      this.configService.get<string>('TELEGRAM_BOT_USERNAME') ||
      'CineVisionApp_rbot';
    const base = `https://telegram.me/${username}`;
    const url = startParam
      ? `${base}?start=${encodeURIComponent(startParam)}`
      : base;
    return { url, bot_username: username };
  }

  /**
   * Igor (07/06 noite): rotação round-robin determinística pro botão
   * "Acessar conteúdos" do grupo portal. Diferente do sorteio ponderado
   * acima (que distribui só em média), aqui cada clique vai pro PRÓXIMO
   * bot na sequência: cliente 1 → bot 1, cliente 2 → bot 2, ..., cliente
   * N → bot 1 de novo.
   *
   * Atomicidade garantida pela função SQL increment_bot_rotation()
   * (UPDATE em single row, transação serializável do Postgres).
   */
  async getNextRoundRobinBot(excludeBotIds: string[] = []): Promise<{ url: string; bot_username: string; bot_id?: string }> {
    let chosen: { id: string; username: string } | null = null;
    try {
      const { data: bots } = await this.supabase
        .from('telegram_bots')
        .select('id, username, attendance_weight')
        .contains('roles', ['attendance'])
        .eq('status', 'active')
        // Igor (04/07): promos fora da rotação (defesa em profundidade).
        .eq('is_promotional', false)
        .order('id', { ascending: true });
      let pool = (bots || []).filter((b) => (b.attendance_weight ?? 0) > 0);
      // Cenário 3: excluir bots específicos (ex: bot promo que já
      // entregou a mensagem — cliente precisa cair em outro oficial).
      if (excludeBotIds.length) {
        pool = pool.filter((b) => !excludeBotIds.includes(b.id));
      }

      if (pool.length) {
        const { data: counter, error } = await this.supabase.rpc('increment_bot_rotation');
        if (error) throw error;
        const idx = Number(counter ?? 0) % pool.length;
        chosen = { id: pool[idx].id, username: pool[idx].username };
      }
    } catch (err: any) {
      this.logger.warn(`getNextRoundRobinBot failed: ${err.message} — falling back to env username`);
    }
    const finalUsername =
      chosen?.username ||
      this.configService.get<string>('TELEGRAM_BOT_USERNAME') ||
      'CineVisionApp_rbot';
    return { url: `https://telegram.me/${finalUsername}`, bot_username: finalUsername, bot_id: chosen?.id };
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
   * Igor (13/07): resolve o melhor desconto ATIVO pra um content, sem
   * aplicar preço. Individual > category > global (ordem fixa).
   *
   * Extraído de calculateFinalPrice pra poder ser chamado também por
   * createIntentForSiteVisitor e detourPurchaseToPromoBot, garantindo
   * que TODOS os pontos usem o mesmo helper de preço.
   */
  public async resolveActiveDiscount(content: { id: string }): Promise<{ discount_percentage: number; is_flash: boolean } | null> {
    try {
      const now = new Date().toISOString();
      const { data: activeDiscounts } = await this.supabase
        .from('discounts')
        .select('*')
        .eq('is_active', true)
        .lte('starts_at', now)
        .gte('ends_at', now)
        .order('discount_value', { ascending: false });

      if (!activeDiscounts || activeDiscounts.length === 0) return null;

      let best: any = null;
      const individual = activeDiscounts.find((d: any) => d.discount_scope === 'individual' && d.scope_id === content.id);
      if (individual) best = individual;

      if (!best) {
        const { data: contentCats } = await this.supabase
          .from('content_categories')
          .select('category_id')
          .eq('content_id', content.id);
        const catIds = (contentCats || []).map((cc: any) => cc.category_id);
        if (catIds.length > 0) {
          const cat = activeDiscounts.find((d: any) => d.discount_scope === 'category' && catIds.includes(d.scope_id));
          if (cat) best = cat;
        }
      }

      if (!best) {
        const global = activeDiscounts.find((d: any) => d.discount_scope === 'global');
        if (global) best = global;
      }

      if (!best) return null;

      // Normalizar pro formato PricingDiscount: só percentage é suportado pelo helper.
      // Fixed → converte pra percentage aproximado (mantém compat com fluxos legados).
      // Sem price_cents aqui, o caller cuida — se é fixed, retornamos com pct calculado no chamador.
      if (best.discount_type === 'percentage') {
        return { discount_percentage: best.discount_value, is_flash: !!best.is_flash };
      }
      // Fixed discount: emula como percentage sobre price_cents. Requer content.price_cents.
      // (fluxo original também fazia isso — melhor deixar o caller consultar caso queira.)
      return { discount_percentage: 0, is_flash: !!best.is_flash };
    } catch (err) {
      this.logger.warn(`Failed to check discounts: ${err}`);
      return null;
    }
  }

  /**
   * Calcula preco final RESPEITANDO pré-venda + descontos.
   *
   * Igor (13/07): agora delega pro helper getEffectivePriceCents (ordem
   * canônica: presale > discount > full). Antes ignorava is_presale e
   * cobrava desconto sobre o preço cheio em filme de pré-venda (bug
   * mostrado pelo Igor no áudio 3).
   */
  public async calculateFinalPrice(content: any): Promise<{ finalPrice: number; originalPrice: number; discountPercentage: number }> {
    const originalPrice = content.price_cents;
    const discount = await this.resolveActiveDiscount(content);
    const eff = getEffectivePriceCents(content, discount);
    return {
      finalPrice: eff.priceCents,
      originalPrice,
      discountPercentage: eff.discountPercent || 0,
    };
  }

  /**
   * Envia menu de seleção de método de pagamento
   */
  private async sendPaymentMethodSelection(chatId: number, purchaseId: string, content: any) {
    const { finalPrice, originalPrice, discountPercentage } = await this.calculateFinalPrice(content);
    const priceText = discountPercentage > 0
      ? `~R$ ${(originalPrice / 100).toFixed(2)}~ R$ ${(finalPrice / 100).toFixed(2)} (${discountPercentage}% OFF)`
      : `R$ ${(originalPrice / 100).toFixed(2)}`;

    // Cleanup any previous step messages for this chat first
    await this.cleanupTrackedMessages(chatId);

    await this.sendTrackedMessage(
      chatId,
      `💳 *Escolha o método de pagamento:*\n\n🎬 ${content.title}\n💰 Valor: R$ ${priceText}\n\nSelecione uma opção:`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '💳 Cartão de Crédito', callback_data: `pay_stripe_${purchaseId}` }],
            [{ text: '📱 PIX', callback_data: `pay_pix_${purchaseId}` }],
            [{ text: '🔙 Cancelar', callback_data: 'catalog' }],
          ],
        },
      },
      'payment_choice',
    );
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

      // Try to add the user directly to the group — usa bot do contexto
      // do webhook (se houver), senão default.
      const addApiUrl = await this.apiUrlForCurrent();
      const response = await axios.post(`${addApiUrl}/addChatMember`, {
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
  /**
   * Re-acesso pelo dashboard (Igor pediu): cliente que já comprou clica
   * em "Assistir" no Dashboard → backend valida ownership da purchase
   * paga, gera invite single-use de 24h. Cliente entra no grupo, mesmo
   * se saiu antes, sem expor link permanente que dá pra encaminhar.
   *
   * Throws ForbiddenException se o user não comprou esse content.
   */
  async getOrCreateAccessLinkForPurchasedContent(
    userId: string,
    contentId: string,
  ): Promise<{
    link: string;
    fixedLink?: string | null;
    expiresInHours?: number;
    mode: 'single_use' | 'fallback_raw' | 'fallback_regular';
  }> {
    // 1. Valida que o user tem purchase paga desse content.
    const { data: purchases } = await this.supabase
      .from('purchases')
      .select('id, status')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .in('status', ['paid', 'PAID', 'completed', 'COMPLETED'])
      .limit(1);

    if (!purchases || purchases.length === 0) {
      throw new ForbiddenException('Você não tem acesso a este conteúdo.');
    }

    // 2. Lê os 2 campos relacionados ao Telegram do conteúdo.
    // Igor (07/05): split de `telegram_group_link` em 2 colunas:
    //   - `telegram_chat_id`: Chat ID numérico (opcional, pra invite auto)
    //   - `telegram_group_link`: link de convite t.me/+ regular (fallback)
    const { data: content } = await this.supabase
      .from('content')
      .select('telegram_chat_id, telegram_group_link, delivery_bot_id')
      .eq('id', contentId)
      .maybeSingle();

    const chatId = content?.telegram_chat_id?.trim() || null;
    const regularLink = content?.telegram_group_link?.trim() || null;
    // Igor (07/06): bot admin do grupo (multi-bot).
    const deliveryBotId = (content as any)?.delivery_bot_id || null;

    // Caso de compatibilidade: row antiga com Chat ID gravado em
    // `telegram_group_link` (antes da migration 20260507) — detecta e
    // trata como Chat ID. Quando chat_id está null mas group_link tem
    // formato Chat ID puro, usa group_link como Chat ID.
    let chatIdToTry = chatId;
    if (!chatIdToTry && regularLink && /^-?\d{6,}$/.test(regularLink)) {
      chatIdToTry = regularLink;
    }

    // 3. Se temos Chat ID, tenta gerar invite single-use 24h.
    if (chatIdToTry) {
      const single = await this.createInviteLinkForUser(chatIdToTry, userId, deliveryBotId);
      if (single) {
        // N6 (Igor 04/05): além do single-use, gerar tb um link fixo com
        // `creates_join_request: true`. Se o cliente compartilhar esse
        // link com terceiros, eles caem numa fila pra Igor aprovar
        // manualmente. Falha em gerar o fixo não bloqueia o single-use.
        const fixed = await this.createFixedRequestJoinLink(chatIdToTry, userId, deliveryBotId).catch(() => null);
        return { link: single, fixedLink: fixed, expiresInHours: 24, mode: 'single_use' };
      }
      // Bot não é admin do grupo OU chat not found.
      // Igor (07/05): em vez de erro, cai pro fallback regular abaixo.
    }

    // 4. Fallback: link de convite regular (t.me/+...) se cadastrado.
    // Funciona em qualquer caso: Chat ID falhou OU sem Chat ID. Aceita
    // qualquer string que abra no Telegram (link privado, username
    // público, deep link). O frontend `openContentGroup` lida com isso.
    if (regularLink && regularLink !== chatIdToTry) {
      // Igor (14/07): normaliza link — se admin cadastrou "t.me/+xxx"
      // sem https://, o browser trata como URL relativa e cliente que
      // clicou "Assistir" caía em DNS_PROBE_FINISHED_NXDOMAIN.
      // Sanitização em 2 camadas (aqui e no TelegramAccessModal).
      const normalized = /^(https?:\/\/|tg:\/\/)/i.test(regularLink)
        ? regularLink
        : `https://${regularLink}`;
      return { link: normalized, fixedLink: null, mode: 'fallback_regular' };
    }

    // 5. Sem Chat ID válido (bot não admin) E sem link regular → erro
    // claro pra Igor saber que precisa cadastrar um link de convite.
    if (chatIdToTry) {
      throw new BadRequestException(
        'Não consegui gerar acesso ao grupo. Verifique se @CineVisionApp_rbot é admin do grupo, OU cadastre um link de convite (telegram.me/+...) no painel do conteúdo como fallback.',
      );
    }
    throw new BadRequestException('Conteúdo sem grupo do Telegram configurado.');
  }

  /**
   * N6 (Igor 04/05): envia mensagem com 2 botões de acesso ao grupo
   * (single-use 24h + fixo request-to-join) pro telegram chat do cliente.
   * Usado pelos paths de confirmação de pagamento (webhook + "Já paguei").
   * Falha em qualquer parte é apenas logada, não propaga.
   */
  async sendGroupAccessLinks(
    chatId: number,
    userId: string,
    contentId: string,
  ): Promise<void> {
    try {
      const access = await this.getOrCreateAccessLinkForPurchasedContent(userId, contentId).catch(
        (err) => {
          this.logger.warn(`sendGroupAccessLinks: getAccess failed (user=${userId}, content=${contentId}): ${err.message}`);
          return null;
        },
      );
      if (!access?.link) return;

      // Igor (08/05): trocar nome do botao "Acesso Pessoal (compartilhavel)"
      // pra "Acesso Fixo" e ajustar copy reforcando que NAO e compartilhavel
      // (link vinculado a compra; quem usar fora vai pra malha fina).
      const buttons: Array<Array<{ text: string; url: string }>> = [
        [{ text: '🔑 Entrar no Grupo', url: access.link }],
      ];
      if (access.fixedLink) {
        buttons.push([{ text: '📌 Acesso Fixo', url: access.fixedLink }]);
      }

      // Igor (08/05): adicionar link de "Minhas Compras" pra cliente ter
      // acesso permanente via dashboard. Se ele nunca usou o bot, o
      // telegram-login captura o telegram_id no clique. Reusa o mesmo
      // pattern do handleMyPurchasesCommand.
      const frontendUrl = this.getFrontendUrl();
      const dashboardUrl = `${frontendUrl}/auth/telegram-login?telegram_id=${chatId}&redirect=/dashboard`;
      buttons.push([{ text: '🎬 Minhas Compras', url: dashboardUrl }]);

      const fixedDescription = access.fixedLink
        ? `\n📌 *Acesso Fixo*: link permanente pra você assistir outras vezes o conteúdo. Você usará esse link pra não perder acesso ao filme.\n\n⚠ *Se você compartilhar esse link com outra pessoa, essa pessoa irá cair numa malha fina. Não compartilhe.*`
        : '';
      await this.sendMessage(
        chatId,
        `🎬 *Acesso ao Grupo do Telegram*\n\n` +
          `🔑 *Entrar no Grupo*: clique no botão abaixo pra entrar agora.\n\n` +
          `⚠️ *Atenção:* este LINK de entrada expira em 24h por segurança. Mas depois que você entrar no grupo, seu acesso ao filme/série é *VITALÍCIO* — pode assistir quando e quantas vezes quiser.${fixedDescription}\n\n` +
          `🎬 *Minhas Compras*: acesse a dashboard a qualquer momento pra rever todos os filmes que você comprou.\n\n` +
          `_Não compartilhe esses links — eles estão vinculados à sua compra._`,
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: buttons },
        },
      );
    } catch (err: any) {
      this.logger.warn(`sendGroupAccessLinks failed (chat=${chatId}, content=${contentId}): ${err.message}`);
    }
  }

  /**
   * Igor (17/05): o botão "Assistir" do dashboard/home dispara o envio
   * dos links de acesso ao grupo NO TELEGRAM do cliente — em vez de
   * abrir aba no navegador (o `window.open` causava tela branca
   * `about:blank` travada em mobile e o problema de "3-4 toques").
   *
   * Fluxo:
   *  1. Valida ownership reusando `getOrCreateAccessLinkForPurchasedContent`
   *     (purchase paga). Se o cliente não comprou → lança ForbiddenException.
   *  2. Busca o chat do Telegram do cliente logado (`telegram_chat_id`,
   *     com `telegram_id` como fallback — em chat privado são iguais).
   *  3. Tem Telegram → o bot manda os botões de acesso (link 24h + fixo) no
   *     DM do cliente via `sendGroupAccessLinks`. Retorna `{ sent: true, link }`.
   *  4. Sem Telegram (cliente web puro) → retorna `{ sent: false, link }`.
   *
   * O `link` volta nos DOIS casos: o frontend abre o modal `TelegramAccessModal`
   * com um botão direto pro grupo (Igor 17/05 — o leigo não percebia só o toast).
   */
  async sendAccessToUser(
    userId: string,
    contentId: string,
  ): Promise<{ sent: boolean; link?: string }> {
    // 1. Valida ownership + gera o link. Lança ForbiddenException se o
    //    cliente não comprou (ou BadRequestException se sem grupo).
    const access = await this.getOrCreateAccessLinkForPurchasedContent(userId, contentId);

    // 2. Busca o chat do Telegram do cliente logado.
    const { data: user } = await this.supabase
      .from('users')
      .select('telegram_chat_id, telegram_id')
      .eq('id', userId)
      .maybeSingle();

    const chatIdRaw =
      (user?.telegram_chat_id && String(user.telegram_chat_id).trim()) ||
      (user?.telegram_id && String(user.telegram_id).trim()) ||
      '';
    const chatId = chatIdRaw ? parseInt(chatIdRaw, 10) : NaN;

    // 3. Cliente com Telegram → o bot manda os links no DM dele.
    if (chatIdRaw && !Number.isNaN(chatId)) {
      await this.sendGroupAccessLinks(chatId, userId, contentId);
      return { sent: true, link: access.link };
    }

    // 4. Cliente sem Telegram vinculado → devolve o link pro frontend abrir.
    return { sent: false, link: access.link };
  }

  /**
   * Igor (15/05): gate de WhatsApp no Telegram. Antes, todo pagamento
   * confirmado chamava sendGroupAccessLinks direto — o cliente clicava
   * "Acesso Único" e ia pro grupo sem nunca passar pelo dashboard, então
   * o WhatsApp dele nunca era coletado pra base de broadcast.
   *
   * Agora: se o user já tem WhatsApp → libera o acesso normalmente.
   * Se não tem → guarda a compra em pendingWhatsappGate e pede o contato
   * via botão nativo do Telegram (request_contact). O acesso só é liberado
   * quando o cliente compartilhar (ver handleContactShared).
   */
  private async deliverAccessOrRequestWhatsapp(
    chatId: number,
    userId: string,
    contentId: string,
  ): Promise<void> {
    try {
      const { data: user } = await this.supabase
        .from('users')
        .select('whatsapp')
        .eq('id', userId)
        .maybeSingle();

      const hasWhatsapp = !!(user?.whatsapp && String(user.whatsapp).trim());

      if (hasWhatsapp) {
        // Já temos o WhatsApp — fluxo normal.
        await this.sendGroupAccessLinks(chatId, userId, contentId);
        return;
      }

      // Sem WhatsApp — bloqueia o acesso e pede o contato.
      this.pendingWhatsappGate.set(chatId, { userId, contentId });
      await this.sendMessage(
        chatId,
        `🎬 *Seu pagamento foi confirmado!*\n\n` +
          `Pra liberar seu acesso ao conteúdo, toque no botão abaixo e ` +
          `compartilhe seu WhatsApp. É rápido e garante que você não perca o filme. 👇`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            keyboard: [
              [{ text: '📱 Compartilhar meu WhatsApp', request_contact: true }],
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        },
      );
    } catch (err: any) {
      this.logger.warn(
        `deliverAccessOrRequestWhatsapp failed (chat=${chatId}, content=${contentId}): ${err.message}`,
      );
      // Fallback de segurança: em caso de erro inesperado, não deixar o
      // cliente que pagou sem acesso — entrega direto.
      await this.sendGroupAccessLinks(chatId, userId, contentId);
    }
  }

  /**
   * Igor (15/05): processa o contato compartilhado pelo cliente após o
   * gate de WhatsApp. Salva o número em users.whatsapp e libera o acesso
   * ao grupo do conteúdo que estava pendente.
   */
  private async handleContactShared(
    chatId: number,
    telegramUserId: number,
    contact: any,
  ): Promise<void> {
    try {
      // Segurança: o cliente precisa compartilhar o PRÓPRIO contato.
      // O Telegram preenche contact.user_id só quando é o contato dele.
      if (contact?.user_id && Number(contact.user_id) !== Number(telegramUserId)) {
        await this.sendMessage(
          chatId,
          '⚠️ Por favor, compartilhe o *seu próprio* contato usando o botão abaixo.',
          {
            parse_mode: 'Markdown',
            reply_markup: {
              keyboard: [
                [{ text: '📱 Compartilhar meu WhatsApp', request_contact: true }],
              ],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          },
        );
        return;
      }

      // Normaliza o número (só dígitos; BR ≤11 dígitos ganha prefixo 55).
      const rawDigits = String(contact?.phone_number || '').replace(/\D/g, '');
      let normalized = rawDigits;
      if (rawDigits.length >= 10 && rawDigits.length <= 11) {
        normalized = `55${rawDigits}`;
      }

      if (normalized.length < 10) {
        await this.sendMessage(
          chatId,
          '❌ Não consegui ler seu número. Toque no botão e tente de novo.',
          {
            reply_markup: {
              keyboard: [
                [{ text: '📱 Compartilhar meu WhatsApp', request_contact: true }],
              ],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          },
        );
        return;
      }

      // Salva em users.whatsapp.
      await this.supabase
        .from('users')
        .update({ whatsapp: normalized })
        .eq('telegram_id', telegramUserId.toString());

      // Confirma e remove o teclado de contato.
      await this.sendMessage(chatId, '✅ *WhatsApp registrado!* Liberando seu acesso...', {
        parse_mode: 'Markdown',
        reply_markup: { remove_keyboard: true },
      });

      // Libera o acesso pendente.
      const pending = this.pendingWhatsappGate.get(chatId);
      if (pending) {
        this.pendingWhatsappGate.delete(chatId);
        await this.sendGroupAccessLinks(chatId, pending.userId, pending.contentId);
        return;
      }

      // Fallback (servidor reiniciou e perdeu o Map): busca a última
      // compra paga do user e libera o acesso dela.
      const { data: usr } = await this.supabase
        .from('users')
        .select('id')
        .eq('telegram_id', telegramUserId.toString())
        .maybeSingle();
      if (usr?.id) {
        const { data: lastPurchase } = await this.supabase
          .from('purchases')
          .select('id, user_id, content_id, content(telegram_group_link)')
          .eq('user_id', usr.id)
          .eq('status', 'paid')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const lpContent = Array.isArray(lastPurchase?.content)
          ? lastPurchase?.content[0]
          : lastPurchase?.content;
        if (lastPurchase?.content_id && lpContent?.telegram_group_link) {
          await this.sendGroupAccessLinks(chatId, lastPurchase.user_id, lastPurchase.content_id);
        }
      }
    } catch (err: any) {
      this.logger.warn(`handleContactShared failed (chat=${chatId}): ${err.message}`);
      await this.sendMessage(
        chatId,
        '❌ Tive um problema ao registrar seu WhatsApp. Acesse "Minhas Compras" pra ver seu conteúdo.',
      );
    }
  }

  /**
   * N6 (Igor 04/05): link fixo do grupo com `creates_join_request: true`.
   * Cliente clica → cai numa fila de aprovação. Se o cliente original
   * compartilhar esse link com um terceiro, o terceiro aparece pro Igor
   * aprovar/rejeitar (consegue distinguir amigo legítimo de pirata).
   *
   * Diferente do single-use: não expira e pode ser usado múltiplas
   * vezes — mas cada uso vira pedido manual de admin.
   */
  async createFixedRequestJoinLink(
    groupLink: string,
    userId: string,
    botId?: string | null,
  ): Promise<string | null> {
    try {
      const chatId = await this.getChatIdFromLink(groupLink);
      if (!chatId) return null;

      const botApiUrl = await this.apiUrlForBot(botId);
      const response = await axios.post(`${botApiUrl}/createChatInviteLink`, {
        chat_id: chatId,
        creates_join_request: true,
        name: `Fixo - User ${userId.substring(0, 8)}`,
      });

      if (response.data.ok) {
        const link = response.data.result.invite_link;
        // Igor (13/07/2026): Telegram perdeu domínio t.me (serverHold). API
        // ainda devolve invite_link com host t.me — normaliza pra telegram.me
        // antes de expor ao cliente/persistir. Preserva o resto do path (+hash).
        const canonicalLink = typeof link === 'string'
          ? link.replace(/:\/\/t\.me\//i, '://telegram.me/')
          : link;
        this.logger.log(`Created fixed request-to-join link for user ${userId}: ${canonicalLink}`);
        return canonicalLink;
      }
      this.logger.warn(`Failed to create fixed link: ${response.data.description}`);
      return null;
    } catch (error: any) {
      this.logger.warn(`Error creating fixed link for user ${userId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Igor (07/06): aceita `botId` opcional — usa o bot admin do grupo
   * daquele filme (via `content.delivery_bot_id`). Quando null, usa o
   * bot default. Crítico pros 300+ grupos antigos onde o bot anterior
   * banido continua sendo admin (API ainda autoriza com token válido).
   */
  async createInviteLinkForUser(
    groupLink: string,
    userId: string,
    botId?: string | null,
  ): Promise<string | null> {
    try {
      // Extract chat ID from the group link
      // Telegram group links format: https://t.me/+AbCdEfGhIjK or https://t.me/joinchat/AbCdEfGhIjK
      // We need the chat ID to create an invite link
      // For private groups, we'll use the link as-is since we can't get chat_id directly

      this.logger.log(`Creating invite link for user ${userId} to group: ${groupLink} (botId=${botId || 'default'})`);

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

      const botApiUrl = await this.apiUrlForBot(botId);
      const response = await axios.post(`${botApiUrl}/createChatInviteLink`, {
        chat_id: chatId,
        member_limit: 1, // Only one user can use this link
        expire_date: expireDate,
        name: `Compra - User ${userId.substring(0, 8)}`, // Optional name for the link
      });

      if (response.data.ok) {
        const inviteLink = response.data.result.invite_link;
        // Igor (13/07/2026): Telegram perdeu domínio t.me (serverHold). API
        // ainda devolve invite_link com host t.me — normaliza pra telegram.me
        // antes de expor ao cliente/persistir. Preserva o resto do path (+hash).
        const canonicalLink = typeof inviteLink === 'string'
          ? inviteLink.replace(/:\/\/t\.me\//i, '://telegram.me/')
          : inviteLink;
        this.logger.log(`Created invite link for user ${userId}: ${canonicalLink}`);

        await this.supabase.from('system_logs').insert({
          type: 'telegram_group',
          level: 'info',
          message: `Created single-use invite link for user ${userId} to chat ${chatId}`,
        });

        return canonicalLink;
      } else {
        this.logger.error(`Failed to create invite link: ${response.data.description}`);

        await this.supabase.from('system_logs').insert({
          type: 'telegram_group',
          level: 'error',
          message: `Failed to create invite link for user ${userId}: ${response.data.description}`,
        });

        return null;
      }
    } catch (error: any) {
      // Igor (07/05): log MUITO mais verboso pra diagnosticar quando
      // bot não consegue gerar invite (Sirāt deu "indisponível" mesmo
      // com bot admin). Mostra status HTTP, description da Telegram API,
      // e o body completo do erro.
      const apiStatus = error?.response?.status;
      const apiDesc = error?.response?.data?.description;
      const apiErrorCode = error?.response?.data?.error_code;
      this.logger.error(
        `[createInviteLinkForUser] FAILED user=${userId} link=${groupLink} ` +
        `httpStatus=${apiStatus} apiCode=${apiErrorCode} desc="${apiDesc}" raw="${error?.message}"`,
      );

      await this.supabase.from('system_logs').insert({
        type: 'telegram_group',
        level: 'error',
        message: `Exception creating invite link for user ${userId}: status=${apiStatus} apiCode=${apiErrorCode} desc="${apiDesc}" msg=${error.message}`,
      });

      return null;
    }
  }

  /**
   * Igor (07/05): valida se o bot é admin do grupo COM permissão
   * de invite. Usado pelo admin form pra dar feedback imediato em
   * vez do cliente descobrir pagando.
   * Retorna { ok: true } ou { ok: false, reason: string } com
   * mensagem amigável.
   */
  async validateChatIdAdmin(chatId: string): Promise<{
    ok: boolean;
    reason?: string;
    chat_title?: string;
    bot_can_invite?: boolean;
  }> {
    const cleanId = chatId.trim();
    if (!/^-?\d{6,}$/.test(cleanId)) {
      return {
        ok: false,
        reason: `Formato inválido. Chat ID deve ser numérico (ex: -1001234567890). Você forneceu: "${cleanId}"`,
      };
    }

    try {
      // 1. getChat: confirma que o bot está no grupo.
      const chatRes = await axios.post(`${this.botApiUrl}/getChat`, {
        chat_id: cleanId,
      });
      if (!chatRes.data.ok) {
        return {
          ok: false,
          reason: `Telegram API retornou: ${chatRes.data.description || 'getChat falhou'}`,
        };
      }
      const chatTitle = chatRes.data.result.title;

      // 2. getChatMember pra ver permissões do bot.
      const meRes = await axios.post(`${this.botApiUrl}/getMe`);
      if (!meRes.data.ok) return { ok: false, reason: 'Bot info indisponível' };
      const botId = meRes.data.result.id;

      const memberRes = await axios.post(`${this.botApiUrl}/getChatMember`, {
        chat_id: cleanId,
        user_id: botId,
      });
      if (!memberRes.data.ok) {
        return {
          ok: false,
          chat_title: chatTitle,
          reason: `Bot não está no grupo "${chatTitle}". Adicione @${meRes.data.result.username} ao grupo primeiro.`,
        };
      }
      const member = memberRes.data.result;
      const status = member.status;
      if (status !== 'administrator' && status !== 'creator') {
        return {
          ok: false,
          chat_title: chatTitle,
          reason: `Bot está no grupo "${chatTitle}" mas NÃO é admin (status atual: ${status}). Promova @${meRes.data.result.username} a administrador.`,
        };
      }
      const canInvite = member.can_invite_users === true || status === 'creator';
      if (!canInvite) {
        return {
          ok: false,
          chat_title: chatTitle,
          bot_can_invite: false,
          reason: `Bot é admin de "${chatTitle}" mas SEM permissão de "Convidar usuários via link". Habilite essa permissão específica.`,
        };
      }
      return { ok: true, chat_title: chatTitle, bot_can_invite: true };
    } catch (error: any) {
      const apiStatus = error?.response?.status;
      const apiDesc = error?.response?.data?.description;
      this.logger.warn(
        `validateChatIdAdmin failed for ${cleanId}: status=${apiStatus} desc="${apiDesc}" msg=${error.message}`,
      );
      return {
        ok: false,
        reason:
          apiDesc ||
          `Erro ao consultar Telegram (HTTP ${apiStatus}): ${error.message}`,
      };
    }
  }

  /**
   * Igor (12/05): testa o grupo Telegram de um conteúdo no admin.
   * Tenta gerar um invite link real (que o admin pode abrir para verificar
   * o grupo). Retorna erros estruturados para o frontend mostrar toasts
   * específicos em vez do genérico "Conteúdo Indisponível".
   *
   * Códigos de erro retornados:
   *  - link_missing: conteúdo sem telegram_chat_id nem telegram_group_link
   *  - bot_not_admin: bot está no grupo mas sem permissão de invite
   *  - chat_id_invalid: chat_id mal formatado ou grupo inexistente
   *  - unknown: erro genérico (ver detail)
   */
  async testTelegramGroupForContent(
    content: {
      id: string;
      telegram_chat_id?: string | null;
      telegram_group_link?: string | null;
    },
    // Igor (15/05): preferType permite ao admin escolher explicitamente
    // qual modo testar (botão "bot" vs botão "link de convite"). Sem isso,
    // a função usava fallback bot→link e o erro genérico confundia o Igor
    // quando o grupo só tinha link de convite.
    preferType?: 'bot' | 'link',
  ): Promise<{
    success: boolean;
    inviteLink?: string;
    chatTitle?: string;
    error?: 'link_missing' | 'bot_not_admin' | 'chat_id_invalid' | 'unknown';
    detail?: string;
  }> {
    const chatIdRaw = (content.telegram_chat_id || '').trim();
    const groupLink = (content.telegram_group_link || '').trim();

    // Quando preferType vier setado, valida que o campo correspondente existe.
    if (preferType === 'bot' && !chatIdRaw) {
      return {
        success: false,
        error: 'link_missing',
        detail: 'Conteúdo sem telegram_chat_id configurado (modo "bot").',
      };
    }
    if (preferType === 'link' && !groupLink) {
      return {
        success: false,
        error: 'link_missing',
        detail: 'Conteúdo sem telegram_group_link configurado (modo "link de convite").',
      };
    }

    if (!chatIdRaw && !groupLink) {
      return {
        success: false,
        error: 'link_missing',
        detail: 'Conteúdo sem grupo Telegram configurado (telegram_chat_id e telegram_group_link vazios).',
      };
    }

    // Decide o caminho: se preferType setado, usa só ele. Senão, tenta bot primeiro.
    const useBot = preferType === 'bot' || (!preferType && !!chatIdRaw);
    const useLink = preferType === 'link' || (!preferType && !chatIdRaw && !!groupLink);

    // Caso 1: bot (chat_id numérico)
    if (useBot) {
      const validation = await this.validateChatIdAdmin(chatIdRaw);
      if (!validation.ok) {
        // Diferencia bot_not_admin de chat_id_invalid pela mensagem
        const reason = validation.reason || '';
        const isFormatIssue = /Formato inválido|HTTP 400|getChat falhou|getChat/.test(reason);
        return {
          success: false,
          chatTitle: validation.chat_title,
          error: isFormatIssue ? 'chat_id_invalid' : 'bot_not_admin',
          detail: reason,
        };
      }
      // Bot é admin e pode convidar — gera o link
      try {
        const expireDate = Math.floor(Date.now() / 1000) + 60 * 60; // 1h
        const res = await axios.post(`${this.botApiUrl}/createChatInviteLink`, {
          chat_id: chatIdRaw,
          member_limit: 1,
          expire_date: expireDate,
          name: `Admin Test - ${content.id.substring(0, 8)}`,
        });
        if (res.data.ok) {
          return {
            success: true,
            inviteLink: res.data.result.invite_link,
            chatTitle: validation.chat_title,
          };
        }
        return {
          success: false,
          error: 'unknown',
          detail: res.data.description || 'createChatInviteLink retornou !ok',
        };
      } catch (error: any) {
        return {
          success: false,
          error: 'unknown',
          detail: error?.response?.data?.description || error.message,
        };
      }
    }

    // Caso 2: link de convite (telegram_group_link)
    if (useLink) {
      // Igor (15/05): se o telegram_group_link já é um link do Telegram
      // (t.me/+..., t.me/joinchat/..., t.me/username ou @username), ele
      // PRÓPRIO é o acesso ao grupo — não dá pra (nem precisa) gerar um
      // invite novo via bot API. Links de convite privados (t.me/+...)
      // não têm Chat ID extraível, então createInviteLinkForUser falhava
      // e o teste dava erro. O "teste" de um link de convite é só abrir
      // o link cadastrado e o admin ver o grupo.
      const looksLikeTelegramLink =
        /^https?:\/\/(t|telegram)\.me\//i.test(groupLink) ||
        (groupLink.includes('t.me/') || groupLink.includes('telegram.me/')) ||
        groupLink.startsWith('@');
      if (looksLikeTelegramLink) {
        const normalizedLink = groupLink.startsWith('@')
          ? `https://telegram.me/${groupLink.slice(1)}`
          : groupLink;
        return { success: true, inviteLink: normalizedLink };
      }

      // Fallback: groupLink é um Chat ID numérico disfarçado (dado legado).
      const link = await this.createInviteLinkForUser(groupLink, `admin-test-${content.id.substring(0, 8)}`);
      if (link) {
        return { success: true, inviteLink: link };
      }
      return {
        success: false,
        error: 'bot_not_admin',
        detail:
          'Não foi possível gerar invite link a partir do telegram_group_link. ' +
          'Verifique se o bot é admin do grupo com permissão "Convidar usuários via link".',
      };
    }

    // Não deveria chegar aqui — defensive.
    return {
      success: false,
      error: 'unknown',
      detail: 'Caminho de teste inválido (preferType inconsistente com campos).',
    };
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
      const urlMatch = groupLink.match(/https:\/\/(?:t|telegram)\.me\/([^\/\?+]+)/);
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

  // Igor reportou (04/05): bot estava enviando 2x a mesma mensagem
  // de "/minhascompras" (uma com URL Vercel antiga, outra com a oficial).
  // Causa: 2 instâncias do backend processando o mesmo webhook (deploy
  // antigo + novo coexistindo, ou backend local rodando junto com
  // produção). Mitigação: idempotência por `update_id`. Reusa o Set
  // `processedUpdates` que o polling já tinha — agora webhook e
  // polling compartilham o mesmo cache, então mesmo se as duas formas
  // estiverem ativas em instâncias diferentes, cada update só roda 1x
  // por instância. (Não resolve duplicação entre instâncias, só dentro
  // da mesma instância — pra caso real Igor precisa garantir 1 deploy.)
  private isUpdateAlreadyProcessed(updateId: number | undefined): boolean {
    if (typeof updateId !== 'number') return false;
    if (this.processedUpdates.has(updateId)) return true;
    this.processedUpdates.add(updateId);
    if (this.processedUpdates.size > this.MAX_PROCESSED_CACHE) {
      const first = this.processedUpdates.values().next().value;
      if (typeof first === 'number') this.processedUpdates.delete(first);
    }
    return false;
  }

  // Igor (08/05): dedup persistido em DB pra resistir a 2 instances do
  // backend (rolling update no Render free tier). Mesmo update_id em
  // races chega em 1 instance, a outra falha no insert (unique violation)
  // e pula. Async pra nao bloquear webhook response.
  private async claimUpdateInDb(updateId: number | undefined): Promise<boolean> {
    if (typeof updateId !== 'number') return true; // sem id, processa
    try {
      const { error } = await this.supabase
        .from('processed_telegram_updates')
        .insert({ update_id: updateId });
      if (error) {
        if (error.code === '23505' || /duplicate|unique/i.test(error.message)) {
          this.logger.log(`[dedup-db] update ${updateId} already claimed by another instance`);
          return false; // outra instance ja pegou
        }
        this.logger.warn(`[dedup-db] claim threw for ${updateId}: ${error.message} — proceeding`);
      }
    } catch (err: any) {
      this.logger.warn(`[dedup-db] claim threw for ${updateId}: ${err.message}`);
    }
    return true;
  }

  /**
   * Igor (07/06): aceita `botId` opcional. Quando setado (rota
   * /webhook/:botId), todo o processamento desse update roda dentro de
   * um AsyncLocalStorage que carrega o botId — sendMessage etc. usam
   * automaticamente o token correto pra responder pelo bot certo.
   */
  async handleWebhook(webhookData: any, signature?: string, botId?: string) {
    return this.botContext.run({ botId: botId || null }, () =>
      this._handleWebhookInner(webhookData, signature, botId),
    );
  }

  private async _handleWebhookInner(webhookData: any, signature?: string, botId?: string) {
    try {
      this.logger.log(`🔔 Webhook received${botId ? ` (bot=${botId})` : ''}:`, JSON.stringify(webhookData).substring(0, 200));

      // Validate webhook signature if provided
      if (signature && this.webhookSecret) {
        const isValid = this.validateWebhookSignature(webhookData, signature);
        if (!isValid) {
          this.logger.warn('Invalid webhook signature');
          return { status: 'invalid_signature' };
        }
      }

      // Idempotência por update_id (proteção contra instância duplicada).
      // 1) cache em memoria
      if (this.isUpdateAlreadyProcessed(webhookData?.update_id)) {
        this.logger.warn(
          `⏭️ Skipping duplicate update_id=${webhookData.update_id} (already processed in-memory)`,
        );
        return { status: 'duplicate' };
      }
      // 2) dedup em DB (resiste a multiplas instances)
      const claimed = await this.claimUpdateInDb(webhookData?.update_id);
      if (!claimed) {
        return { status: 'duplicate' };
      }

      // Auto-cadastro de grupos: quando o bot recebe my_chat_member
      // (adicionado como admin) ou qualquer mensagem de grupo/supergrupo,
      // registra automaticamente em telegram_bot_groups — sem precisar
      // cadastrar Chat ID manualmente (N31 - Igor 07/06).
      const chatFromUpdate =
        webhookData.message?.chat ||
        webhookData.my_chat_member?.chat ||
        webhookData.chat_member?.chat;
      if (chatFromUpdate && (chatFromUpdate.type === 'group' || chatFromUpdate.type === 'supergroup')) {
        this.resolveCurrentBotId(botId).then(resolvedBotId => {
          if (resolvedBotId) {
            this.autoRegisterGroup(resolvedBotId, String(chatFromUpdate.id), chatFromUpdate.title).catch(() => {});
          }
        }).catch(() => {});
      }

      // Process different types of updates
      if (webhookData.my_chat_member) {
        // Bot adicionado/removido de grupo — só logar, o auto-registro já foi feito acima
        const status = webhookData.my_chat_member.new_chat_member?.status;
        this.logger.log(`my_chat_member: bot status=${status} in chat=${webhookData.my_chat_member.chat?.id}`);
      } else if (webhookData.message) {
        this.logger.log('📩 Processing message update');
        await this.processMessage(webhookData.message);
      } else if (webhookData.callback_query) {
        this.logger.log('🔘 Processing callback query');
        await this.processCallbackQuery(webhookData.callback_query);
      } else if (webhookData.business_connection) {
        // Telegram Business: Igor (de)autorizou o bot na conta dele.
        this.logger.log('🤝 Processing business_connection update');
        await this.processBusinessConnection(webhookData.business_connection);
      } else if (webhookData.business_message) {
        // Telegram Business: DM chegou pra Igor — IA atende.
        this.logger.log('💬 Processing business_message update');
        await this.processBusinessMessage(webhookData.business_message);
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

    // Igor (26/05): bot apaga as mensagens de serviço do Telegram nos
    // grupos de filme ("X entrou no grupo" / "X saiu do grupo" / mudança
    // de título/foto) — substitui o bot externo Group Help que ele tinha
    // que configurar manualmente em cada grupo novo. Pré-requisito: bot
    // ser admin no grupo com permissão "Delete messages". Try/catch
    // silencioso se não tiver permissão (não quebra fluxo).
    const chatType = message?.chat?.type;
    if (chatType === 'group' || chatType === 'supergroup') {
      const isServiceMessage =
        !!message.new_chat_members ||
        !!message.left_chat_member ||
        message.new_chat_title !== undefined ||
        !!message.new_chat_photo ||
        message.delete_chat_photo === true ||
        message.group_chat_created === true ||
        message.supergroup_chat_created === true ||
        message.channel_chat_created === true ||
        message.migrate_to_chat_id !== undefined ||
        message.migrate_from_chat_id !== undefined;
      if (isServiceMessage) {
        try {
          const delApiUrl = await this.apiUrlForCurrent();
          await axios.post(`${delApiUrl}/deleteMessage`, {
            chat_id: chatId,
            message_id: messageId,
          });
        } catch (err: any) {
          this.logger.warn(
            `service-message autodelete falhou em chat ${chatId}: ${err?.response?.data?.description || err.message}`,
          );
        }
        return;
      }
    }

    this.logger.log(`📨 processMessage called - chatId: ${chatId}, text: "${text}", telegramUserId: ${telegramUserId}`);

    // Track which bot token this user is using (for broadcast filtering)
    void Promise.resolve(
      this.supabase
        .from('users')
        .update({ last_bot_token: this.botToken })
        .eq('telegram_id', telegramUserId.toString()),
    ).catch((err: any) => {
      this.logger.warn(`Failed to update last_bot_token: ${err?.message || err}`);
    });

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

    // Igor (15/05): gate de WhatsApp. Cliente pagou mas ainda não
    // compartilhou o número — bloqueia QUALQUER mensagem que não seja o
    // contato e reenvia o pedido. Garante que o WhatsApp é coletado antes
    // de liberar o acesso ao grupo do filme.
    if (this.pendingWhatsappGate.has(chatId)) {
      if (message.contact) {
        await this.handleContactShared(chatId, telegramUserId, message.contact);
      } else {
        await this.sendMessage(
          chatId,
          '📱 Pra liberar seu acesso ao conteúdo, preciso do seu WhatsApp. Toque no botão abaixo 👇',
          {
            reply_markup: {
              keyboard: [
                [{ text: '📱 Compartilhar meu WhatsApp', request_contact: true }],
              ],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          },
        );
      }
      return;
    }

    // Igor (15/05): contato compartilhado fora do gate (cliente reenviou
    // ou compartilhou espontaneamente) — registra o WhatsApp mesmo assim.
    if (message.contact && message.chat.type === 'private') {
      await this.handleContactShared(chatId, telegramUserId, message.contact);
      return;
    }

    // Verificar se usuário está aguardando digitar número WhatsApp
    if (telegramUserId && this.pendingWhatsappCapture.has(telegramUserId) && text && !text.startsWith('/')) {
      this.pendingWhatsappCapture.delete(telegramUserId);
      const digits = text.replace(/\D/g, '');
      if (digits.length >= 8 && digits.length <= 15) {
        await this.supabase
          .from('users')
          .update({ whatsapp: digits })
          .eq('telegram_id', telegramUserId.toString());
        await this.sendMessage(chatId, '✅ WhatsApp salvo!');
      } else {
        await this.sendMessage(chatId, '❌ Número inválido. Tente novamente em Minhas Compras.');
      }
      return;
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
    } else if (text === '/minhascompras' || text === '/minhas_compras' || text === '/mypurchases') {
      await this.handleMyPurchasesCommand(chatId, telegramUserId);
    } else if (text === '/meu_id' || text === '/meu-id' || text === '/my-id') {
      await this.handleMyIdCommand(chatId, telegramUserId);
    } else if (text === '/solicitar' || text === '/request') {
      await this.handleRequestCommand(chatId, telegramUserId);
    } else if (text === '/suporte' || text === '/support') {
      await this.handleSupportCommand(chatId);
    } else if (text === '/ajuda' || text === '/help') {
      await this.handleHelpCommand(chatId);
    } else if (text && !text.startsWith('/') && message.chat.type === 'private') {
      // Limitação técnica: a Bot API NÃO entrega o conteúdo de uma
      // Story (apenas o flag reply_to_story). A IA não consegue
      // adivinhar qual filme estava no pôster, então respondemos com
      // uma mensagem humanizada pedindo o título antes de tentar.
      // Igor pediu pra "montar uma mensagem informando essa restrição".
      if (message.reply_to_story || message.story) {
        await this.sendMessage(
          chatId,
          'Oi! Vi que você está respondendo a um Story 🎬, mas eu (bot) não consigo ver o conteúdo dele por uma limitação do Telegram. 😅\n\nMe diz qual filme ou série você está procurando que eu te ajudo na hora!',
        );
        return;
      }
      // Dispatch to AI chat service
      await this.dispatchAiChat(chatId, text, telegramUserId);
    } else if ((message.photo || message.document) && message.chat.type === 'private') {
      // F1.7 — Igor pediu (vídeo IMG_8772): cliente envia comprovante
      // PIX como imagem; antes era ignorado e ficava perdido. Agora
      // persistimos a referência (file_id + caption) na tabela
      // `ai_messages` pra aparecer no painel admin de IA.
      //
      // BÔNUS: se o caption contém "comprovante", "paguei", "pago",
      // "pix" → pausa a conversa pra Igor revisar a imagem manualmente.
      try {
        await this.handleIncomingMedia(chatId, telegramUserId, message);
      } catch (err: any) {
        this.logger.warn(`handleIncomingMedia failed for ${chatId}: ${err.message}`);
      }
    }
  }

  /**
   * Persiste mídia recebida (photo/document) em `ai_messages` ligando
   * à `ai_conversations` via (platform=telegram, external_chat_id=chatId).
   * Cria a conversation se não existir. Pausa IA se o caption sugerir
   * comprovante de pagamento — Igor revisa manual.
   */
  private async handleIncomingMedia(
    chatId: number,
    _telegramUserId: number,
    message: any,
  ): Promise<void> {
    let mediaType: 'photo' | 'document' | null = null;
    let fileId: string | undefined;

    if (message.photo && Array.isArray(message.photo) && message.photo.length) {
      // Telegram envia várias resoluções — pegamos a maior (último item).
      mediaType = 'photo';
      fileId = message.photo[message.photo.length - 1].file_id;
    } else if (message.document) {
      mediaType = 'document';
      fileId = message.document.file_id;
    }

    if (!mediaType || !fileId) return;

    const caption: string = (message.caption || '').trim();
    const externalChatId = String(chatId);

    // Acha ou cria a ai_conversation pra esse chat. (replicado de
    // ai-chat.service mas sem rodar a IA — só persistir.)
    let { data: conv } = await this.supabase
      .from('ai_conversations')
      .select('id, ai_enabled, paused_reason')
      .eq('platform', 'telegram')
      .eq('external_chat_id', externalChatId)
      .maybeSingle();

    if (!conv) {
      const { data: created } = await this.supabase
        .from('ai_conversations')
        .insert({ platform: 'telegram', external_chat_id: externalChatId, ai_enabled: true })
        .select('id, ai_enabled, paused_reason')
        .single();
      conv = created;
    }

    if (!conv) return;

    await this.supabase.from('ai_messages').insert({
      conversation_id: conv.id,
      role: 'user',
      content: caption || `[${mediaType === 'photo' ? 'Imagem' : 'Documento'} enviado(a) pelo cliente]`,
      media_type: mediaType,
      media_telegram_file_id: fileId,
    });

    await this.supabase
      .from('ai_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conv.id);

    // Igor (08/05): N20 — qualquer mídia (foto/documento) recebida pelo
    // bot agora pausa a IA e chama o admin no DM. Antes, só pausava se
    // o caption mencionasse "comprovante/pix/pago" — mas a maioria dos
    // clientes manda print SEM caption, então ficava perdido.
    if (conv.ai_enabled) {
      const looksLikeReceipt =
        /comprovante|paguei|pago|pix|deposit|recibo|comprovado/i.test(caption);
      const pauseReason = looksLikeReceipt
        ? 'receipt_image_received'
        : 'media_received';

      await this.supabase
        .from('ai_conversations')
        .update({
          ai_enabled: false,
          paused_reason: pauseReason,
          paused_at: new Date().toISOString(),
        })
        .eq('id', conv.id);

      // Avisa o cliente que vamos analisar.
      const clientMsg = looksLikeReceipt
        ? '📩 Recebi seu comprovante! Já chamei alguém da equipe pra te ajudar — em instantes te respondemos. 💕'
        : '📩 Recebi sua mensagem! Já chamei alguém da equipe pra dar uma olhada — em instantes te respondemos. 💕';

      await this.sendMessage(chatId, clientMsg);

      // Notifica admin com fallback DB (mesmo padrao do resolveAdminChatId).
      const adminChatId = await this.resolveAdminChatIdLocal();
      if (adminChatId) {
        try {
          const mediaLabel =
            mediaType === 'photo' ? 'uma imagem' : 'um documento';
          const captionLine = caption ? ` com a legenda: "${caption}"` : '';
          const reasonLabel = looksLikeReceipt ? 'Comprovante' : 'Mídia';
          await this.sendMessage(
            parseInt(adminChatId, 10),
            `📷 *${reasonLabel} recebido*\n\nCliente \`${chatId}\` enviou ${mediaLabel}${captionLine}.\n\n👉 [Abrir painel de IA](https://www.cinevisionapp.com.br/admin/ai-chat)`,
            { parse_mode: 'Markdown' },
          );
          this.logger.log(
            `Admin notified about ${pauseReason}: client=${chatId} → admin=${adminChatId}`,
          );
        } catch (err: any) {
          this.logger.warn(`admin notify (media) failed: ${err.message}`);
        }
      } else {
        this.logger.warn(
          `media notify dropped: no admin chat_id resolved for client ${chatId}`,
        );
      }
    }
  }

  // Igor (08/05): N20 — replica do resolveAdminChatId em ai-chat.service.
  // Antes esse handler usava env var TELEGRAM_ADMIN_CHAT_ID direto (que
  // Igor nao setou no Render), entao notify silenciosamente droppava.
  // Agora cai no fallback DB (admin com telegram_id set).
  private adminChatIdCache: { value: string | null; fetchedAt: number } | null = null;
  private async resolveAdminChatIdLocal(): Promise<string | null> {
    const envChatId = this.configService.get<string>('TELEGRAM_ADMIN_CHAT_ID');
    if (envChatId) return envChatId;

    const now = Date.now();
    if (this.adminChatIdCache && now - this.adminChatIdCache.fetchedAt < 5 * 60 * 1000) {
      return this.adminChatIdCache.value;
    }

    try {
      // N28b (Igor 08/05): tenta primeiro pegar dono da Business connection
      // ativa — quem tem cliente no DM dele e quem deve receber notify
      // de comprovante/midia, nao o admin generico do DB (que pode ser
      // outra pessoa, ex: dev testando local).
      const { data: businessConns } = await this.supabase
        .from('telegram_business_connections')
        .select('telegram_user_id, can_reply, is_enabled')
        .eq('is_enabled', true)
        .eq('can_reply', true)
        .limit(5);

      const businessOwner = (businessConns || []).find(
        (c: any) => c.telegram_user_id,
      );
      if (businessOwner?.telegram_user_id) {
        const value = String(businessOwner.telegram_user_id);
        this.adminChatIdCache = { value, fetchedAt: now };
        return value;
      }

      const { data: admins } = await this.supabase
        .from('users')
        .select('id, telegram_id, telegram_chat_id, role')
        .eq('role', 'admin')
        .not('telegram_id', 'is', null)
        .limit(5);

      const chosen = (admins || []).find((u: any) => u.telegram_id || u.telegram_chat_id);
      const value = chosen?.telegram_chat_id || chosen?.telegram_id || null;
      // N28b: nao cachear null (mesma logica do ai-chat.service).
      if (value) {
        this.adminChatIdCache = { value, fetchedAt: now };
      }
      return value;
    } catch (err: any) {
      this.logger.error(`resolveAdminChatIdLocal failed: ${err.message}`);
      return null;
    }
  }

  private async dispatchAiChat(chatId: number, text: string, telegramUserId: number) {
    try {
      const axios = (await import('axios')).default;
      const backendSelf = this.configService.get('BACKEND_SELF_URL') || 'http://localhost:3001';

      // Identify user
      let userId: string | undefined;
      try {
        const { data: user } = await this.supabase
          .from('users')
          .select('id')
          .eq('telegram_id', telegramUserId.toString())
          .single();
        userId = user?.id;
      } catch {
        /* silent */
      }

      // B7 (Igor pediu) — humaniza com "digitando..." + delay 5-8s
      // pra parecer humano. Mesmo padrão do dispatchAiChatBusiness.
      this.sendChatAction(chatId, 'typing').catch(() => undefined);

      const aiPromise = axios.post(
        `${backendSelf}/api/v1/ai-chat/message`,
        {
          platform: 'telegram',
          external_chat_id: String(chatId),
          message: text,
          user_id: userId,
        },
        { timeout: 30000 },
      );

      const delayMs = 5000 + Math.floor(Math.random() * 3000);
      const delayPromise = new Promise((r) => setTimeout(r, delayMs));

      // Re-arma typing a cada 4s pra não sumir (Telegram drops após ~5s).
      const typingInterval = setInterval(() => {
        this.sendChatAction(chatId, 'typing').catch(() => undefined);
      }, 4000);

      const [response] = await Promise.all([aiPromise, delayPromise]);
      clearInterval(typingInterval);

      const reply = response.data;

      // N28 (Igor 08/05): quando IA falha (Claude timeout/rate_limit/etc)
      // retorna {paused:true, text:''}. Antes o bot silenciosamente nao
      // mandava nada e cliente ficava vendo "digitando" infinitamente.
      if (reply?.paused && !reply?.text) {
        try {
          await this.sendMessage(
            chatId,
            '📩 Recebi sua mensagem! Já chamei alguém da equipe pra te responder — em instantes voltamos. 💕',
          );
        } catch (err: any) {
          this.logger.warn(`Fallback message send failed (telegram): ${err.message}`);
        }
        return;
      }

      if (!reply?.text) return;

      // Igor (07/05): IA salvava resposta no DB mas não chegava no
      // Telegram quando a resposta tinha asteriscos/underscores
      // desbalanceados — Telegram retornava 400 com parse_mode=Markdown.
      // Agora tentamos Markdown primeiro; se falhar com 400, refazemos
      // sem parse_mode pra garantir entrega.
      const sendWithMarkdownFallback = async (
        text: string,
        opts?: any,
      ): Promise<void> => {
        try {
          await this.sendMessage(chatId, text, { parse_mode: 'Markdown', ...(opts || {}) });
        } catch (err: any) {
          const status = err?.response?.status;
          const desc = err?.response?.data?.description || '';
          if (status === 400 && /parse|entity|markdown/i.test(desc)) {
            this.logger.warn(
              `Markdown sendMessage 400 (${desc}) — retrying as plain text`,
            );
            await this.sendMessage(chatId, text, opts || {});
          } else {
            throw err;
          }
        }
      };

      if (reply.paymentLink) {
        await sendWithMarkdownFallback(reply.text, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💳 Pagar agora via PIX', url: reply.paymentLink }],
            ],
          },
        });
      } else {
        await sendWithMarkdownFallback(reply.text);
      }
    } catch (err: any) {
      this.logger.warn(`AI dispatch failed: ${err.message}`);
    }
  }

  // ==================== TELEGRAM BUSINESS API ====================

  /**
   * Igor (de)autorizou o bot via Settings → Business → Chatbots.
   * Persistimos a conexão pra (a) saber qual business_connection_id usar
   * ao responder e (b) verificar can_reply antes de processar mensagens.
   */
  private async processBusinessConnection(payload: any) {
    // Igor (08/05): tabela ficava vazia mesmo apos o bot ser adicionado.
    // Loga payload bruto e usa fallback pra user_chat_id quando user.id
    // nao vem (Bot API novo as vezes manda so user_chat_id que equivale
    // ao mesmo id em DM 1-1).
    this.logger.log(
      `[BUSINESS_CONN_RAW] ${JSON.stringify(payload).slice(0, 1000)}`,
    );

    try {
      const id = payload.id as string;
      const ownerId =
        payload.user?.id ??
        payload.user_id ??
        payload.user_chat_id ??
        null;
      const canReply =
        payload.rights?.can_reply === true ||
        payload.rights?.can_reply_to_messages === true ||
        payload.can_reply === true;
      const isEnabled = payload.is_enabled !== false;

      if (!id) {
        this.logger.error(
          `[BUSINESS_CONN] payload sem id — abortando: ${JSON.stringify(payload).slice(0, 500)}`,
        );
        return;
      }
      if (!ownerId) {
        this.logger.error(
          `[BUSINESS_CONN] payload sem user.id/user_chat_id — abortando: ${JSON.stringify(payload).slice(0, 500)}`,
        );
        return;
      }

      this.logger.log(
        `Business connection ${id} from user ${ownerId} (can_reply=${canReply}, is_enabled=${isEnabled})`,
      );

      const { error } = await this.supabase
        .from('telegram_business_connections')
        .upsert(
          {
            id,
            telegram_user_id: ownerId,
            can_reply: canReply,
            is_enabled: isEnabled,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' },
        );

      if (error) {
        this.logger.error(
          `[BUSINESS_CONN] Failed upsert id=${id} owner=${ownerId} can_reply=${canReply} is_enabled=${isEnabled}: ${error.message} | code=${(error as any).code}`,
        );
      } else {
        this.logger.log(
          `[BUSINESS_CONN] Upsert OK id=${id} owner=${ownerId}`,
        );
      }
    } catch (err: any) {
      this.logger.error(
        `[BUSINESS_CONN] processBusinessConnection threw: ${err.message} | stack=${err.stack?.slice(0, 500)}`,
      );
    }
  }

  /**
   * DM chegando pra Igor via Business. Roteia pra IA com platform
   * 'telegram_business'. Se a mensagem veio do próprio Igor (ele digitou
   * uma resposta manual no app), pausa a IA pra essa conversa — Igor
   * assumiu manualmente.
   */
  private async processBusinessMessage(payload: any) {
    try {
      const businessConnectionId = payload.business_connection_id as string;
      const message = payload;
      const chatId = message.chat?.id;
      const senderId = message.from?.id;
      const text = message.text;

      if (!chatId || !text) return;

      // Lookup conexão pra validar can_reply + identificar Igor.
      let { data: connection } = await this.supabase
        .from('telegram_business_connections')
        .select('*')
        .eq('id', businessConnectionId)
        .maybeSingle();

      // Igor (08/05): se a connection nao existe (porque o
      // business_connection update foi processado por backend bugado
      // anterior e perdido), recupera via Bot API getBusinessConnection
      // e cria a row na hora. Self-healing.
      if (!connection) {
        this.logger.warn(
          `business_message for unknown connection ${businessConnectionId} — fetching from Bot API`,
        );
        try {
          const bcApiUrl = await this.apiUrlForCurrent();
          const resp = await axios.post(`${bcApiUrl}/getBusinessConnection`, {
            business_connection_id: businessConnectionId,
          });
          if (resp.data?.ok && resp.data.result) {
            const conn = resp.data.result;
            const ownerId = conn.user?.id ?? conn.user_chat_id;
            const canReply =
              conn.rights?.can_reply === true ||
              conn.rights?.can_reply_to_messages === true ||
              conn.can_reply === true;
            const isEnabled = conn.is_enabled !== false;

            const { data: created, error } = await this.supabase
              .from('telegram_business_connections')
              .upsert(
                {
                  id: businessConnectionId,
                  telegram_user_id: ownerId,
                  can_reply: canReply,
                  is_enabled: isEnabled,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'id' },
              )
              .select()
              .single();

            if (error) {
              this.logger.error(
                `Failed to recover business connection ${businessConnectionId}: ${error.message}`,
              );
              return;
            }
            connection = created;
            this.logger.log(
              `Recovered business connection ${businessConnectionId} owner=${ownerId} via Bot API`,
            );
          } else {
            this.logger.error(
              `getBusinessConnection failed: ${JSON.stringify(resp.data).slice(0, 300)}`,
            );
            return;
          }
        } catch (recoveryErr: any) {
          this.logger.error(
            `Bot API getBusinessConnection threw: ${recoveryErr.message}`,
          );
          return;
        }
      }

      if (!connection.is_enabled || !connection.can_reply) {
        this.logger.log(
          `Skipping business_message — connection ${businessConnectionId} disabled or read-only`,
        );
        return;
      }

      // Se quem mandou foi o próprio Igor (dono da conta Business),
      // pausa a IA pra essa conversa — ele assumiu o atendimento.
      if (senderId && senderId === connection.telegram_user_id) {
        await this.supabase
          .from('ai_conversations')
          .update({
            ai_enabled: false,
            paused_reason: 'owner_takeover',
            paused_at: new Date().toISOString(),
          })
          .eq('platform', 'telegram_business')
          .eq('external_chat_id', String(chatId));
        this.logger.log(
          `Owner takeover: pausing AI for chat ${chatId} (Igor responded manually)`,
        );
        return;
      }

      // Cliente mandou DM. Dispatcha pra IA com humanization (typing + delay).
      await this.dispatchAiChatBusiness(
        chatId,
        text,
        businessConnectionId,
        senderId,
      );
    } catch (err: any) {
      this.logger.error(`processBusinessMessage failed: ${err.message}`);
    }
  }

  /**
   * Dispatcha mensagem de cliente Business pra IA, aplicando layer de
   * humanização: 4-12s delay aleatório + sendChatAction(typing) durante.
   * Igor pediu isso pra resposta parecer humana.
   */
  private async dispatchAiChatBusiness(
    chatId: number,
    text: string,
    businessConnectionId: string,
    telegramUserId?: number,
  ) {
    try {
      const axios = (await import('axios')).default;
      const backendSelf =
        this.configService.get('BACKEND_SELF_URL') || 'http://localhost:3001';

      // Identifica user no banco se já existe (pra histórico/permissões).
      let userId: string | undefined;
      if (telegramUserId) {
        try {
          const { data: user } = await this.supabase
            .from('users')
            .select('id')
            .eq('telegram_id', String(telegramUserId))
            .maybeSingle();
          userId = user?.id;
        } catch {
          /* silent */
        }
      }

      // Mostra "digitando..." imediatamente pro cliente ver atividade.
      this.sendChatAction(chatId, 'typing', businessConnectionId).catch(
        () => undefined,
      );

      // Pede a resposta da IA em paralelo ao delay humanizado.
      const aiPromise = axios.post(
        `${backendSelf}/api/v1/ai-chat/message`,
        {
          platform: 'telegram_business',
          external_chat_id: String(chatId),
          message: text,
          user_id: userId,
          business_connection_id: businessConnectionId,
        },
        { timeout: 30000 },
      );

      // Delay aleatório 5-8s. Igor pediu pra parecer humano sem ficar
      // arrastado. Roda em paralelo com a chamada da IA.
      const delayMs = 5000 + Math.floor(Math.random() * 3000);
      const delayPromise = new Promise((r) => setTimeout(r, delayMs));

      // Re-arma typing a cada 4s pra não sumir (Telegram drops após ~5s).
      const typingInterval = setInterval(() => {
        this.sendChatAction(chatId, 'typing', businessConnectionId).catch(
          () => undefined,
        );
      }, 4000);

      const [response] = await Promise.all([aiPromise, delayPromise]);
      clearInterval(typingInterval);

      const reply = response.data;

      // N28 (Igor 08/05): quando IA falha (Claude timeout/rate_limit/etc)
      // retorna {paused:true, text:''}. Antes o bot silenciosamente nao
      // mandava nada e cliente ficava vendo "digitando" infinitamente.
      // Agora manda fallback explicito + Igor ja foi notificado pelo
      // notifyAdminForTakeover do ai-chat.service.
      if (reply?.paused && !reply?.text) {
        try {
          await this.sendMessage(
            chatId,
            '📩 Recebi sua mensagem! Já chamei alguém da equipe pra te responder — em instantes voltamos. 💕',
            { business_connection_id: businessConnectionId },
          );
        } catch (err: any) {
          this.logger.warn(`Fallback message send failed (business): ${err.message}`);
        }
        return;
      }

      if (!reply?.text) return;

      // Igor (07/05): mesmo retry do dispatchAiChat — se Telegram
      // retorna 400 por Markdown malformado, refaz sem parse_mode.
      try {
        await this.sendMessage(chatId, reply.text, {
          parse_mode: 'Markdown',
          business_connection_id: businessConnectionId,
        });
      } catch (err: any) {
        const status = err?.response?.status;
        const desc = err?.response?.data?.description || '';
        if (status === 400 && /parse|entity|markdown/i.test(desc)) {
          this.logger.warn(
            `Business Markdown sendMessage 400 (${desc}) — retrying as plain text`,
          );
          await this.sendMessage(chatId, reply.text, {
            business_connection_id: businessConnectionId,
          });
        } else {
          throw err;
        }
      }
    } catch (err: any) {
      this.logger.warn(`Business AI dispatch failed: ${err.message}`);
    }
  }

  /**
   * Envia chat action ("typing", "upload_photo", etc). Suporta
   * business_connection_id pra mostrar atividade na conta do Igor.
   */
  async sendChatAction(
    chatId: number,
    action: 'typing' | 'upload_photo' | 'record_voice' = 'typing',
    businessConnectionId?: string,
  ): Promise<void> {
    try {
      const axios = (await import('axios')).default;
      const body: Record<string, any> = { chat_id: chatId, action };
      if (businessConnectionId) body.business_connection_id = businessConnectionId;
      const ctxBotId = this.currentBotId();
      const baseUrl = ctxBotId ? await this.apiUrlForBot(ctxBotId) : this.botApiUrl;
      await axios.post(`${baseUrl}/sendChatAction`, body, {
        timeout: 5000,
      });
    } catch (err: any) {
      // Best-effort — sendChatAction falhar não é crítico.
      this.logger.debug?.(`sendChatAction failed: ${err.message}`);
    }
  }

  // ==================== END TELEGRAM BUSINESS ====================

  /**
   * Igor (14/06 noite): handler do deeplink rotativo de ENTREGA.
   * `/start watch_<purchaseId>` — chamado quando cliente clica no botão
   * "🎬 título do filme" que veio na confirmação de pagamento.
   *
   * Roda no contexto do BOT que recebeu o /start (currentBotId via
   * AsyncLocalStorage). Valida posse da purchase, gera invite link do
   * grupo do filme via Bot API daquele bot, e manda no chat dela.
   *
   * Anti-cross-claim: se a purchase já foi resgatada por outro chat
   * e o atual é DIFERENTE, bloqueia (igual a flow de orphan order).
   * Se o chat atual é admin, também bloqueia.
   */
  private async handleWatchDeepLink(
    chatId: number,
    purchaseId: string,
    userId?: string,
    telegramUserId?: number,
  ) {
    try {
      // Busca a purchase + content + order.
      const { data: purchaseRaw } = await this.supabase
        .from('purchases')
        .select(
          'id, order_id, user_id, content_id, delivery_sent, is_presale_purchase, ' +
          'content:content(id, title, telegram_group_link, telegram_chat_id, delivery_bot_id, is_presale)',
        )
        .eq('id', purchaseId)
        .maybeSingle();
      const purchase: any = purchaseRaw;

      if (!purchase) {
        await this.sendMessage(chatId, '❌ Acesso não encontrado. Use /start pra começar.');
        return;
      }

      const content: any = Array.isArray(purchase.content) ? purchase.content[0] : purchase.content;
      if (!content) {
        await this.sendMessage(chatId, '❌ Conteúdo não encontrado. Avise o suporte.');
        return;
      }

      // Confirma que a order da purchase está paga.
      const { data: order } = await this.supabase
        .from('orders')
        .select('id, status, telegram_chat_id')
        .eq('id', purchase.order_id)
        .maybeSingle();
      if (!order || order.status !== 'paid') {
        await this.sendMessage(chatId, '❌ Pedido ainda não foi pago. Aguarde a confirmação.');
        return;
      }

      // Anti-cross-claim: se o chat atual é admin/employee/master, bloqueia.
      const { data: claimerUser } = await this.supabase
        .from('users')
        .select('id, role')
        .eq('telegram_chat_id', String(chatId))
        .maybeSingle();
      if (claimerUser?.role && ['admin', 'employee', 'master'].includes(claimerUser.role)) {
        this.logger.warn(
          `[watch-block] role=${claimerUser.role} chat=${chatId} tentou abrir purchase ${purchaseId}`,
        );
        await this.sendMessage(
          chatId,
          '⚠️ Esta conta administrativa não pode resgatar acessos.\n\nUse o painel admin pra enviar manualmente pro cliente.',
        );
        return;
      }

      // Se purchase já tem user_id e é DIFERENTE do user atual → outra conta tentando resgatar.
      if (purchase.user_id && userId && purchase.user_id !== userId) {
        await this.sendMessage(
          chatId,
          '⚠️ Este acesso já foi vinculado a outra conta do Telegram.\n\nSe foi você que pagou, fale com o suporte pra liberar manualmente.',
        );
        return;
      }

      // Vincula user_id + atualiza chat da order se ainda estava vazia.
      const updates: Record<string, any> = {};
      if (!purchase.user_id && userId) updates.user_id = userId;
      if (Object.keys(updates).length) {
        await this.supabase.from('purchases').update(updates).eq('id', purchase.id);
      }
      if (!order.telegram_chat_id) {
        await this.supabase
          .from('orders')
          .update({ telegram_chat_id: String(chatId), updated_at: new Date().toISOString() })
          .eq('id', order.id);
      }

      // Gera invite link do grupo. Usa o bot admin do grupo (delivery_bot_id)
      // pra criar o invite — bots novos não são admin dos 661 grupos antigos.
      // O envio da MENSAGEM, porém, sai pelo bot do contexto atual (cliente
      // fica registrada nesse bot adicional).
      const rawChatId: string | null = content.telegram_chat_id?.trim() || null;
      const rawLink: string | null = content.telegram_group_link?.trim() || null;
      let chatIdToTry = rawChatId;
      if (!chatIdToTry && rawLink && /^-?\d{6,}$/.test(rawLink)) chatIdToTry = rawLink;

      let buttonUrl: string | null = null;
      if (chatIdToTry) {
        try {
          buttonUrl = await this.createInviteLinkForUser(
            chatIdToTry,
            purchase.id,
            content.delivery_bot_id || null,
          );
        } catch (err: any) {
          this.logger.warn(
            `[watch] createInviteLinkForUser failed (chat=${chatIdToTry}, bot=${content.delivery_bot_id || 'default'}): ${err.message}`,
          );
        }
      }
      if (!buttonUrl && rawLink && rawLink !== chatIdToTry) buttonUrl = rawLink;

      if (!buttonUrl) {
        await this.sendMessage(
          chatId,
          `⚠️ *${content.title}*: link pendente. Avise o suporte, vamos enviar manualmente.`,
          { parse_mode: 'Markdown' },
        );
        return;
      }

      await this.sendMessage(
        chatId,
        `🎬 *${content.title}*\n\nClique no botão abaixo pra entrar no grupo e assistir:`,
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '▶️ Acessar grupo', url: buttonUrl }]] },
        },
      );

      // Marca delivery_sent na purchase pra contadores ficarem consistentes.
      if (!purchase.delivery_sent) {
        await this.supabase.from('purchases').update({ delivery_sent: true }).eq('id', purchase.id);
      }
    } catch (err: any) {
      this.logger.error(`handleWatchDeepLink failed for purchase ${purchaseId}: ${err.message}`);
      await this.sendMessage(
        chatId,
        '❌ Tivemos um problema momentâneo. Tenta de novo em alguns segundos ou fale com o suporte.',
      );
    }
  }

  private async handleOrderDeepLink(chatId: number, orderToken: string, userId?: string) {
    try {
      const axios = (await import('axios')).default;
      const backendSelf = this.configService.get('BACKEND_SELF_URL') || 'http://localhost:3001';
      const response = await axios.get(`${backendSelf}/api/v1/orders/token/${orderToken}`, {
        timeout: 10000,
      });
      const order = response.data;

      if (!order) {
        await this.sendMessage(chatId, '❌ Pedido não encontrado.');
        return;
      }

      if (order.status === 'paid') {
        // Caso da Yanna: pagou via web sem login → order ficou órfã
        // (sem telegram_chat_id, possivelmente sem user_id). Aqui o
        // primeiro deep-link clicado linka tudo e dispara a entrega.
        // Se já estava linkada, só mostramos a mensagem informativa.
        try {
          const claimResp = await axios.post(
            `${backendSelf}/api/v1/orders/token/${orderToken}/claim`,
            {
              telegram_chat_id: String(chatId),
              user_id: userId,
            },
            { timeout: 10000 },
          );
          if (claimResp.data?.claimed) {
            // Entrega já foi disparada pelo backend. Não envia
            // mensagem extra aqui — `notifyBotForDelivery` já manda
            // o "Pagamento confirmado!" + botões dos filmes.
            return;
          }
          // Igor (14/06): novos motivos de bloqueio anti-cross-claim.
          // Admin tentando claim "pra verificar" recebe mensagem clara.
          if (claimResp.data?.reason === 'admin_chat_blocked') {
            await this.sendMessage(
              chatId,
              `⚠️ Esta conta administrativa não pode resgatar pedidos.\n\nUse o painel admin → Pedidos órfãos → "Transferir entrega" pra enviar pro cliente.`,
            );
            return;
          }
          if (claimResp.data?.reason === 'too_many_recent_claims') {
            await this.sendMessage(
              chatId,
              `⚠️ Esta conta já resgatou vários pedidos recentemente.\n\nSe vc é o cliente, fale com o suporte. Se vc é admin, use o painel pra liberar manualmente.`,
            );
            return;
          }
          if (claimResp.data?.alreadyLinked) {
            // Caso especial: o link foi resgatado por OUTRA conta.
            // Mensagem distinta pra orientar suporte — Igor recupera
            // manualmente via painel /admin/orphan-orders se for
            // legítimo (cliente trocou de número, etc.).
            if (claimResp.data?.reason === 'linked_to_other_chat') {
              await this.sendMessage(
                chatId,
                `⚠️ Esse pedido já foi resgatado por outra conta do Telegram.\n\nSe foi você que pagou, fale com o suporte para liberar manualmente.`,
              );
              return;
            }
            await this.sendMessage(
              chatId,
              `✅ Esse pedido já foi pago e entregue.\n\nUse /minhascompras para acessar seus conteúdos.`,
            );
            return;
          }
        } catch (err: any) {
          this.logger.warn(`Order claim failed for ${orderToken}: ${err.message}`);
        }
        await this.sendMessage(chatId, `✅ Esse pedido já foi pago.\n\nUse /minhascompras para acessar seus conteúdos.`);
        return;
      }

      // Igor (12/07): extraído pro helper sendOrderPixDeepLinkUX pra reuso
      // pelo bot promo (Cenário 3). Comportamento idêntico ao anterior.
      await this.sendOrderPixDeepLinkUX(chatId, order);
    } catch (err: any) {
      this.logger.error(`Order deep-link error: ${err.message}`);
      await this.sendMessage(chatId, '❌ Não foi possível carregar o pedido. Tente novamente.');
    }
  }

  /**
   * Igor (12/07): UX PIX unificada — order-scoped, título+QR+copia-cola+3 botões.
   * Reusado por:
   *   - handleOrderDeepLink (bot oficial, /start order_<token>)
   *   - OrdersService.generateAndSendPixForOrder (bot promo Cenário 3, /start pi_<token>)
   *
   * Padrão idêntico dos bots oficiais: título do filme, valor formatado, QR image
   * quando possível, copia-cola em bloco de código, botões (Já paguei / Não
   * consegui pagar / Cancelar). Callbacks são order-scoped — os handlers
   * order_check_/manual_pix_o_/order_cancel_ já existem.
   */
  public async sendOrderPixDeepLinkUX(chatId: number, order: any) {
    const orderToken = order.order_token;
    const qr = order.payment?.provider_meta?.qr_code;
    const qrB64 = order.payment?.provider_meta?.qr_code_base64;
    const items = order.purchases || [];
    const itemList = items
      .map((p: any, i: number) => `${i + 1}. ${p.content?.title || 'Item'}`)
      .join('\n');
    const discountLine = order.discount_percent > 0
      ? `\n🎁 Desconto aplicado: ${order.discount_percent}%`
      : '';
    const totalFmt = (order.total_cents / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
    });

    const header =
      `🛒 *Seu pedido*\n\n${itemList}${discountLine}\n\n💰 Total: *R$ ${totalFmt}*\n\n📱 Pague com PIX:`;

    if (qrB64) {
      try {
        const axiosLib = (await import('axios')).default;
        const FormData = require('form-data');
        const form = new FormData();
        form.append('chat_id', chatId.toString());
        form.append('photo', Buffer.from(qrB64.startsWith('data:') ? qrB64.split(',')[1] : qrB64, 'base64'), {
          filename: 'qrcode.png',
          contentType: 'image/png',
        });
        form.append('caption', header);
        form.append('parse_mode', 'Markdown');
        const qrApiUrl = await this.apiUrlForCurrent();
        await axiosLib.post(`${qrApiUrl}/sendPhoto`, form, {
          headers: form.getHeaders(),
        });
      } catch (imgErr: any) {
        const status = imgErr?.response?.status;
        const body = imgErr?.response?.data;
        this.logger.warn(
          `[PIX QR] sendPhoto falhou (status=${status}, body=${JSON.stringify(body)?.slice(0, 200)}): ${imgErr.message}`,
        );
        await this.sendMessage(chatId, header, { parse_mode: 'Markdown' });
      }
    } else {
      await this.sendMessage(chatId, header, { parse_mode: 'Markdown' });
    }

    if (qr) {
      // Igor (13/07): separa label do código em 2 mensagens. Antes ficavam
      // juntas (`*Código copia-e-cola:*\n\`${qr}\``) e quando cliente
      // segurava pro copiar o bloco monospace, o Telegram pegava o texto
      // "Código copia-e-cola:" junto — o PIX ia pro banco com lixo no
      // início. Agora label em msg própria + código PIX puro em bloco
      // dedicado, cliente segura só no código e copia limpo.
      await this.sendMessage(chatId, '📋 *Código copia-e-cola:*', { parse_mode: 'Markdown' });
      await this.sendMessage(chatId, `\`${qr}\``, { parse_mode: 'Markdown' });
    }

    await this.sendMessage(
      chatId,
      '⏳ Aguardando pagamento. Você receberá uma confirmação automática.\n\nDigite /start para iniciar o bot novamente.',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Já paguei', callback_data: `order_check_${orderToken}` }],
            [{ text: '⚠️ Não consegui pagar', callback_data: `manual_pix_o_${orderToken}` }],
            [{ text: '❌ Cancelar', callback_data: `order_cancel_${orderToken}` }],
          ],
        },
      },
    );
  }

  // Order callback handlers
  private async handleOrderCheckCallback(chatId: number, orderToken: string) {
    try {
      const axiosLib = (await import('axios')).default;
      const backendSelf = this.configService.get('BACKEND_SELF_URL') || 'http://localhost:3001';
      const response = await axiosLib.get(`${backendSelf}/api/v1/orders/token/${orderToken}`, {
        timeout: 10000,
      });
      const order = response.data;
      if (!order) {
        await this.sendMessage(chatId, '❌ Pedido não encontrado.');
        return;
      }
      if (order.status === 'paid') {
        await this.sendMessage(
          chatId,
          '✅ *Pagamento confirmado!*\n\nVou te enviar os links em instantes.',
          { parse_mode: 'Markdown' },
        );
        // Delivery is normally triggered by webhook; this is just a UX confirmation.
      } else {
        await this.sendMessage(
          chatId,
          '⏳ Ainda não identificamos seu pagamento. Aguarde mais alguns segundos ou tente novamente.',
        );
      }
    } catch (err: any) {
      this.logger.error(`Order check callback error: ${err.message}`);
      await this.sendMessage(chatId, '❌ Erro ao verificar pagamento.');
    }
  }

  private async handleOrderCancelCallback(chatId: number, orderToken: string) {
    try {
      const { data: order } = await this.supabase
        .from('orders')
        .select('id, status')
        .eq('order_token', orderToken)
        .maybeSingle();
      if (!order) {
        await this.sendMessage(chatId, '❌ Pedido não encontrado.');
        return;
      }
      if (order.status === 'paid') {
        await this.sendMessage(chatId, 'Esse pedido já foi pago — não dá pra cancelar.');
        return;
      }
      await this.supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', order.id);
      await this.cleanupTrackedMessages(chatId);
      await this.sendMessage(
        chatId,
        '❌ Pedido cancelado.\n\nDigite /start para iniciar o bot novamente.',
      );
    } catch (err: any) {
      this.logger.error(`Order cancel callback error: ${err.message}`);
      await this.sendMessage(chatId, '❌ Erro ao cancelar pedido.');
    }
  }

  /**
   * Igor (14/06 noite, segunda iteração): "Não consegui pagar" no bot.
   * Mesmo fluxo do site mas via Telegram. Cliente clica → bot mostra
   * chave PIX + valor + 2 botões (Enviar comprovante no Telegram direto
   * pro Igor + Voltar ao menu inicial).
   */
  private async handleManualPixCallback(
    chatId: number,
    kind: 'order' | 'purchase',
    id: string,
  ) {
    try {
      let amountCents = 0;
      let refLabel = id.slice(0, 8);
      // Igor (28/06): inclui nome do filme/série na mensagem pra ele
      // identificar a compra rapidamente quando chegar comprovante.
      let itemsLabel: string | null = null;

      if (kind === 'order') {
        const { data: order } = await this.supabase
          .from('orders')
          .select('id, order_token, total_cents')
          .eq('order_token', id)
          .maybeSingle();
        if (!order) {
          await this.sendMessage(chatId, '❌ Pedido não encontrado.');
          return;
        }
        amountCents = order.total_cents || 0;
        refLabel = order.order_token.slice(0, 8);
        const { data: pus } = await this.supabase
          .from('purchases')
          .select('content(title)')
          .eq('order_id', order.id);
        const titles = (pus || [])
          .map((p: any) => (Array.isArray(p.content) ? p.content[0]?.title : p.content?.title))
          .filter(Boolean);
        if (titles.length) itemsLabel = titles.join(', ');
      } else {
        const { data: purchase } = await this.supabase
          .from('purchases')
          .select('id, amount_cents, content(title)')
          .eq('id', id)
          .maybeSingle();
        if (!purchase) {
          await this.sendMessage(chatId, '❌ Compra não encontrada.');
          return;
        }
        amountCents = purchase.amount_cents || 0;
        refLabel = purchase.id.slice(0, 8);
        const content: any = Array.isArray((purchase as any).content)
          ? (purchase as any).content[0]
          : (purchase as any).content;
        if (content?.title) itemsLabel = content.title;
      }

      const { data: settingsRows } = await this.supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', [
          'manual_pix_enabled',
          'manual_pix_key',
          'manual_pix_key_label',
          'manual_pix_telegram_username',
          'manual_pix_whatsapp',
        ]);
      const settings: Record<string, string> = {};
      for (const r of settingsRows || []) settings[(r as any).key] = (r as any).value || '';

      if ((settings['manual_pix_enabled'] ?? 'true') !== 'true' || !settings['manual_pix_key']) {
        await this.sendMessage(
          chatId,
          '⚠️ PIX manual não está disponível no momento. Aguarde o atendimento.',
        );
        return;
      }

      const pixKey = settings['manual_pix_key'];
      const pixLabel = settings['manual_pix_key_label'] || 'E-mail';
      const amountFmt = (amountCents / 100).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
      });
      const tgUsername = (settings['manual_pix_telegram_username'] || '').replace(/^@/, '');
      const waNumber = (settings['manual_pix_whatsapp'] || '').replace(/\D/g, '');

      // Monta linha-a-linha — mais robusto contra problemas de markdown.
      const text =
        `💳 *PIX manual*\n\n` +
        `Alguns bancos não aceitam o PIX automático. Pague pela chave abaixo no seu app bancário:\n\n` +
        `🔑 *Chave (${pixLabel}):*\n\`${pixKey}\`\n\n` +
        `💰 *Valor:* R$ ${amountFmt}\n` +
        (itemsLabel ? `🎬 *Conteúdo:* ${itemsLabel}\n` : '') +
        `🧾 *Pedido:* ${refLabel}\n\n` +
        `📨 Após pagar, envie o comprovante pra liberarmos manual.`;

      // Mensagem pronta pro admin reconhecer (vem com nome do filme).
      const refMsg = itemsLabel
        ? `Olá! Acabei de pagar *${itemsLabel}* no valor de R$ ${amountFmt} pelo PIX manual. Vou enviar o comprovante a seguir. (pedido ${refLabel})`
        : `Olá! Acabei de pagar o pedido ${refLabel} no valor de R$ ${amountFmt} pelo PIX manual. Vou enviar o comprovante a seguir.`;

      const buttons: Array<Array<{ text: string; url?: string; callback_data?: string }>> = [];
      if (tgUsername) {
        const tgText = encodeURIComponent(refMsg);
        buttons.push([{ text: '📨 Enviar comprovante (Telegram)', url: `https://telegram.me/${tgUsername}?text=${tgText}` }]);
      }
      if (waNumber) {
        const waText = encodeURIComponent(refMsg);
        buttons.push([{ text: '📱 Enviar pelo WhatsApp', url: `https://wa.me/${waNumber}?text=${waText}` }]);
      }
      buttons.push([{ text: '🔙 Voltar ao menu', callback_data: 'start' }]);

      await this.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons },
      });
    } catch (err: any) {
      this.logger.error(`handleManualPixCallback (${kind}=${id}) failed: ${err.message}`);
      await this.sendMessage(chatId, '❌ Erro ao gerar PIX manual. Tente novamente.');
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
    } else if (data?.startsWith('order_check_')) {
      const token = data.replace('order_check_', '');
      await this.handleOrderCheckCallback(chatId, token);
    } else if (data?.startsWith('order_cancel_')) {
      const token = data.replace('order_cancel_', '');
      await this.handleOrderCancelCallback(chatId, token);
    } else if (data?.startsWith('manual_pix_o_')) {
      const token = data.replace('manual_pix_o_', '');
      await this.handleManualPixCallback(chatId, 'order', token);
    } else if (data?.startsWith('manual_pix_p_')) {
      const id = data.replace('manual_pix_p_', '');
      await this.handleManualPixCallback(chatId, 'purchase', id);
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
    } else if (data === 'start' || data === 'menu') {
      await this.handleStartCommand(chatId, '/start', telegramUserId);
    } else if (data === 'add_whatsapp') {
      if (telegramUserId) {
        this.pendingWhatsappCapture.set(telegramUserId, true);
        await this.sendMessage(chatId, '📱 Me manda seu número com DDD (só números, ex: 11999999999)');
      }
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
      // Clean up the "payment choice" message before showing the PIX
      await this.cleanupTrackedMessages(chatId);

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

      // Igor (15/05): nome do conteúdo sumiu da tela de Pix. Buscamos
      // título + tipo da purchase pra mostrar acima do valor no caption.
      let contentLine = '';
      try {
        const { data: pixPurchase } = await this.supabase
          .from('purchases')
          .select('content(title, content_type)')
          .eq('id', purchaseId)
          .single();
        const pixContent = Array.isArray(pixPurchase?.content)
          ? pixPurchase?.content[0]
          : pixPurchase?.content;
        if (pixContent?.title) {
          const isSeries = (pixContent.content_type || '').toLowerCase() === 'series';
          contentLine = `${isSeries ? '📺 Série' : '🎬 Filme'}: *${pixContent.title}*\n`;
        }
      } catch (err: any) {
        this.logger.warn(`Could not fetch content title for PIX caption: ${err?.message || err}`);
      }

      // Enviar QR Code como foto (se disponível). Caption tem nome do
      // filme + valor + instruções — peça crítica da UX. Igor (19/06):
      // se sendPhoto falhar (Telegram rate, FormData, bot sem permissão
      // de foto, etc), CAI no fallback de sendMessage com o mesmo texto
      // pra cliente não ficar com só copia-e-cola sem contexto.
      const pixCaption = `📱 *Pagamento PIX*\n\n${contentLine}💰 Valor: R$ ${pixData.amount_brl}\n⏱️ Válido por: 1 hora\n\n*Como pagar:*\n1. Abra seu app bancário\n2. Escaneie o QR Code acima (ou use o código abaixo)\n3. Confirme o pagamento`;
      let qrSent = false;
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
          form.append('caption', pixCaption);
          form.append('parse_mode', 'Markdown');

          const qr2ApiUrl = await this.apiUrlForCurrent();
          await axios.post(`${qr2ApiUrl}/sendPhoto`, form, {
            headers: form.getHeaders(),
          });
          qrSent = true;
          this.logger.log('QR Code image sent successfully');
        } catch (photoError: any) {
          const status = photoError?.response?.status;
          const body = photoError?.response?.data;
          this.logger.warn(
            `[PIX QR] sendPhoto falhou (status=${status}, body=${JSON.stringify(body)?.slice(0, 200)}): ${photoError.message}`,
          );
        }
      }
      // Fallback: se QR não foi enviado (sem imagem OU sendPhoto falhou),
      // manda o cabeçalho como texto pra cliente ver título + valor.
      if (!qrSent) {
        await this.sendMessage(chatId, pixCaption, { parse_mode: 'Markdown' });
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
            [{ text: '⚠️ Não consegui pagar', callback_data: `manual_pix_p_${purchaseId}` }],
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
          const frontendUrl = this.getFrontendUrl();
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
          const frontendUrl = this.getFrontendUrl();
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

          // Igor (17/05): pós-pagamento manda APENAS a confirmação +
          // "🎬 Assistir Agora" (acima). Os links de acesso ao grupo
          // (single-use 24h + fixo) só são enviados quando o cliente
          // clica em "Assistir" no dashboard/home → endpoint
          // POST /telegrams/send-access/:contentId (sendAccessToUser).
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
              const frontendUrl = this.getFrontendUrl();
              const dashUrl = `${frontendUrl}/auth/telegram-login?telegram_id=${chatId}&redirect=/dashboard`;

              await this.sendMessage(chatId,
                `✅ *Pagamento Confirmado!*\n\n🎬 *${contentTitle}*\n💰 Valor: R$ ${priceText}\n\nSeu conteudo ja esta disponivel! Acesse pelo botao abaixo.\n\n🛍 Para realizar novas compras no aplicativo, digite /start`,
                { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🎬 Assistir Agora', url: dashUrl }]] } }
              );

              // Igor (17/05): pós-pagamento manda só a confirmação +
              // "🎬 Assistir Agora". Os links de acesso ao grupo só são
              // enviados quando o cliente clica em "Assistir" no
              // dashboard → endpoint send-access (sendAccessToUser).
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
              [{ text: '📞 Suporte', url: 'https://telegram.me/CineVisionOfc' }],
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

  /**
   * Igor (04/07): Cenário 3 — cria intent + envia botão pro bot promo.
   *
   * Cliente está no bot oficial A, clicou Comprar num lançamento com
   * bot promo vinculado. Aqui:
   * 1. mint token curto (nanoid 16 chars) pra caber no deep-link do /start
   * 2. INSERT purchase_intent (status=pending, expires_at=+15min)
   * 3. sendMessage no bot oficial A com botão `t.me/<promo>?start=pi_<token>`
   * 4. cliente clica → cai em @promo → handlePurchaseIntent lá consome
   *
   * Retorna true se conseguiu desviar (chamador NÃO segue fluxo normal).
   * Retorna false em qualquer erro (chamador cai no fluxo normal).
   */
  private async detourPurchaseToPromoBot(args: {
    chatId: number;
    telegramUserId: number;
    content: any;
    currentBotId: string | null;
    promo: {
      id: string;
      username: string;
      custom_display_name: string | null;
      display_name: string | null;
    };
  }): Promise<boolean> {
    const { chatId, telegramUserId, content, currentBotId, promo } = args;

    // Anti-cross-claim: só cliente comum pode ir pra fluxo promo. Admin/
    // employee testando não devem virar customer no bot promo.
    // (Verificação leve — se user não existe, ok; se existe e é role
    // administrativo, aborta pro fluxo normal).
    try {
      const { data: existingUser } = await this.supabase
        .from('users')
        .select('role')
        .eq('telegram_id', telegramUserId.toString())
        .maybeSingle();
      const adminRoles = ['admin', 'master', 'employee', 'moderator'];
      if (existingUser?.role && adminRoles.includes(existingUser.role.toLowerCase())) {
        this.logger.log(
          `[promo-detour] skipping — user role=${existingUser.role} (anti-cross-claim)`,
        );
        return false;
      }
    } catch { /* melhor errar pra fluxo normal do que travar */ }

    // Igor (13/07): usa helper canônico — respeita presale > discount > full.
    // Antes só olhava presale, ignorava flash promo. Bug: filme com 5% flash
    // ativo mostrava R$ 7,50 no site mas bot promo cobrava R$ 7,90.
    const discount = await this.resolveActiveDiscount(content);
    const { priceCents } = getEffectivePriceCents(content, discount);

    if (!priceCents || priceCents <= 0) {
      this.logger.warn(`[promo-detour] content ${content.id} has no valid price`);
      return false;
    }

    // Gerar token curto (16 chars base62). Não uso lib externa —
    // Math.random é suficiente pra token efêmero de 15min (colisão
    // estatisticamente ~0 em 15 min de tráfego real).
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 16; i++) {
      token += alphabet[Math.floor(Math.random() * alphabet.length)];
    }

    // INSERT intent
    const { data: intent, error: intentErr } = await this.supabase
      .from('purchase_intents')
      .insert({
        token,
        content_id: content.id,
        promo_bot_id: promo.id,
        origin_bot_id: currentBotId,
        origin_chat_id: chatId,
        origin_telegram_user_id: telegramUserId,
        amount_cents: priceCents,
        status: 'pending',
        source: 'bot', // Igor (12/07): marca de procedência pra analytics
        // expires_at usa default do banco (+15min)
      })
      .select()
      .single();

    if (intentErr || !intent) {
      this.logger.error(`[promo-detour] failed to insert intent: ${intentErr?.message}`);
      return false;
    }

    // Envia mensagem no chat atual (bot oficial A) com botão pro bot promo
    const promoDisplay = promo.custom_display_name || promo.display_name || `@${promo.username}`;
    const deeplink = `https://telegram.me/${promo.username}?start=pi_${token}`;
    try {
      await this.sendMessage(
        chatId,
        `🎬 *${content.title}* é lançamento exclusivo!\n\n` +
        `Pra garantir sua cópia, continue no nosso bot parceiro *${promoDisplay}* — ` +
        `é só clicar no botão abaixo, ele te leva direto pra pagamento.\n\n` +
        `_Link válido por 15 minutos._`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: `▶️ Ir para o bot`, url: deeplink }]],
          },
        },
      );
      return true;
    } catch (err: any) {
      this.logger.error(`[promo-detour] failed to send detour message: ${err.message}`);
      // Marca intent como expirado imediatamente (cleanup rápido)
      await this.supabase
        .from('purchase_intents')
        .update({ status: 'expired' })
        .eq('id', intent.id);
      return false;
    }
  }

  /**
   * Igor (12/07): fix do LOOP INFINITO no bot promo.
   *
   * Antes: site montava t.me/<promo>?start=buy_<id>. Bot promo não sabia
   * processar `buy_` (só `pi_`), caía em handlePromoWelcome que mandava
   * cliente pro site — loop infinito.
   *
   * Agora: site chama esse endpoint POST, backend cria intent e retorna
   * deeplink pi_<token>. Bot promo processa via handlePurchaseIntent
   * (mesmo fluxo do Cenário 3 do bot oficial) → gera PIX imediato.
   *
   * Se o filme não tem promo vinculado OU o bot promo está indisponível,
   * lança NotFoundException e o frontend cai no fallback (bot oficial
   * via rotação).
   */
  public async createIntentForSiteVisitor(contentId: string): Promise<{
    deeplink: string;
    token: string;
    expires_at: string;
  }> {
    // 1. Valida via getPromoBotForContent (já reúne todos os guards:
    //    is_release, promotional_bot_id, is_promotional, status=active,
    //    last_seen_ok_at + grace period 24h)
    const check = await this.getPromoBotForContent(contentId);
    if (!check.available || !check.username) {
      throw new NotFoundException(`Promo bot not available: ${check.reason || 'unknown'}`);
    }

    // 2. Busca content pra preço snapshot
    const { data: content } = await this.supabase
      .from('content')
      .select('id, price_cents, is_presale, presale_price_cents, promotional_bot_id')
      .eq('id', contentId)
      .maybeSingle();

    if (!content || !content.promotional_bot_id) {
      throw new NotFoundException('Content or promo bot link not found');
    }

    // Igor (13/07): usa helper canônico — respeita presale > discount > full.
    const discount = await this.resolveActiveDiscount(content);
    const { priceCents } = getEffectivePriceCents(content, discount);

    if (!priceCents || priceCents <= 0) {
      throw new BadRequestException('Content has no valid price');
    }

    // 3. Gera token curto (16 chars base62)
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 16; i++) {
      token += alphabet[Math.floor(Math.random() * alphabet.length)];
    }

    // 4. INSERT intent com marca de procedência 'site'
    //    origin_bot_id=NULL (não veio de bot), origin_chat_id=0,
    //    origin_telegram_user_id=0 (site não sabe o user antes do /start)
    const { data: intent, error: intentErr } = await this.supabase
      .from('purchase_intents')
      .insert({
        token,
        content_id: content.id,
        promo_bot_id: content.promotional_bot_id,
        origin_bot_id: null,
        origin_chat_id: 0,
        origin_telegram_user_id: 0,
        amount_cents: priceCents,
        status: 'pending',
        source: 'site',
      })
      .select('id, token, expires_at')
      .single();

    if (intentErr || !intent) {
      this.logger.error(`[site-intent] insert failed: ${intentErr?.message}`);
      throw new BadRequestException('Failed to create purchase intent');
    }

    return {
      deeplink: `https://telegram.me/${check.username}?start=pi_${token}`,
      token: intent.token,
      expires_at: intent.expires_at,
    };
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

    // Igor (04/07): Cenário 3 — se conteúdo é LANÇAMENTO E tem bot
    // promocional vinculado E o bot atual NÃO é o promo, desviamos o
    // fluxo pro bot promo (aumenta interação real nele → melhor ranking
    // na busca do Telegram).
    //
    // Guards de segurança:
    // - só se promo.status='active' (senão bot pode estar suspenso)
    // - só se healthcheck recente (last_seen_ok_at < 5min) — evita
    //   redirect pra bot que talvez esteja fora
    // - se qualquer guard falha, degrada silenciosamente pro fluxo padrão
    //
    // Se der ruim aqui, fluxo continua normal (fail-safe).
    try {
      const currentBotId = await this.resolveCurrentBotId();
      if (
        content.is_release &&
        content.promotional_bot_id &&
        content.promotional_bot_id !== currentBotId
      ) {
        const promo = await this.getBotMeta(content.promotional_bot_id);
        const staleThresholdMs = 5 * 60 * 1000;
        const healthy = !!promo?.last_seen_ok_at &&
          Date.now() - new Date(promo.last_seen_ok_at).getTime() < staleThresholdMs;
        if (promo && promo.status === 'active' && healthy) {
          const detoured = await this.detourPurchaseToPromoBot({
            chatId,
            telegramUserId,
            content,
            currentBotId,
            promo,
          });
          if (detoured) return;
        } else {
          this.logger.log(
            `[promo-detour] skipping (bot=${promo?.username} status=${promo?.status} healthy=${healthy})`,
          );
        }
      }
    } catch (err: any) {
      this.logger.warn(`[promo-detour] guard failed, falling back to normal flow: ${err.message}`);
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
   * Igor (12/07): stamp de user quando cliente dá /start num bot promocional.
   *
   * Antes: branch is_promotional em handleStartCommand só gravava em
   * promotional_bot_starts (log) e pulava findOrCreateUserByTelegramId.
   * Resultado: users promocionais não apareciam em `users` → broadcast
   * mostrava promocional=0 no painel /admin/broadcast.
   *
   * Agora: garante que existe row em `users` pra esse telegram_id, e
   * marca bot_username=<promo_username> se ainda não tinha bot cadastrado.
   *
   * Semântica "primeiro bot ganha": se cliente já deu /start num bot
   * oficial antes, mantém o bot_username oficial. Broadcast oficial
   * não perde ninguém. Só stamp se estava sem bot ou sem chat_id.
   */
  private async upsertPromoUser(telegramUserId: number, chatId: number, promoUsername: string) {
    try {
      const tgId = String(telegramUserId);
      const { data: existing } = await this.supabase
        .from('users')
        .select('id, bot_username, telegram_chat_id')
        .eq('telegram_id', tgId)
        .maybeSingle();

      if (!existing) {
        await this.supabase.from('users').insert({
          telegram_id: tgId,
          telegram_chat_id: chatId.toString(),
          bot_username: promoUsername,
          blocked: false,
        });
        return;
      }

      const patch: Record<string, any> = {};
      if (!existing.bot_username) patch.bot_username = promoUsername;
      if (!existing.telegram_chat_id) patch.telegram_chat_id = chatId.toString();
      if (Object.keys(patch).length) {
        await this.supabase.from('users').update(patch).eq('id', existing.id);
      }
    } catch (err: any) {
      this.logger.warn(`[promo] upsertPromoUser failed: ${err?.message || err}`);
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

        // Re-activate user if they were blocked (they're interacting again)
        if (existingUser.blocked) {
          updates.blocked = false;
          this.logger.log(`Re-activating previously blocked user ${telegramUserId}`);
        }

        // Stamp which bot this user is now on (multi-bot aware — usa o bot real do contexto)
        const currentBotUsername = await this.currentBotUsername();
        if (existingUser.bot_username !== currentBotUsername) {
          updates.bot_username = currentBotUsername;
        }

        // Igor (15/05): last_bot_token nunca era populado aqui — só em paths
        // específicos (linha ~1194). Resultado: users que vieram do bot antigo
        // ficavam com last_bot_token=NULL ou apontando pro bot antigo, e o
        // filtro do broadcast (getBotUsersCount) os excluía. Gap de 1528 vs
        // 612 reportado pelo Igor. Agora todo /start já regista o bot atual.
        if (this.botToken && existingUser.last_bot_token !== this.botToken) {
          updates.last_bot_token = this.botToken;
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

      const tempEmail = `telegram_${telegramUserId}@cinevision.temp`;
      const { data: newUser, error: createError } = await this.supabase
        .from('users')
        .insert({
          telegram_id: telegramUserId.toString(),
          telegram_chat_id: chatId.toString(),
          telegram_username: username,
          name: userName,
          email: tempEmail, // Email temporário
          password_hash: await bcrypt.hash(Math.random().toString(36), 12), // Senha aleatória
          role: 'user',
          status: 'active',
          bot_username: await this.currentBotUsername(), // multi-bot aware
          // Igor (15/05): garante elegibilidade pro broadcast desde o /start.
          last_bot_token: this.botToken,
        })
        .select()
        .single();

      if (createError || !newUser) {
        // Fallback: o SELECT por telegram_id falhou (linha ~1983), mas o
        // INSERT bate em UNIQUE no email — significa que existe um user
        // com o mesmo email mas que o SELECT inicial não pegou (race
        // condition entre /start simultâneos, ou corrupção histórica de
        // telegram_id na linha já existente). Em vez de devolver null e
        // mandar "Erro ao processar usuário" pro cliente — que é o bug
        // reportado pelo Igor — recuperamos a linha pelo email único e
        // garantimos que `telegram_id`/`telegram_chat_id` ficam corretos.
        if (createError && (createError as any).code === '23505') {
          this.logger.warn(
            `Insert raced on email ${tempEmail} (telegram_id ${telegramUserId}); recovering existing row by email.`,
          );
          const { data: byEmail } = await this.supabase
            .from('users')
            .select('*')
            .eq('email', tempEmail)
            .single();

          if (byEmail) {
            // Reconcilia telegram_id/chat_id se o registro estava órfão
            // ou desatualizado.
            const fix: any = {};
            if (byEmail.telegram_id !== telegramUserId.toString()) {
              fix.telegram_id = telegramUserId.toString();
            }
            if (byEmail.telegram_chat_id !== chatId.toString()) {
              fix.telegram_chat_id = chatId.toString();
            }
            // Igor (15/05): também marca o bot atual aqui (recovery path).
            if (this.botToken && byEmail.last_bot_token !== this.botToken) {
              fix.last_bot_token = this.botToken;
            }
            if (Object.keys(fix).length > 0) {
              await this.supabase.from('users').update(fix).eq('id', byEmail.id);
              this.logger.log(
                `Recovered user ${byEmail.id}; reconciled fields: ${Object.keys(fix).join(',')}`,
              );
            }
            return { ...byEmail, ...fix };
          }
        }

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

  /**
   * Igor (04/07): mensagem de boas-vindas de bot promocional.
   *
   * Cliente encontrou o bot na busca do Telegram (nome de filme em alta)
   * → deu /start → queremos ele no site rápido. Mensagem curta, CTA
   * forte, imagem do filme quando possível (aumenta conversão).
   *
   * Se o bot tem `promotional_content_id` configurado, busca poster e
   * título do content e usa como base da mensagem. Senão, mensagem
   * genérica com link do catálogo.
   */
  private async handlePromoWelcome(chatId: number, bot: {
    id: string;
    username: string;
    promotional_content_id: string | null;
    promotional_target_url: string | null;
  }) {
    const frontendUrl = this.getFrontendUrl();
    let content: any = null;
    if (bot.promotional_content_id) {
      const { data } = await this.supabase
        .from('content')
        .select('id, title, poster_url, content_type, quality_label')
        .eq('id', bot.promotional_content_id)
        .maybeSingle();
      content = data || null;
    }

    // Landing carrega `?promo_bot=<username>&promo_content=<id>` — o
    // <PromoLinkCapture /> do site grava sessionStorage, e o botão
    // Comprar sabe desviar pra bot oficial (Cenário 1).
    const buildLandingUrl = () => {
      if (bot.promotional_target_url && bot.promotional_target_url.trim()) {
        const raw = bot.promotional_target_url.trim();
        const sep = raw.includes('?') ? '&' : '?';
        return `${raw}${sep}promo_bot=${encodeURIComponent(bot.username)}${content ? `&promo_content=${encodeURIComponent(content.id)}` : ''}`;
      }
      if (content) {
        const path = content.content_type === 'series' ? 'series' : 'movies';
        return `${frontendUrl}/${path}/${content.id}?promo_bot=${encodeURIComponent(bot.username)}&promo_content=${encodeURIComponent(content.id)}`;
      }
      return `${frontendUrl}/?promo_bot=${encodeURIComponent(bot.username)}`;
    };

    const landingUrl = buildLandingUrl();
    const title = content?.title || 'Cine Vision';
    // Igor (12/07): puxar qualidade REAL do content, não hardcoded "Full HD".
    // Fallback pra "alta" quando quality_label não está preenchido.
    const quality = content?.quality_label || 'alta';
    const caption = content
      ? `🎬 *${title}*\n\n✅ Você encontrou o conteúdo que procura!\n\n🍿 Assista agora com qualidade ${quality} e acesso vitalício.`
      : `🎬 *Cine Vision*\n\n✅ Bem-vindo! Aqui você encontra milhares de filmes e séries.\n\n🍿 Toque no botão pra ver o catálogo completo.`;

    const replyMarkup = {
      inline_keyboard: [[{ text: '▶️ ASSISTIR AGORA', url: landingUrl }]],
    };

    try {
      // Telegram renderiza preview do poster automaticamente se URL vem
      // no texto com Markdown. Simples e sem depender de sendPhoto.
      const textWithPoster = content?.poster_url
        ? `[​](${content.poster_url})${caption}` // zero-width space + link invisível no início
        : caption;
      await this.sendMessage(chatId, textWithPoster, {
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
      });
    } catch (err: any) {
      this.logger.warn(`handlePromoWelcome failed, falling back to plain text: ${err.message}`);
      await this.sendMessage(chatId, caption, {
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
      });
    }
  }

  /**
   * Igor (04/07): consumo de purchase intent (Cenário 3).
   *
   * Cliente estava no bot oficial A, clicou "Comprar Superman" (filme com
   * promotional_bot_id vinculado), sistema criou intent + botão pro bot
   * promo. Cliente clicou → chegou aqui via /start pi_<token>.
   *
   * Aqui: valida intent, cria order (com origin_promotional_bot_id +
   * origin_official_bot_id), gera PIX (Oasyfy), manda QR — TUDO isso
   * pelo bot promo (via ALS). Cliente paga aqui mesmo.
   *
   * Idempotência: se intent já foi consumido, reenvia o QR da mesma
   * order (não cria duplicata).
   *
   * Guard de concorrência: UPDATE condicional WHERE status='pending' —
   * apenas 1 request cria a order, outros recuperam.
   */
  private async handlePurchaseIntent(chatId: number, telegramUserId: number, token: string) {
    // 1. Buscar intent
    const { data: intent, error: intentErr } = await this.supabase
      .from('purchase_intents')
      .select('*, content:content(id, title, poster_url, price_cents, content_type)')
      .eq('token', token)
      .maybeSingle();

    if (intentErr || !intent) {
      await this.sendMessage(chatId,
        '⚠️ Link inválido ou já usado. Volte ao bot original e clique em Comprar novamente.');
      return;
    }

    const expired = new Date(intent.expires_at).getTime() < Date.now();
    if (intent.status === 'expired' || expired) {
      await this.sendMessage(chatId,
        '⏰ Este link expirou. Volte ao bot original e clique em Comprar novamente pra gerar um novo link.');
      return;
    }

    // 2. Idempotência: se já consumido, reenvia PIX da order existente
    if (intent.status === 'consumed' && intent.order_id) {
      try {
        await this.resendPixForOrder(intent.order_id, chatId);
      } catch (err: any) {
        this.logger.warn(`resendPixForOrder failed for order ${intent.order_id}: ${err.message}`);
        await this.sendMessage(chatId,
          '⚠️ Sua compra já foi iniciada mas não conseguimos reenviar o PIX agora. Fale com o suporte.');
      }
      return;
    }

    // 3. Cria/vincula usuário
    const user = await this.findOrCreateUserByTelegramId(telegramUserId, chatId);
    if (!user) {
      await this.sendMessage(chatId, '❌ Erro ao processar usuário. Tente /start novamente.');
      return;
    }

    // 4. Delega criação da order + PIX pro OrdersService (novo método)
    let order: any;
    try {
      if (!this.ordersService) {
        throw new Error('OrdersService not injected');
      }
      order = await this.ordersService.createOrderFromIntent(intent, user, chatId);
    } catch (err: any) {
      this.logger.error(`createOrderFromIntent failed for token=${token}: ${err.message}`);
      await this.sendMessage(chatId,
        '❌ Erro ao criar seu pedido. Volte ao bot original e tente novamente.');
      return;
    }

    // 5. Guard de concorrência: marca intent consumido só se ainda pending
    const { data: consumed } = await this.supabase
      .from('purchase_intents')
      .update({
        status: 'consumed',
        order_id: order.id,
        consumed_at: new Date().toISOString(),
      })
      .eq('id', intent.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (!consumed) {
      // Outro request ganhou. Refetcha o order_id atualizado e reenvia PIX.
      const { data: fresh } = await this.supabase
        .from('purchase_intents').select('order_id').eq('id', intent.id).maybeSingle();
      if (fresh?.order_id) {
        await this.resendPixForOrder(fresh.order_id, chatId);
      }
      return;
    }

    // 6. Gera PIX + envia QR (sai pelo bot promo via ALS)
    try {
      if (!this.ordersService) throw new Error('OrdersService not injected');
      await this.ordersService.generateAndSendPixForOrder(order.id, chatId, telegramUserId);
    } catch (err: any) {
      this.logger.error(`generateAndSendPixForOrder failed: ${err.message}`);
      await this.sendMessage(chatId,
        '⚠️ Sua compra foi criada mas não conseguimos gerar o PIX agora. Fale com o suporte.');
    }
  }

  /**
   * Reenvia o PIX/QR de uma order já criada. Usado quando cliente clica no
   * mesmo link do intent 2x (idempotência).
   */
  private async resendPixForOrder(orderId: string, chatId: number) {
    if (!this.ordersService) throw new Error('OrdersService not injected');
    // Delegado pro OrdersService que já tem toda a lógica de PIX.
    await this.ordersService.generateAndSendPixForOrder(orderId, chatId);
  }

  private async handleStartCommand(chatId: number, text: string, telegramUserId?: number) {
    this.logger.log(`handleStartCommand called - chatId: ${chatId}, text: "${text}", telegramUserId: ${telegramUserId}`);

    // Igor (04/07): branch pra BOT PROMOCIONAL. Detecta pelo bot atual
    // (via ALS/resolveCurrentBotId). Se for promo, comportamento é 100%
    // diferente do bot oficial — nada de menu de compra, catálogo etc.
    // Só CTA pro site OU consumo de purchase intent (Cenário 3).
    const currentBotId = await this.resolveCurrentBotId();
    const currentBot = currentBotId ? await this.getBotMeta(currentBotId) : null;

    if (currentBot?.is_promotional) {
      // Fire-and-forget: contador de /start + healthcheck (não bloqueia
      // o handler). PromiseLike do Supabase não tem .catch; usa 2 args do .then.
      const noop = () => {};
      const warn = (label: string) => (err: any) =>
        this.logger.warn(`[promo] ${label} failed: ${err?.message || err}`);
      this.supabase.rpc('increment_promotional_start_count', { bot_id: currentBotId })
        .then(noop, warn('increment_promotional_start_count'));
      this.supabase.from('telegram_bots')
        .update({ last_seen_ok_at: new Date().toISOString() })
        .eq('id', currentBotId!)
        .then(noop, warn('last_seen_ok_at'));
      // Igor (12/07): stampa user na tabela `users` pra broadcast enxergar.
      // Semântica "primeiro bot ganha" — não sobrescreve bot_username já
      // preenchido por bot oficial. Fire-and-forget.
      this.upsertPromoUser(telegramUserId || chatId, chatId, currentBot.username)
        .catch((err) => this.logger.warn(`[promo] upsertPromoUser fail: ${err?.message || err}`));
      // Igor (09/07): log de start pra analytics 24h/diário. Detecta se
      // é primeiro start desse user nesse bot (is_first_start=true) pra
      // contador de "novos usuários" separado.
      (async () => {
        try {
          const uid = telegramUserId || chatId;
          const { data: prev } = await this.supabase
            .from('promotional_bot_starts')
            .select('id')
            .eq('bot_id', currentBotId!)
            .eq('telegram_user_id', uid)
            .limit(1);
          await this.supabase.from('promotional_bot_starts').insert({
            bot_id: currentBotId,
            telegram_user_id: uid,
            telegram_chat_id: chatId,
            is_first_start: !prev?.length,
          });
        } catch (err: any) {
          this.logger.warn(`[promo] log start failed: ${err.message}`);
        }
      })();

      const parts = text.split(' ');
      // Cenário 3 — consumo de intent enviado por bot oficial.
      if (parts.length > 1 && parts[1].startsWith('pi_')) {
        const token = parts[1].slice(3);
        await this.handlePurchaseIntent(chatId, telegramUserId || chatId, token);
        return;
      }
      // /start puro ou com qualquer outro payload → mensagem CTA
      await this.handlePromoWelcome(chatId, currentBot);
      return;
    }

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
      // Order deep-link: /start order_<uuid>
      else if (param.startsWith('order_')) {
        const orderToken = param.replace('order_', '');
        this.logger.log(`🛒 Order deep link: ${orderToken}`);
        await this.handleOrderDeepLink(chatId, orderToken, user?.id);
        return;
      }
      // Igor (14/06 noite): watch deep-link rotativo. Cliente compra → bot
      // que recebeu o pagamento manda botão com URL `/r/watch?p=<purchaseId>`
      // → servidor sorteia bot ativo e redireciona pra `t.me/<bot>?start=watch_<id>`.
      // Aqui valida posse e gera o invite do grupo no bot ATUAL — cliente
      // entra no grupo do filme e fica conectada nesse bot adicional.
      else if (param.startsWith('watch_')) {
        const purchaseId = param.replace('watch_', '');
        this.logger.log(`🎬 Watch deep link: purchase=${purchaseId}`);
        await this.handleWatchDeepLink(chatId, purchaseId, user?.id, telegramUserId);
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
          const frontendUrl = this.getFrontendUrl();
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
    const frontendUrl = this.getFrontendUrl();
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

    // Buscar link da comunidade WhatsApp — prioridade em whatsapp_popup_link
    // (chave usada pelo painel admin N25), fallback em whatsapp_group_link (legado).
    const { data: wpSettings } = await this.supabase
      .from('admin_settings')
      .select('key, value')
      .in('key', ['whatsapp_popup_link', 'whatsapp_group_link']);
    const wpMap = Object.fromEntries((wpSettings || []).map((r: any) => [r.key, r.value]));
    const whatsappGroupLink: string | null =
      wpMap['whatsapp_popup_link'] || wpMap['whatsapp_group_link'] || null;

    const welcomeKeyboard: any[][] = [
      [{ text: '🌐 Ver Catálogo Completo', url: catalogUrl }],
      [{ text: '📱 Minhas Compras', callback_data: 'my_purchases' }],
      [{ text: '❓ Ajuda', callback_data: 'help' }],
    ];
    if (whatsappGroupLink) {
      welcomeKeyboard.splice(1, 0, [{ text: '💬 Comunidade WhatsApp', url: whatsappGroupLink }]);
    }

    await this.sendMessage(chatId, welcomeMessage, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: welcomeKeyboard },
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
      const frontendUrl = this.getFrontendUrl();
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
      const frontendUrl = this.getFrontendUrl();
      const dashboardUrl = `${frontendUrl}/auth/telegram-login?telegram_id=${telegramUserId}&redirect=/dashboard`;

      const message = `📱 *Minhas Compras*

🎬 Acesse sua dashboard para ver todos os filmes e séries que você comprou!

✨ *Recursos da Dashboard:*
• 📥 Baixar conteúdo
• 📊 Histórico de compras
• 🔐 Acesso automático sem senha

👇 Clique no botão abaixo para acessar:`;

      // Igor (15/05): removido o botão "Salvar meu WhatsApp" — a coleta
      // do número agora é feita pelo pop-up automático no dashboard
      // (WhatsAppNumberGate), não precisa de botão separado aqui.
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
      await this.sendMessage(chatId,
        `📝 *Solicitar Conteúdo*\n\nPara solicitar um filme ou série, entre em contato diretamente com nosso suporte:\n\n👇 Clique no botão abaixo:`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📩 Solicitar Conteúdo', url: 'https://telegram.me/m/YAU1-zMrZDcx' }],
              [{ text: '🔙 Voltar ao Menu', callback_data: 'start' }],
            ],
          },
        }
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
    const helpMessage = `🤖 *Comandos Disponíveis:*

/start - Iniciar o bot
/catalogo - Ver filmes disponíveis
/minhas\\_compras - Ver suas compras
/solicitar - Solicitar filme ou série
/meu\\_id - Ver seu ID do Telegram
/suporte - Falar com o suporte
/ajuda - Mostrar esta ajuda

💡 *Como funciona:*
1️⃣ Escolha um filme do catálogo
2️⃣ Sua conta é criada automaticamente
3️⃣ Escolha o método de pagamento (PIX ou Cartão)
4️⃣ Receba o filme aqui no chat e no dashboard!

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

  private async handleSupportCommand(chatId: number) {
    await this.sendMessage(chatId,
      `🛟 *Suporte CineVision*\n\nPrecisa de ajuda? Fale diretamente com nosso suporte:\n\n👇 Clique no botão abaixo:`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📩 Falar com Suporte', url: 'https://telegram.me/CineVisionOfc' }],
            [{ text: '🔙 Voltar ao Menu', callback_data: 'start' }],
          ],
        },
      }
    );
  }

  // ---------------------------------------------------------------------------
  // Bot-step message tracking (ephemeral cleanup between steps)
  // Saves message_id in bot_ephemeral_messages so previous step messages can
  // be deleted when the user advances. Best-effort — never throws.
  // ---------------------------------------------------------------------------
  async sendTrackedMessage(
    chatId: number,
    text: string,
    options: any,
    step: string,
  ): Promise<any> {
    const result = await this.sendMessage(chatId, text, options);
    const msgId = result?.result?.message_id;
    if (msgId) {
      await this.supabase
        .from('bot_ephemeral_messages')
        .insert({ chat_id: String(chatId), message_id: msgId, step })
        .then(() => undefined, () => undefined);
    }
    return result;
  }

  async cleanupTrackedMessages(chatId: number, exceptStep?: string): Promise<void> {
    try {
      let q = this.supabase
        .from('bot_ephemeral_messages')
        .select('id, message_id, step')
        .eq('chat_id', String(chatId));
      const { data: rows } = await q;
      if (!rows?.length) return;

      const toDelete = exceptStep ? rows.filter((r: any) => r.step !== exceptStep) : rows;

      const delApiUrl2 = await this.apiUrlForCurrent();
      for (const r of toDelete) {
        try {
          await axios.post(`${delApiUrl2}/deleteMessage`, {
            chat_id: chatId,
            message_id: r.message_id,
          });
        } catch {
          // Telegram may refuse if msg >48h or already deleted — ignore
        }
      }

      const ids = toDelete.map((r: any) => r.id);
      if (ids.length) {
        await this.supabase.from('bot_ephemeral_messages').delete().in('id', ids);
      }
    } catch (err: any) {
      this.logger.warn(`cleanupTrackedMessages failed: ${err.message}`);
    }
  }

  // Helper methods
  async sendMessage(chatId: number, text: string, options?: any) {
    try {
      // Igor (07/06): bot resolvido na ordem:
      //   1) options.bot_id explícito (caller passou)
      //   2) AsyncLocalStorage do webhook em andamento (cliente falou no bot 2 → responde do bot 2)
      //   3) default bot do env (this.botApiUrl)
      const explicitBotId: string | null = options?.bot_id || null;
      const ctxBotId = this.currentBotId();
      const resolvedBotId = explicitBotId || ctxBotId;
      const baseUrl = resolvedBotId ? await this.apiUrlForBot(resolvedBotId) : this.botApiUrl;
      const url = `${baseUrl}/sendMessage`;
      const payload: any = {
        chat_id: chatId,
        text,
        ...(options || {}),
      };
      // bot_id é só direcionador, não vai pro Telegram.
      if (payload.bot_id !== undefined) delete payload.bot_id;

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
      const ctxBotId = this.currentBotId();
      const baseUrl = ctxBotId ? await this.apiUrlForBot(ctxBotId) : this.botApiUrl;
      const url = `${baseUrl}/answerCallbackQuery`;
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

  // Auto-registra grupo em telegram_bot_groups quando bot recebe evento de um grupo.
  // Evita que Igor precise cadastrar 500+ Chat IDs manualmente.
  private async autoRegisterGroup(botId: string, chatId: string, title?: string) {
    try {
      await this.supabase
        .from('telegram_bot_groups')
        .upsert(
          { bot_id: botId, chat_id: chatId, title: title || '', is_active: true, updated_at: new Date().toISOString() },
          { onConflict: 'bot_id,chat_id', ignoreDuplicates: true },
        );
    } catch {
      // silencia — não quebrar o fluxo principal por causa do auto-registro
    }
  }

  // N31 (Igor 07/06): Métodos para broadcast de grupos — usam token explícito
  // em vez do bot do contexto atual, pois o caller controla qual bot enviar.
  async sendMessageToGroupWithBot(token: string, chatId: string, text: string) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await axios.post(url, { chat_id: chatId, text, parse_mode: 'Markdown' });
    return res.data?.result;
  }

  async sendPhotoToGroupWithBot(token: string, chatId: string, photoUrl: string, caption: string) {
    const url = `https://api.telegram.org/bot${token}/sendPhoto`;
    const res = await axios.post(url, { chat_id: chatId, photo: photoUrl, caption, parse_mode: 'Markdown' });
    return res.data?.result;
  }

  async deleteMessageFromGroupWithBot(token: string, chatId: string, messageId: string) {
    const url = `https://api.telegram.org/bot${token}/deleteMessage`;
    const res = await axios.post(url, { chat_id: chatId, message_id: parseInt(messageId, 10) });
    return res.data?.result;
  }

  async pinMessageInGroupWithBot(token: string, chatId: string, messageId: string) {
    const url = `https://api.telegram.org/bot${token}/pinChatMessage`;
    const res = await axios.post(url, {
      chat_id: chatId,
      message_id: parseInt(messageId, 10),
      disable_notification: true, // não notifica os membros do grupo ao fixar
    });
    return res.data?.result;
  }

  async setupWebhook(url: string, secretToken?: string) {
    try {
      const webhookUrl = `${this.botApiUrl}/setWebhook`;
      const payload: any = {
        url,
        allowed_updates: [
          'message',
          'callback_query',
          'business_connection',
          'business_message',
        ],
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
   * Igor (04/06): notifica o cliente que a pré-venda do conteúdo foi
   * liberada e entrega o link (invite single-use ou group_link). Chamado
   * pelo admin service quando ele clica "Liberar e notificar todos".
   * Idempotente: respeita presale_released_at marcado antes da chamada.
   */
  public async deliverPresaleRelease(purchase: any, content: any): Promise<void> {
    const chatId = purchase.provider_meta?.telegram_chat_id;
    if (!chatId) {
      this.logger.warn(
        `[presale-release] purchase ${purchase.id}: sem telegram_chat_id no provider_meta`,
      );
      return;
    }

    const title = content?.title || 'Conteúdo';
    try {
      // Tenta gerar invite single-use; se falhar, usa link de convite normal.
      const rawChatId: string | null = content?.telegram_chat_id?.trim() || null;
      const rawLink: string | null = content?.telegram_group_link?.trim() || null;
      let chatIdToTry = rawChatId;
      if (!chatIdToTry && rawLink && /^-?\d{6,}$/.test(rawLink)) {
        chatIdToTry = rawLink;
      }
      let buttonUrl: string | null = null;
      if (chatIdToTry) {
        try {
          // Igor (07/06): usa bot admin do grupo (content.delivery_bot_id).
          buttonUrl = await this.createInviteLinkForUser(
            chatIdToTry,
            purchase.id,
            content?.delivery_bot_id || null,
          );
        } catch (err: any) {
          this.logger.warn(
            `[presale-release] invite link failed for purchase ${purchase.id}: ${err.message}`,
          );
        }
      }
      if (!buttonUrl && rawLink && rawLink !== chatIdToTry) {
        buttonUrl = rawLink;
      }

      const header = `🎬 *${title} chegou!*\n\nComo prometido na sua pré-venda, aqui está seu acesso:`;
      await this.sendMessage(parseInt(chatId, 10), header, { parse_mode: 'Markdown' });

      if (buttonUrl) {
        await this.sendMessage(parseInt(chatId, 10), 'Toque pra entrar 👇', {
          reply_markup: { inline_keyboard: [[{ text: `🎬 ${title}`, url: buttonUrl }]] },
        });
      } else {
        await this.sendMessage(
          parseInt(chatId, 10),
          `⚠️ Link pendente. Entre em contato com o suporte que te enviamos na hora.`,
        );
      }
      // Marca delivery_sent=true pra evitar re-entregas se outro webhook
      // bater na purchase já liberada. Idempotência ponta-a-ponta.
      await this.supabase
        .from('purchases')
        .update({ delivery_sent: true })
        .eq('id', purchase.id);
    } catch (err: any) {
      this.logger.error(
        `[presale-release] failed to deliver purchase ${purchase.id}: ${err.message}`,
      );
      throw err;
    }
  }

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

      // Igor (04/06): blindagem contra entrega cruzada (Alexandre recebeu
      // filme da Elisabeth). Validações ANTES de marcar como entregue:
      //   1. user_id na purchase tem que existir (não confiamos só no
      //      provider_meta.telegram_chat_id, que pode ter sido setado
      //      em outro fluxo).
      //   2. O telegram_chat_id do user dono da purchase tem que BATER
      //      com o provider_meta.telegram_chat_id. Se divergir = sinal
      //      de que algo cruzou (purchase do user A com chatId do user B)
      //      e ABORTAMOS, deixando pra Igor entregar manual via painel.
      try {
        const { data: ownerUser } = await this.supabase
          .from('users')
          .select('id, telegram_chat_id, telegram_id, name')
          .eq('id', purchase.user_id)
          .maybeSingle();

        const metaChatId = String(chatId);
        const ownerChatId = ownerUser?.telegram_chat_id
          ? String(ownerUser.telegram_chat_id)
          : null;

        const mismatch = ownerChatId && ownerChatId !== metaChatId;
        if (mismatch) {
          this.logger.error(
            `[SECURITY] Cross-delivery blocked: purchase=${purchase.id} owner.user_id=${purchase.user_id} owner.chatId=${ownerChatId} provider_meta.chatId=${metaChatId} — NOT delivering. Igor pode entregar manual via painel.`,
          );
          await this.supabase.from('system_logs').insert({
            type: 'delivery_blocked',
            level: 'error',
            message: `Cross-delivery blocked for purchase ${purchase.id}`,
            meta: {
              purchase_id: purchase.id,
              order_id: purchase.order_id,
              user_id: purchase.user_id,
              owner_chat_id: ownerChatId,
              provider_meta_chat_id: metaChatId,
              owner_name: ownerUser?.name,
            },
          });
          return;
        }
      } catch (validationErr: any) {
        this.logger.warn(
          `Owner validation failed for purchase ${purchase.id}, proceeding anyway: ${validationErr.message}`,
        );
      }

      // Mark as delivered BEFORE sending to prevent race conditions
      await this.supabase.from('purchases').update({ delivery_sent: true }).eq('id', purchase.id);

      this.logger.log(`Delivering content to Telegram chat ${chatId} for purchase ${purchase.id} (user_id=${purchase.user_id}, order_id=${purchase.order_id})`);

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
            const frontendUrl = this.getFrontendUrl();
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
      const frontendUrl = this.getFrontendUrl();
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
            // Igor (07/06): usa bot admin do grupo (delivery_bot_id).
            this.logger.log(`Auto-add failed, creating invite link for purchase ${purchase.id}...`);
            telegramInviteLink = await this.createInviteLinkForUser(
              content.telegram_group_link,
              user.id,
              (content as any).delivery_bot_id || null,
            );

            if (telegramInviteLink) {
              this.logger.log(`Created invite link for purchase ${purchase.id}: ${telegramInviteLink}`);
            } else {
              // STRATEGY 3: Last resort - use original group link
              this.logger.warn(`Could not create custom invite link, using original: ${content.telegram_group_link}`);
              telegramInviteLink = content.telegram_group_link;
            }
          }

          // Igor (17/05): os links de acesso ao grupo (single-use 24h +
          // fixo) não são mais enviados no pós-pagamento. O auto-add
          // acima já coloca o cliente no grupo; se ele sair, recupera o
          // acesso clicando em "Assistir" no dashboard → endpoint
          // send-access (sendAccessToUser).
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
    const frontendUrl = this.getFrontendUrl();
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
      // Webhook mode — no 409 conflicts, no duplicate messages.
      //
      // Igor (17/05): blindagem do boot. ANTES, uma única falha transitória
      // do setWebhook (blip de rede no cold start do Render) derrubava o bot
      // inteiro: caía no fallback de polling e chamava deleteWebhook(),
      // APAGANDO o webhook de produção — e o bot parava de responder /start.
      //
      // AGORA: retry com backoff. Se TODAS as tentativas falharem, NÃO
      // apaga o webhook nem troca pra polling — um deploy anterior já
      // registrou a mesma URL, que continua válida. Polling só roda no dev
      // local (quando não há backendUrl).
      const webhookUrl = `${backendUrl}/api/v1/telegrams/webhook`;
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const url = `${this.botApiUrl}/setWebhook`;
          const response = await axios.post(url, {
            url: webhookUrl,
            allowed_updates: [
              'message',
              'callback_query',
              'business_connection',
              'business_message',
            ],
            drop_pending_updates: true,
          });
          if (response.data.ok) {
            this.logger.log(`✅ Webhook set: ${webhookUrl}`);
            return; // Don't start polling — webhook handles everything
          }
          this.logger.warn(
            `setWebhook attempt ${attempt}/${maxAttempts} rejected: ${JSON.stringify(response.data)}`,
          );
        } catch (error) {
          this.logger.warn(
            `setWebhook attempt ${attempt}/${maxAttempts} failed: ${error.message}`,
          );
        }
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 3000 * attempt));
        }
      }
      // Todas as tentativas falharam. NÃO apagar o webhook — mantém o que
      // já estava registrado (mesma URL de sempre). Loga pra investigação.
      this.logger.error(
        `⚠️ setWebhook falhou após ${maxAttempts} tentativas — mantendo o webhook existente intacto (produção NÃO cai pra polling).`,
      );
      return;
    }

    // Fallback: polling mode — APENAS dev local (sem backendUrl).
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
        allowed_updates: [
          'message',
          'callback_query',
          'business_connection',
          'business_message',
        ],
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
    // Igor (08/05): dedup em 2 niveis pra resistir a multiplas instances
    // do backend (Render rolling update pode manter container antigo vivo).
    //
    // 1) In-memory Set (rapido, mata duplicatas dentro da MESMA instance)
    // 2) DB unique insert (mata duplicatas ENTRE instances)
    //
    // Quando 2 containers processam mesmo update_id em race, o segundo
    // a chegar no DB pega ON CONFLICT/duplicate key e aborta.

    if (update.update_id && this.processedUpdates.has(update.update_id)) {
      this.logger.debug(`[dedup-mem] Skipping duplicate update ${update.update_id}`);
      return;
    }

    if (update.update_id) {
      // DB-level dedup: insert atomico. Se outra instance ja inseriu, falha
      // com unique violation e a gente pula. PRIMARY KEY garante atomicidade.
      try {
        const { error } = await this.supabase
          .from('processed_telegram_updates')
          .insert({ update_id: update.update_id });
        if (error) {
          // Codigo 23505 = unique_violation no PostgreSQL.
          if (error.code === '23505' || /duplicate|unique/i.test(error.message)) {
            this.logger.log(
              `[dedup-db] Skipping update ${update.update_id} — already processed by another instance`,
            );
            return;
          }
          // Outros erros: loga mas segue (melhor processar 2x do que perder).
          this.logger.warn(
            `[dedup-db] Insert failed for ${update.update_id}: ${error.message} — proceeding anyway`,
          );
        }
      } catch (err: any) {
        this.logger.warn(`[dedup-db] threw for ${update.update_id}: ${err.message}`);
      }

      this.processedUpdates.add(update.update_id);
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
      } else if (update.business_connection) {
        // Igor (08/05): bug critico — handleUpdate do polling so tratava
        // message + callback_query. Quando o backend caia em polling
        // (caso default em prod), business_connection e business_message
        // eram silenciosamente ignorados. Por isso a IA nao respondia
        // DM do Igor mesmo com Business configurado.
        this.logger.log('🤝 [polling] Processing business_connection update');
        await this.processBusinessConnection(update.business_connection);
      } else if (update.business_message) {
        this.logger.log('💬 [polling] Processing business_message update');
        await this.processBusinessMessage(update.business_message);
      } else if (update.edited_business_message) {
        // Edicao de business_message — trata como nova mensagem
        // (cliente corrigiu o que escreveu).
        this.logger.log('✏️ [polling] Processing edited_business_message update');
        await this.processBusinessMessage(update.edited_business_message);
      } else {
        this.logger.debug(
          `[polling] Unknown update type: ${Object.keys(update).filter((k) => k !== 'update_id').join(',')}`,
        );
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
