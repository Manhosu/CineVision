import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../config/supabase.service';
import { ClaudeProvider, AiMessage } from './providers/claude.provider';
import { CatalogContextService } from './services/catalog-context.service';
import { OrdersService } from '../orders/orders.service';
import { CartService } from '../cart/cart.service';
import { TelegramsEnhancedService } from '../telegrams/telegrams-enhanced.service';

export interface AiReply {
  text: string;
  paused?: boolean;
  suggestedContentIds?: string[];
  paymentLink?: string;
}

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly claude: ClaudeProvider,
    private readonly catalog: CatalogContextService,
    private readonly configService: ConfigService,
    private readonly ordersService: OrdersService,
    private readonly cartService: CartService,
    @Optional()
    @Inject(forwardRef(() => TelegramsEnhancedService))
    private readonly telegramsService?: TelegramsEnhancedService,
  ) {}

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------
  async isEnabled(platform: 'telegram' | 'whatsapp' | 'telegram_business'): Promise<boolean> {
    let key: string;
    if (platform === 'telegram') key = 'ai_chat_enabled_telegram';
    else if (platform === 'whatsapp') key = 'ai_chat_enabled_whatsapp';
    else key = 'ai_chat_enabled_telegram_business';
    const { data } = await this.supabase.client
      .from('admin_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    return (data?.value ?? 'false').toLowerCase() === 'true';
  }

  async getEnabledFlags() {
    const [tg, wa, tgb] = await Promise.all([
      this.supabase.client.from('admin_settings').select('value').eq('key', 'ai_chat_enabled_telegram').maybeSingle(),
      this.supabase.client.from('admin_settings').select('value').eq('key', 'ai_chat_enabled_whatsapp').maybeSingle(),
      this.supabase.client.from('admin_settings').select('value').eq('key', 'ai_chat_enabled_telegram_business').maybeSingle(),
    ]);
    return {
      telegram: (tg.data?.value ?? 'false').toLowerCase() === 'true',
      whatsapp: (wa.data?.value ?? 'false').toLowerCase() === 'true',
      telegram_business: (tgb.data?.value ?? 'false').toLowerCase() === 'true',
    };
  }

  async setEnabledFlags(input: { telegram?: boolean; whatsapp?: boolean; telegram_business?: boolean }) {
    const updates: Array<[string, string]> = [];
    if (input.telegram !== undefined) updates.push(['ai_chat_enabled_telegram', String(input.telegram)]);
    if (input.whatsapp !== undefined) updates.push(['ai_chat_enabled_whatsapp', String(input.whatsapp)]);
    if (input.telegram_business !== undefined) updates.push(['ai_chat_enabled_telegram_business', String(input.telegram_business)]);
    for (const [k, v] of updates) {
      await this.supabase.client.from('admin_settings').upsert(
        { key: k, value: v, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      );
    }
  }

  async getTraining() {
    const { data } = await this.supabase.client
      .from('ai_training_config')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (!data) {
      return {
        system_prompt: 'Você é o atendente do Cine Vision. Responda de forma humanizada.',
        faq_pairs: [],
      };
    }
    return data;
  }

  async updateTraining(systemPrompt: string, faqPairs: Array<{ question: string; answer: string }>) {
    const { data: existing } = await this.supabase.client
      .from('ai_training_config')
      .select('id')
      .limit(1)
      .maybeSingle();

    const payload = {
      system_prompt: systemPrompt,
      faq_pairs: faqPairs,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await this.supabase.client
        .from('ai_training_config')
        .update(payload)
        .eq('id', existing.id);
    } else {
      await this.supabase.client.from('ai_training_config').insert(payload);
    }
  }

  // ---------------------------------------------------------------------------
  // Conversation lifecycle
  // ---------------------------------------------------------------------------
  private async getOrCreateConversation(
    platform: 'telegram' | 'whatsapp' | 'telegram_business',
    externalChatId: string,
  ) {
    const { data: existing } = await this.supabase.client
      .from('ai_conversations')
      .select('*')
      .eq('platform', platform)
      .eq('external_chat_id', externalChatId)
      .maybeSingle();

    if (existing) return existing;

    const { data: created, error } = await this.supabase.client
      .from('ai_conversations')
      .insert({
        platform,
        external_chat_id: externalChatId,
        ai_enabled: true,
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to create conversation', error);
      throw error;
    }
    return created;
  }

  private async appendMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    tokens?: number,
  ) {
    await this.supabase.client.from('ai_messages').insert({
      conversation_id: conversationId,
      role,
      content,
      tokens_used: tokens,
    });

    await this.supabase.client
      .from('ai_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);
  }

  private async recentHistory(conversationId: string, limit = 12): Promise<AiMessage[]> {
    const { data } = await this.supabase.client
      .from('ai_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    const rows = (data || []).reverse();
    return rows
      .filter((r: any) => r.role === 'user' || r.role === 'assistant')
      .map((r: any) => ({ role: r.role as AiMessage['role'], content: r.content }));
  }

  // ---------------------------------------------------------------------------
  // Process incoming user message
  // ---------------------------------------------------------------------------
  async processIncomingMessage(params: {
    platform: 'telegram' | 'whatsapp' | 'telegram_business';
    externalChatId: string;
    messageText: string;
    userId?: string;
    businessConnectionId?: string;
  }): Promise<AiReply> {
    const { platform, externalChatId, messageText, userId, businessConnectionId } = params;

    if (!(await this.isEnabled(platform))) {
      return { text: '', paused: true };
    }

    const conversation = await this.getOrCreateConversation(platform, externalChatId);

    if (!conversation.ai_enabled) {
      // Admin assumed — bot should not auto-respond
      return { text: '', paused: true };
    }

    if (userId && !conversation.user_id) {
      await this.supabase.client
        .from('ai_conversations')
        .update({ user_id: userId })
        .eq('id', conversation.id);
    }

    await this.appendMessage(conversation.id, 'user', messageText);

    // Build context: training + catalog hits + history
    const training = await this.getTraining();
    const hits = await this.catalog.searchRelevant(messageText);
    const catalogBlock = this.catalog.formatHitsForPrompt(hits);

    const faqText = (training.faq_pairs || [])
      .map((f: any) => `P: ${f.question}\nR: ${f.answer}`)
      .join('\n\n');

    const systemPrompt = `${training.system_prompt}

${catalogBlock}

${faqText ? `FAQ DE SUPORTE:\n${faqText}` : ''}`;

    const history = await this.recentHistory(conversation.id);

    const completion = await this.claude.complete({
      system: systemPrompt,
      messages: history,
      maxTokens: 512,
    });

    const rawText = completion.text.trim();

    // Parse directives. Os markers são strippados da resposta final.
    let paused = false;
    let cleanText = rawText;
    let suggestedContentIds: string[] = [];
    let paymentLink: string | undefined;

    // PAUSE: IA não soube responder — encerra e chama Igor
    if (/<<PAUSE:[^>]+>>/i.test(rawText)) {
      paused = true;
      cleanText = cleanText.replace(/<<PAUSE:[^>]+>>/gi, '').trim();
      const reasonMatch = rawText.match(/<<PAUSE:([^>]+)>>/i);
      const reason = reasonMatch?.[1] ?? 'unknown';
      await this.pauseConversation(conversation.id, reason);
      await this.notifyAdminForTakeover(platform, externalChatId, messageText);
    }

    // LIST_REDIRECT: cliente pediu lista completa — manda link da home
    if (/<<LIST_REDIRECT>>/i.test(rawText)) {
      cleanText = cleanText.replace(/<<LIST_REDIRECT>>/gi, '').trim();
      // Se Claude já compôs texto, mantém; senão usa template padrão.
      if (!cleanText) {
        cleanText =
          'Nossa lista completa tá direto no aplicativo! 🎬 Dá uma olhada aqui:\n\n' +
          'https://cinevisionapp.com.br/\n\n' +
          'Qualquer filme que rolar interesse, é só me chamar 💕';
      } else if (!cleanText.includes('cinevisionapp.com.br')) {
        cleanText += '\n\nhttps://cinevisionapp.com.br/';
      }
    }

    // ASK_YEAR: só strip do marker — texto natural já tá no rawText
    if (/<<ASK_YEAR:[^>]+>>/i.test(rawText)) {
      cleanText = cleanText.replace(/<<ASK_YEAR:[^>]+>>/gi, '').trim();
    }

    // DETAIL: substitui o antigo BUY. NÃO gera order — apenas anexa
    // o link da página de detalhes do site no fim da resposta.
    const detailMatches = [...rawText.matchAll(/<<DETAIL:([0-9a-f-]{36})>>/gi)];
    cleanText = cleanText.replace(/<<DETAIL:[^>]+>>/gi, '').trim();
    if (detailMatches.length) {
      const ids = Array.from(new Set(detailMatches.map((m) => m[1])));
      const links = await this.buildDetailLinks(
        ids,
        businessConnectionId,
        platform === 'telegram_business' ? externalChatId : undefined,
      );
      suggestedContentIds = ids;
      if (links.length) {
        const linksBlock = links
          .map((l) => `🎬 *${l.title}${l.year ? ` (${l.year})` : ''}* — R$ ${this.formatBRL(l.priceCents)}\n👉 ${l.url}`)
          .join('\n\n');
        cleanText = (cleanText ? `${cleanText}\n\n` : '') + linksBlock;
        if (links.length > 1) {
          cleanText += '\n\nPra ganhar desconto progressivo, dá pra montar um pacote no carrinho do site 🎁';
        }
      }
    }

    // MANUAL_PIX: cliente pediu PIX manual depois do link de detalhes.
    // Backend monta resposta com chave + total e notifica Igor no bot.
    const manualPixMatch = rawText.match(/<<MANUAL_PIX:([0-9a-f,-]+)>>/i);
    if (manualPixMatch) {
      cleanText = cleanText.replace(/<<MANUAL_PIX:[^>]+>>/gi, '').trim();
      const ids = Array.from(
        new Set(
          manualPixMatch[1]
            .split(',')
            .map((s) => s.trim())
            .filter((s) => /^[0-9a-f-]{36}$/i.test(s)),
        ),
      );
      const summary = await this.buildManualPixSummary(ids);
      if (summary.items.length) {
        const itemsBlock = summary.items
          .map((it) => `🎬 *${it.title}${it.year ? ` (${it.year})` : ''}* — R$ ${this.formatBRL(it.priceCents)}`)
          .join('\n');
        cleanText =
          'Sem problema! 💕\n\n' +
          itemsBlock +
          `\n\n💰 *Total: R$ ${this.formatBRL(summary.totalCents)}*\n\n` +
          `PIX e-mail: ${summary.pixKey}\n\n` +
          'Assim que efetuar, só me enviar o comprovante por aqui que verifico e libero seus filmes 💕';

        // Notifica Igor pra validar comprovante manual.
        await this.notifyAdminManualPix(summary, externalChatId, businessConnectionId);
      }
    }

    // BUY: legacy do bot direto — mantém comportamento antigo (gera link
    // de pagamento agregado). Não usado no fluxo Business novo.
    if (platform !== 'telegram_business') {
      const buyMatches = [...rawText.matchAll(/<<BUY:([0-9a-f-]{36})>>/gi)];
      const buyIds = buyMatches.map((m) => m[1]);
      cleanText = cleanText.replace(/<<BUY:[^>]+>>/gi, '').trim();
      if (buyIds.length) {
        suggestedContentIds = buyIds;
        paymentLink = await this.createQuickBuyLink(buyIds, externalChatId, userId);
      }
    } else {
      // Strip qualquer <<BUY>> que escapou no platform Business.
      cleanText = cleanText.replace(/<<BUY:[^>]+>>/gi, '').trim();
    }

    await this.appendMessage(
      conversation.id,
      'assistant',
      cleanText || rawText,
      completion.outputTokens,
    );

    return {
      text: cleanText || rawText,
      paused,
      suggestedContentIds,
      paymentLink,
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers usados pelos novos markers
  // ---------------------------------------------------------------------------

  private formatBRL(cents: number): string {
    return (cents / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  /**
   * Monta os links da página de detalhes do site pra cada UUID. Se
   * businessConnectionId + customerChatId presentes, anexa
   * ?via=business&bid=BCID&chat=CHATID pra que ao adicionar ao
   * carrinho o backend marque a order como vinda do canal Business
   * (entrega via Igor depois) E saiba qual é o chat_id pra entregar.
   */
  private async buildDetailLinks(
    contentIds: string[],
    businessConnectionId?: string,
    customerChatId?: string,
  ): Promise<Array<{ id: string; title: string; year?: number; priceCents: number; url: string }>> {
    if (!contentIds.length) return [];
    const { data } = await this.supabase.client
      .from('content')
      .select('id, title, release_year, price_cents, content_type')
      .in('id', contentIds);
    const baseUrl =
      this.configService.get('PUBLIC_FRONTEND_URL') ||
      'https://cinevisionapp.com.br';
    const params: string[] = [];
    if (businessConnectionId) {
      params.push(`via=business`);
      params.push(`bid=${encodeURIComponent(businessConnectionId)}`);
    }
    if (customerChatId) {
      params.push(`chat=${encodeURIComponent(customerChatId)}`);
    }
    const suffix = params.length ? `?${params.join('&')}` : '';
    return (data || []).map((c: any) => {
      const path = c.content_type === 'series' ? 'series' : 'movies';
      return {
        id: c.id,
        title: c.title,
        year: c.release_year ?? undefined,
        priceCents: c.price_cents,
        url: `${baseUrl}/${path}/${c.id}${suffix}`,
      };
    });
  }

  private async buildManualPixSummary(
    contentIds: string[],
  ): Promise<{
    items: Array<{ id: string; title: string; year?: number; priceCents: number }>;
    totalCents: number;
    pixKey: string;
  }> {
    const items: Array<{ id: string; title: string; year?: number; priceCents: number }> = [];
    if (contentIds.length) {
      const { data } = await this.supabase.client
        .from('content')
        .select('id, title, release_year, price_cents')
        .in('id', contentIds);
      for (const c of data || []) {
        items.push({
          id: c.id,
          title: c.title,
          year: c.release_year ?? undefined,
          priceCents: c.price_cents,
        });
      }
    }
    const totalCents = items.reduce((acc, it) => acc + it.priceCents, 0);
    return {
      items,
      totalCents,
      pixKey: this.configService.get('MANUAL_PIX_KEY') || 'cinevision.app@hotmail.com',
    };
  }

  /**
   * Avisa Igor no DM dele com o bot quando cliente pediu PIX manual.
   * Inclui resumo dos filmes + total + chat_id do cliente pra ele
   * encontrar a conversa e validar o comprovante.
   */
  private async notifyAdminManualPix(
    summary: { items: Array<{ title: string; year?: number; priceCents: number }>; totalCents: number },
    clientExternalChatId: string,
    businessConnectionId?: string,
  ) {
    const adminChatId = this.configService.get<string>('TELEGRAM_ADMIN_CHAT_ID');
    if (!adminChatId || !this.telegramsService) return;

    const itemsBlock = summary.items
      .map((it) => `• ${it.title}${it.year ? ` (${it.year})` : ''} — R$ ${this.formatBRL(it.priceCents)}`)
      .join('\n');
    const text =
      `🔔 *PIX manual solicitado*\n\n` +
      `Cliente (chat \`${clientExternalChatId}\`) pediu pra pagar via PIX manual:\n\n` +
      itemsBlock +
      `\n\n💰 *Total: R$ ${this.formatBRL(summary.totalCents)}*\n\n` +
      (businessConnectionId
        ? '_Conversa via Business DM_\n\n'
        : '') +
      `Quando o comprovante chegar, valida no banco e libera o conteúdo via /admin/grant-access.`;

    try {
      await this.telegramsService.sendMessage(parseInt(adminChatId, 10), text, {
        parse_mode: 'Markdown',
      });
    } catch (err: any) {
      this.logger.warn(`notifyAdminManualPix failed: ${err.message}`);
    }
  }

  private async createQuickBuyLink(
    contentIds: string[],
    telegramChatId: string,
    userId?: string,
  ): Promise<string | undefined> {
    if (!contentIds.length) return undefined;
    try {
      // Reset do carrinho e re-add de todos os itens. Dedup defensivo
      // pra não bater em duplicate-key se o modelo emitir <<BUY>> duas
      // vezes pro mesmo content_id.
      const uniqueIds = Array.from(new Set(contentIds));
      await this.cartService.clearCart(userId, telegramChatId).catch(() => undefined);
      for (const id of uniqueIds) {
        try {
          await this.cartService.addItem(id, userId, telegramChatId);
        } catch (err: any) {
          this.logger.warn(`Failed to add ${id} to quick-buy cart: ${err.message}`);
        }
      }
      const result = await this.ordersService.createOrderFromCart({
        userId,
        sessionId: telegramChatId,
        telegramChatId,
      });
      const botUsername = this.configService.get<string>('TELEGRAM_BOT_USERNAME') || 'cinevisionv2bot';
      return `https://t.me/${botUsername}?start=order_${result.order.order_token}`;
    } catch (err: any) {
      this.logger.warn(`Failed to create quick-buy link: ${err.message}`);
      return undefined;
    }
  }

  // ---------------------------------------------------------------------------
  // Business connection status (lista conexões ativas pra mostrar no painel)
  // ---------------------------------------------------------------------------
  async getBusinessConnections() {
    const { data } = await this.supabase.client
      .from('telegram_business_connections')
      .select('*')
      .order('updated_at', { ascending: false });
    return data || [];
  }

  // ---------------------------------------------------------------------------
  // Admin controls
  // ---------------------------------------------------------------------------
  async listConversations(filter?: {
    platform?: string;
    paused?: boolean;
    limit?: number;
  }) {
    let q = this.supabase.client
      .from('ai_conversations')
      .select('*')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(filter?.limit || 100);

    if (filter?.platform) q = q.eq('platform', filter.platform);
    if (filter?.paused === true) q = q.eq('ai_enabled', false);
    if (filter?.paused === false) q = q.eq('ai_enabled', true);

    const { data } = await q;
    return data || [];
  }

  async getConversationMessages(conversationId: string, limit = 100) {
    const { data } = await this.supabase.client
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);
    return data || [];
  }

  async pauseConversation(conversationId: string, reason: string) {
    await this.supabase.client
      .from('ai_conversations')
      .update({
        ai_enabled: false,
        paused_reason: reason,
        paused_at: new Date().toISOString(),
      })
      .eq('id', conversationId);
  }

  /**
   * Admin envia uma mensagem direto pelo painel — a conversa fica em
   * modo takeover (ai_enabled=false) automaticamente, a mensagem é
   * salva como role=admin no histórico e enviada via Telegram pro
   * usuário. Ler o histórico depois mostra a mensagem na timeline.
   */
  async sendAdminMessage(conversationId: string, text: string): Promise<void> {
    const trimmed = (text || '').trim();
    if (!trimmed) return;

    const { data: conversation } = await this.supabase.client
      .from('ai_conversations')
      .select('*')
      .eq('id', conversationId)
      .maybeSingle();

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Pausa a IA automaticamente — admin assumiu.
    if (conversation.ai_enabled) {
      await this.pauseConversation(conversationId, 'admin_takeover');
    }

    // Persiste no histórico como role=admin (separável de assistant
    // que é a IA). Front pode renderizar com cor/ícone diferente.
    await this.supabase.client.from('ai_messages').insert({
      conversation_id: conversationId,
      role: 'admin',
      content: trimmed,
    });

    await this.supabase.client
      .from('ai_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    // Despacha para o Telegram (única plataforma com sendMessage hoje)
    if (conversation.platform === 'telegram' && this.telegramsService) {
      const chatId = parseInt(conversation.external_chat_id, 10);
      if (!Number.isNaN(chatId)) {
        try {
          await this.telegramsService.sendMessage(chatId, trimmed);
        } catch (err: any) {
          this.logger.warn(`sendAdminMessage failed for ${chatId}: ${err.message}`);
        }
      }
    }
  }

  async resumeConversation(conversationId: string) {
    await this.supabase.client
      .from('ai_conversations')
      .update({
        ai_enabled: true,
        paused_reason: null,
        paused_at: null,
      })
      .eq('id', conversationId);
  }

  private async notifyAdminForTakeover(
    platform: string,
    externalChatId: string,
    originalMessage: string,
  ) {
    const adminChatId = this.configService.get<string>('TELEGRAM_ADMIN_CHAT_ID');
    if (!adminChatId || !this.telegramsService) {
      this.logger.warn('TELEGRAM_ADMIN_CHAT_ID not configured or telegramsService unavailable');
      return;
    }

    const text =
      `🤖 *IA pausada — atenção necessária*\n\n` +
      `Cliente pediu um conteúdo que não está no catálogo.\n\n` +
      `*Plataforma:* ${platform}\n` +
      `*Chat ID:* \`${externalChatId}\`\n\n` +
      `*Mensagem do cliente:*\n_${originalMessage}_\n\n` +
      `Acesse o painel de IA para assumir esta conversa.`;

    try {
      await this.telegramsService.sendMessage(parseInt(adminChatId, 10), text, {
        parse_mode: 'Markdown',
      });
    } catch (err: any) {
      this.logger.warn(`Admin takeover notification failed: ${err.message}`);
    }
  }
}
