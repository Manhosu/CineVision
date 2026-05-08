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
      // N19 (Igor 07/05 noite): default com escopo restrito a
      // filmes/series. Caso a row real do ai_training_config seja
      // deletada, esse default cobre — IA nunca cai em conversa
      // pessoal mesmo sem prompt customizado.
      return {
        system_prompt:
          'Você é a Yanna, atendente do Cine Vision. Você atende SOMENTE sobre o catálogo de filmes e séries do Cine Vision. Se o cliente mandar qualquer mensagem que não seja saudação pura, assuma que é título de filme/série e busque no catálogo. NÃO converse sobre vida pessoal, sentimento, conselho, política, religião — traga sempre de volta pra filmes/séries ("aqui eu cuido só do catálogo 🎬"). NUNCA pergunte se o cliente está falando da própria vida quando mencionar uma frase curta — assuma direto que é título.',
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
    timing?: { receivedAt?: Date; respondedAt?: Date; latencyMs?: number },
  ) {
    const payload: Record<string, any> = {
      conversation_id: conversationId,
      role,
      content,
      tokens_used: tokens,
    };
    if (timing?.receivedAt) payload.received_at = timing.receivedAt.toISOString();
    if (timing?.respondedAt) payload.responded_at = timing.respondedAt.toISOString();
    if (timing?.latencyMs !== undefined) payload.latency_ms = timing.latencyMs;

    await this.supabase.client.from('ai_messages').insert(payload);

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

    // A2 — Igor reportou que IA demora 3 mensagens pra responder.
    // Instrumentamos latência ponta-a-ponta (received → responded)
    // pra ter SQL agregada e identificar onde está o gargalo.
    const receivedAt = new Date();

    if (!(await this.isEnabled(platform))) {
      return { text: '', paused: true };
    }

    const conversation = await this.getOrCreateConversation(platform, externalChatId);

    if (userId && !conversation.user_id) {
      await this.supabase.client
        .from('ai_conversations')
        .update({ user_id: userId })
        .eq('id', conversation.id);
    }

    // SEMPRE persiste a mensagem do cliente — mesmo quando IA está
    // pausada (admin assumiu). Antes desse fix, a mensagem era
    // descartada no early return abaixo, então Igor olhava o painel
    // e não via o que o cliente continuou dizendo durante a conversa
    // sob controle manual. Bug reportado no vídeo (6) — IA "não
    // respondia" alguns clientes mas a verdade é que a conversa
    // estava em takeover e Igor não enxergava as novas mensagens.
    await this.appendMessage(conversation.id, 'user', messageText);

    // Igor (08/05): cliente mandando gratidao apos compra ("obrigado",
    // "valeu", "amei") nao deve cair em content_not_found. Pre-check
    // antes de carregar contexto + chamar Claude. Texto fixo do Igor.
    const gratitudePattern =
      /\b(obrigad[oa]|valeu|brigad[oa]|gratid[ãa]o|grato|grata|parab[ée]ns|amei|adorei|melhores|sucesso|maravilhos[ao]|excelente)\b/i;
    if (gratitudePattern.test(messageText) && conversation.ai_enabled) {
      const reply = 'Qualquer coisa só me chamar, ficamos à sua disposição ❤️🍿';
      await this.appendMessage(conversation.id, 'assistant', reply);
      this.logger.log(
        `Gratitude detected in conv ${conversation.id} — replied with fixed text, skipped Claude`,
      );
      return { text: reply, paused: false, suggestedContentIds: [] };
    }

    if (!conversation.ai_enabled) {
      // Admin assumed — bot should not auto-respond, mas a mensagem
      // do cliente já foi salva acima e vai aparecer no painel.
      this.logger.log(
        `Conversation ${conversation.id} paused (reason: ${conversation.paused_reason || 'unknown'}) — message persisted but no AI reply.`,
      );
      return { text: '', paused: true };
    }

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

    // Timing pra debug F1.4 (Igor reportou que IA demora 3 mensagens
    // pra responder). Logamos latência total e do Claude isolado.
    const t0 = Date.now();
    let completion: Awaited<ReturnType<typeof this.claude.complete>>;
    try {
      // N3 — Igor reportou IA não respondendo recorrentemente
      // (claude_failure se repetindo). Maioria das falhas Anthropic é
      // transitória (timeout, 529 overload, rate limit momentâneo).
      // Tenta até 3x com backoff curto antes de cair no fallback.
      let attempt = 0;
      let lastErr: any;
      while (attempt < 3) {
        try {
          completion = await this.claude.complete({
            system: systemPrompt,
            messages: history,
            maxTokens: 512,
          });
          if (attempt > 0) {
            this.logger.log(
              `Claude succeeded on attempt ${attempt + 1} for conversation ${conversation.id}`,
            );
          }
          break;
        } catch (err: any) {
          lastErr = err;
          attempt++;
          if (attempt < 3) {
            const backoffMs = 500 * attempt; // 500ms, 1000ms
            this.logger.warn(
              `Claude attempt ${attempt} failed (${err?.response?.status || err.message}), retrying in ${backoffMs}ms…`,
            );
            await new Promise((r) => setTimeout(r, backoffMs));
          }
        }
      }
      if (!completion!) throw lastErr;
    } catch (err: any) {
      const t1 = Date.now();
      // N9 — agora classificamos o erro Claude (auth/rate_limit/
      // overloaded/low_balance/model_unavailable/timeout/network).
      // Persiste o `kind` no paused_reason pra Igor ver no painel
      // exatamente que tipo de falha está acontecendo.
      const kind = err?.kind ?? 'claude_failure';
      const status = err?.statusCode ?? null;
      this.logger.error(
        `Claude failure after ${t1 - t0}ms (3 attempts) for conv ${conversation.id}: kind=${kind} status=${status} msg="${err?.message || 'unknown'}"`,
      );
      // Fallback gracioso: pausa a conversa e chama Igor em vez de
      // deixar o cliente sem resposta. A mensagem do cliente já foi
      // salva no append acima.
      const pauseReason =
        kind === 'auth' ? 'claude_auth' :
        kind === 'rate_limit' ? 'claude_rate_limit' :
        kind === 'low_balance' ? 'claude_low_balance' :
        kind === 'overloaded' ? 'claude_overloaded' :
        kind === 'model_unavailable' ? 'claude_model_unavailable' :
        kind === 'timeout' ? 'claude_timeout' :
        kind === 'network' ? 'claude_network' :
        kind === 'config_missing' ? 'claude_config_missing' :
        'claude_failure';
      await this.pauseConversation(conversation.id, pauseReason);
      // N3 — throttle: só notifica Igor 1x por conversa em janela de
      // 30 min, pra não spammar quando Anthropic está fora do ar e
      // 50 clientes mandam msg em sequência.
      if (await this.shouldNotifyClaudeFailure(conversation.id)) {
        await this.notifyAdminForTakeover(platform, externalChatId, messageText);
      }
      return {
        text: '',
        paused: true,
        suggestedContentIds: [],
      };
    }
    const claudeMs = Date.now() - t0;
    this.logger.log(
      `Claude completion ok in ${claudeMs}ms (in=${completion.inputTokens}, out=${completion.outputTokens}) conv=${conversation.id}`,
    );

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
      const { links, missingIds } = await this.buildDetailLinks(
        ids,
        businessConnectionId,
        platform === 'telegram_business' ? externalChatId : undefined,
      );
      suggestedContentIds = links.map((l) => l.id);
      if (links.length) {
        const linksBlock = links
          .map((l) => `🎬 *${l.title}${l.year ? ` (${l.year})` : ''}* — R$ ${this.formatBRL(l.priceCents)}\n👉 ${l.url}`)
          .join('\n\n');
        cleanText = (cleanText ? `${cleanText}\n\n` : '') + linksBlock;
        if (links.length > 1) {
          cleanText += '\n\nPra ganhar desconto progressivo, dá pra montar um pacote no carrinho do site 🎁';
        }
      }
      // Se TODOS os IDs vieram inválidos (cliente recebeu "tenho aqui
      // pra você:" mas IA inventou UUIDs), avisa ao cliente em vez de
      // entregar texto truncado. Igor reportou esse bug — IA respondia
      // valor mas não mandava link, ou link 404.
      if (missingIds.length && !links.length) {
        cleanText =
          (cleanText ? `${cleanText}\n\n` : '') +
          'Hmm, deixa eu confirmar essa busca aqui pra você 🎬 me dá um instante que vou verificar se temos esse título exato no catálogo.';
        // Pausa pra Igor assumir — alta probabilidade de alucinação ou
        // título saiu do catálogo
        await this.pauseConversation(conversation.id, 'detail_ids_invalid');
        await this.notifyAdminForTakeover(platform, externalChatId, messageText);
        paused = true;
      } else if (missingIds.length && links.length < ids.length) {
        // Parcial — alguns links válidos, outros faltam. Reconhece sem
        // assustar o cliente.
        cleanText +=
          '\n\n_(Tem 1 ou 2 títulos da sua busca que ainda estou conferindo aqui — qualquer dúvida me chama)_';
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

    // SAFETY NET: remove qualquer marker `<<...>>` que tenha escapado
    // do processing acima — IA inventando markers novos, regex falha,
    // etc. Igor reportou (vídeo IMG_8771) que cliente recebia "código
    // interno" no chat tipo `<<DETAIL:abc>>` quando algo dava errado.
    // Aqui garantimos que, mesmo que algo escape, o cliente nunca vê
    // marker.
    cleanText = cleanText.replace(/<<[A-Z_]+(?::[^>]*)?>>/g, '').trim();

    // A2 — registra latência total (recebimento → assistant pronto pra
    // enviar). Não inclui o delay humanizado de 5-8s aplicado no
    // dispatchAiChat — esse é UX intencional, não latência da IA.
    const respondedAt = new Date();
    const latencyMs = respondedAt.getTime() - receivedAt.getTime();

    await this.appendMessage(
      conversation.id,
      'assistant',
      cleanText || rawText,
      completion.outputTokens,
      { receivedAt, respondedAt, latencyMs },
    );

    if (latencyMs > 8000) {
      this.logger.warn(
        `Slow AI response: ${latencyMs}ms (claude=${claudeMs}ms) conv=${conversation.id}`,
      );
    }

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
  ): Promise<{
    links: Array<{ id: string; title: string; year?: number; priceCents: number; url: string }>;
    missingIds: string[];
  }> {
    if (!contentIds.length) return { links: [], missingIds: [] };
    const { data } = await this.supabase.client
      .from('content')
      .select('id, title, release_year, price_cents, content_type, status')
      .in('id', contentIds);

    // Filtra só conteúdo PUBLICADO — se a IA "alucinou" um UUID que
    // não existe ou referenciou rascunho/excluído, NÃO geramos link 404.
    // Ids faltantes são reportados separadamente pra que o caller possa
    // avisar o cliente em vez de silenciar (que era o bug do feedback do
    // Igor — IA dizia "tenho aqui pra você:" e não vinha link nenhum).
    const found = (data || []).filter(
      (c: any) => c.status === 'PUBLISHED' || c.status === 'published',
    );
    const foundIds = new Set(found.map((c: any) => c.id));
    const missingIds = contentIds.filter((id) => !foundIds.has(id));

    if (missingIds.length) {
      this.logger.warn(
        `buildDetailLinks: ${missingIds.length} ID(s) não encontrado(s) no catálogo: ${missingIds.join(', ')}`,
      );
    }

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
    const links = found.map((c: any) => {
      const path = c.content_type === 'series' ? 'series' : 'movies';
      return {
        id: c.id,
        title: c.title,
        year: c.release_year ?? undefined,
        priceCents: c.price_cents,
        url: `${baseUrl}/${path}/${c.id}${suffix}`,
      };
    });
    return { links, missingIds };
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
    const adminChatId = await this.resolveAdminChatId();
    if (!adminChatId || !this.telegramsService) {
      this.logger.warn(
        `notifyAdminManualPix DROPPED: client=${clientExternalChatId} adminChatId=${adminChatId}`,
      );
      return;
    }

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
      this.logger.log(
        `notifyAdminManualPix OK: client=${clientExternalChatId} → admin=${adminChatId}`,
      );
    } catch (err: any) {
      this.logger.error(`notifyAdminManualPix SEND FAILED: ${err.message}`);
    }
  }

  private async createQuickBuyLink(
    contentIds: string[],
    telegramChatId: string,
    userId?: string,
  ): Promise<string | undefined> {
    if (!contentIds.length) return undefined;
    try {
      const uniqueIds = Array.from(new Set(contentIds));

      // VALIDAÇÃO PRÉ-CART: confirma que TODOS os IDs existem como
      // conteúdo PUBLISHED antes de mexer no carrinho. Se IA inventou
      // UUID, abortamos antes de criar order vazia → cliente não vai
      // ganhar link de pagamento que abriria carrinho zerado.
      const { data: existing } = await this.supabase.client
        .from('content')
        .select('id, status')
        .in('id', uniqueIds);
      const validIds = (existing || [])
        .filter((c: any) => c.status === 'PUBLISHED' || c.status === 'published')
        .map((c: any) => c.id);

      if (!validIds.length) {
        this.logger.warn(
          `createQuickBuyLink: nenhum ID válido em [${uniqueIds.join(', ')}] — abortando.`,
        );
        return undefined;
      }
      if (validIds.length < uniqueIds.length) {
        const missing = uniqueIds.filter((id) => !validIds.includes(id));
        this.logger.warn(
          `createQuickBuyLink: ignorando ${missing.length} ID(s) inválido(s): ${missing.join(', ')}`,
        );
      }

      // Reset do carrinho e re-add só dos IDs válidos.
      await this.cartService.clearCart(userId, telegramChatId).catch(() => undefined);
      for (const id of validIds) {
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

  /**
   * N17 (Igor 04/05): toggle manual do is_enabled de uma business
   * connection. Usado quando o Telegram não propaga o estado (Igor
   * desativa/reativa via settings mas o webhook não chega) ou pra
   * pausar IA temporariamente sem precisar mexer no Telegram.
   */
  async setBusinessConnectionEnabled(id: string, enabled: boolean) {
    const { data, error } = await this.supabase.client
      .from('telegram_business_connections')
      .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update business connection ${id}: ${error.message}`);
    }
    return data;
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
    // DEBUG (Igor 08/05): rastreio de TODA pausa pra entender de onde
    // vem claude_config_missing quando logs anteriores nao mostram.
    const stack = new Error().stack?.split('\n').slice(2, 5).join(' | ').replace(/\s+/g, ' ');
    this.logger.warn(
      `[PAUSE_TRACE] conv=${conversationId} reason=${reason} caller=${stack}`,
    );
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

  /**
   * Igor (06/05): IA continua falhando mesmo após recarga + reativar.
   * Bate na Claude API com um prompt mínimo e devolve o erro bruto
   * (status, kind classificado, mensagem da Anthropic, body inteiro
   * truncado). Permite diagnóstico sem precisar acessar Render logs.
   */
  async testClaudeRaw() {
    const t0 = Date.now();
    try {
      const result = await this.claude.complete({
        system: 'Diga apenas "ok".',
        messages: [{ role: 'user', content: 'Teste' }],
        maxTokens: 16,
      });
      return {
        ok: true,
        latency_ms: Date.now() - t0,
        text: result.text,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
      };
    } catch (err: any) {
      return {
        ok: false,
        latency_ms: Date.now() - t0,
        kind: err?.kind ?? null,
        statusCode: err?.statusCode ?? null,
        model: err?.model ?? null,
        message: err?.message ?? String(err),
        anthropic_error: err?.anthropicError ?? null,
        is_classified: err?.constructor?.name === 'ClaudeApiError',
        error_class: err?.constructor?.name ?? typeof err,
      };
    }
  }

  /**
   * Igor (06/05): após recarregar saldo Anthropic, o banner continua
   * mostrando porque as conversas pausadas com paused_reason LIKE
   * 'claude_%' nas últimas 24h ainda contam — incluindo as que pausaram
   * antes da recarga. Esse método reativa todas elas em batch e devolve
   * a contagem do que foi limpo. Como bonus, limpa o `paused_reason` e
   * `paused_at` pra não confundir auditoria futura.
   */
  async reactivatePausedClaudeConversations() {
    const { data, error } = await this.supabase.client
      .from('ai_conversations')
      .update({
        ai_enabled: true,
        paused_reason: null,
        paused_at: null,
      })
      .like('paused_reason', 'claude_%')
      .select('id');

    if (error) {
      throw new Error(`Failed to reactivate paused conversations: ${error.message}`);
    }
    return { reactivated: (data || []).length };
  }

  // N3 + N9 — health check da IA pra badge global no painel.
  // Agora também desagrega por tipo de falha (auth/rate_limit/
  // low_balance/overloaded/timeout/etc). Igor vê no banner não só
  // "X conversas pausadas" mas QUE TIPO de falha está acontecendo.
  async getClaudeHealth() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Lista todas as conversas pausadas com motivos claude_*.
    const [{ data: pausedRows }, { count: totalActive }] = await Promise.all([
      this.supabase.client
        .from('ai_conversations')
        .select('paused_reason')
        .like('paused_reason', 'claude_%')
        .gte('paused_at', since),
      this.supabase.client
        .from('ai_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('ai_enabled', true)
        .gte('last_message_at', since),
    ]);

    const failed = pausedRows?.length || 0;
    const active = totalActive || 0;
    const total = failed + active;
    const failRate = total > 0 ? failed / total : 0;

    // Conta por kind. Mapeamento de paused_reason → kind humano.
    const byKind: Record<string, number> = {};
    for (const row of pausedRows || []) {
      const reason = row.paused_reason as string;
      const kind =
        reason === 'claude_auth' ? 'auth' :
        reason === 'claude_rate_limit' ? 'rate_limit' :
        reason === 'claude_low_balance' ? 'low_balance' :
        reason === 'claude_overloaded' ? 'overloaded' :
        reason === 'claude_model_unavailable' ? 'model_unavailable' :
        reason === 'claude_timeout' ? 'timeout' :
        reason === 'claude_network' ? 'network' :
        reason === 'claude_config_missing' ? 'config_missing' :
        'unknown';
      byKind[kind] = (byKind[kind] || 0) + 1;
    }

    // Causa dominante (pra mostrar no banner com hint específico).
    const dominantKind = Object.entries(byKind).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    return {
      failed_24h: failed,
      active_24h: active,
      fail_rate: Number(failRate.toFixed(3)),
      by_kind: byKind,
      dominant_kind: dominantKind,
      // Badge é "warning" se >5 falhas em 24h ou taxa >20%, "critical"
      // se >20 ou taxa >50%. Igor consegue dimensionar o problema.
      status:
        failed > 20 || failRate > 0.5
          ? 'critical'
          : failed > 5 || failRate > 0.2
          ? 'warning'
          : 'healthy',
    };
  }

  // N3 — Em memória: última vez que notificamos claude_failure por
  // conversation. Throttle de 30min impede spam quando Anthropic
  // está fora do ar e clientes em rajada disparam dezenas de falhas.
  private claudeFailureNotifiedAt = new Map<string, number>();

  private async shouldNotifyClaudeFailure(conversationId: string): Promise<boolean> {
    const now = Date.now();
    const last = this.claudeFailureNotifiedAt.get(conversationId);
    const THIRTY_MIN = 30 * 60 * 1000;
    if (last && now - last < THIRTY_MIN) return false;
    this.claudeFailureNotifiedAt.set(conversationId, now);
    // GC: remove entradas antigas (>2h) pra evitar leak
    if (this.claudeFailureNotifiedAt.size > 200) {
      const cutoff = now - 2 * 60 * 60 * 1000;
      for (const [k, v] of this.claudeFailureNotifiedAt.entries()) {
        if (v < cutoff) this.claudeFailureNotifiedAt.delete(k);
      }
    }
    return true;
  }

  /**
   * Igor (07/05): "IA não está me chamando no privado quando uma conversa
   * precisa de atendimento humano". Causa: TELEGRAM_ADMIN_CHAT_ID estava
   * faltando no Render env. Fallback: busca admin no banco por role.
   * Cacheia em memória pra não bater no DB toda mensagem.
   */
  private adminChatIdCache: { value: string | null; fetchedAt: number } | null = null;

  private async resolveAdminChatId(): Promise<string | null> {
    // 1. Env var explícita tem prioridade.
    const envChatId = this.configService.get<string>('TELEGRAM_ADMIN_CHAT_ID');
    if (envChatId) return envChatId;

    // 2. Fallback DB: cacheia 5min.
    const now = Date.now();
    if (this.adminChatIdCache && now - this.adminChatIdCache.fetchedAt < 5 * 60 * 1000) {
      return this.adminChatIdCache.value;
    }

    try {
      const { data: admins } = await this.supabase.client
        .from('users')
        .select('id, telegram_id, telegram_chat_id, role')
        .eq('role', 'admin')
        .not('telegram_id', 'is', null)
        .limit(5);

      const chosen = (admins || []).find((u: any) => u.telegram_id || u.telegram_chat_id);
      const value = chosen?.telegram_chat_id || chosen?.telegram_id || null;
      // N28 (Igor 08/05): NUNCA cachear null — se DB demorou ou retornou
      // vazio numa request, queremos retentar na proxima em vez de
      // bloquear notify por 5min. Igor reportou que notify Igor "não
      // chegou" mesmo apos ele testar varias vezes — provavel cache
      // stale com null da primeira chamada.
      if (value) {
        this.adminChatIdCache = { value, fetchedAt: now };
        this.logger.log(
          `Resolved admin chat_id from DB fallback: ${value} (role=admin)`,
        );
      } else {
        this.logger.warn(
          'No admin found in DB with telegram_id set — NOT caching null (will retry next call)',
        );
      }
      return value;
    } catch (err: any) {
      this.logger.error(`resolveAdminChatId failed: ${err.message}`);
      return null;
    }
  }

  private async notifyAdminForTakeover(
    platform: string,
    externalChatId: string,
    originalMessage: string,
  ) {
    // N28b (Igor 08/05): SEMPRE prefere o owner ativo da Business
    // connection, qualquer que seja a platform. Quem configurou Business
    // E o "atendente humano" do sistema todo — recebe notify mesmo se
    // a mensagem veio do bot publico (platform=telegram). Antes a notify
    // ia pro admin DB — que pode ser OUTRA pessoa (ex: Eduardo dev
    // testando, telegram_id 2006803983, enquanto Igor tem 1134910998).
    let targetChatId: string | null = null;
    let targetSource = 'admin_db';

    try {
      const { data: businessConns } = await this.supabase.client
        .from('telegram_business_connections')
        .select('telegram_user_id, can_reply, is_enabled')
        .eq('is_enabled', true)
        .eq('can_reply', true)
        .limit(5);

      const owners = (businessConns || [])
        .map((c: any) => String(c.telegram_user_id))
        .filter(Boolean);

      if (owners.length > 0) {
        targetChatId = owners[0];
        targetSource = 'business_owner';
      }
    } catch (err: any) {
      this.logger.warn(
        `notifyAdminForTakeover: lookup business owner failed: ${err.message}`,
      );
    }

    if (!targetChatId) {
      targetChatId = await this.resolveAdminChatId();
      targetSource = 'admin_db_fallback';
    }

    if (!targetChatId || !this.telegramsService) {
      this.logger.warn(
        `notifyAdminForTakeover: chat=${externalChatId} platform=${platform} — targetChatId=${targetChatId} telegrams=${!!this.telegramsService} → DROPPED`,
      );
      return;
    }

    const text =
      `🤖 *IA pausada — atenção necessária*\n\n` +
      `*Plataforma:* ${platform}\n` +
      `*Chat ID do cliente:* \`${externalChatId}\`\n\n` +
      `*Última mensagem:*\n_${originalMessage}_\n\n` +
      `👉 [Assumir no painel de IA](https://www.cinevisionapp.com.br/admin/ai-chat)`;

    try {
      await this.telegramsService.sendMessage(parseInt(targetChatId, 10), text, {
        parse_mode: 'Markdown',
      });
      this.logger.log(
        `notifyAdminForTakeover OK: client=${externalChatId} → target=${targetChatId} (source=${targetSource})`,
      );
    } catch (err: any) {
      this.logger.error(
        `notifyAdminForTakeover SEND FAILED: client=${externalChatId} target=${targetChatId} source=${targetSource}: ${err.message}`,
      );
    }
  }
}
