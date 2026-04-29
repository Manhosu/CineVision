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
  async isEnabled(platform: 'telegram' | 'whatsapp'): Promise<boolean> {
    const key =
      platform === 'telegram'
        ? 'ai_chat_enabled_telegram'
        : 'ai_chat_enabled_whatsapp';
    const { data } = await this.supabase.client
      .from('admin_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    return (data?.value ?? 'false').toLowerCase() === 'true';
  }

  async getEnabledFlags() {
    const [tg, wa] = await Promise.all([
      this.supabase.client.from('admin_settings').select('value').eq('key', 'ai_chat_enabled_telegram').maybeSingle(),
      this.supabase.client.from('admin_settings').select('value').eq('key', 'ai_chat_enabled_whatsapp').maybeSingle(),
    ]);
    return {
      telegram: (tg.data?.value ?? 'false').toLowerCase() === 'true',
      whatsapp: (wa.data?.value ?? 'false').toLowerCase() === 'true',
    };
  }

  async setEnabledFlags(input: { telegram?: boolean; whatsapp?: boolean }) {
    const updates: Array<[string, string]> = [];
    if (input.telegram !== undefined) updates.push(['ai_chat_enabled_telegram', String(input.telegram)]);
    if (input.whatsapp !== undefined) updates.push(['ai_chat_enabled_whatsapp', String(input.whatsapp)]);
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
    platform: 'telegram' | 'whatsapp',
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
    platform: 'telegram' | 'whatsapp';
    externalChatId: string;
    messageText: string;
    userId?: string;
  }): Promise<AiReply> {
    const { platform, externalChatId, messageText, userId } = params;

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

${faqText ? `FAQ DE SUPORTE:\n${faqText}` : ''}

INSTRUÇÕES OBRIGATÓRIAS:
- Se a mensagem do usuário for ambígua, vazia ou genérica (ex: "quero", "tem?", "tá aí?", "oi", "boa noite"), faça uma pergunta de esclarecimento ANTES de qualquer ação. Exemplos: "Que filme você procura?", "Sobre qual conteúdo você quer saber?". NUNCA emita marcadores em mensagens ambíguas — apenas pergunte de volta.
- Se o cliente pedir UM ou MAIS filmes que estão listados no catálogo acima, responda com nome e valor de cada um e inclua um marcador <<BUY:ID_DO_CONTEUDO>> para CADA filme detectado (um marcador por filme). O sistema gera automaticamente um único PIX agregado com desconto progressivo aplicado.
- Se o cliente pedir EXPLICITAMENTE um título específico que NÃO existe no catálogo (ex: "Quero o filme Avatar 3"), responda: "Vou verificar a disponibilidade e já te retorno, beleza?" e inclua o marcador <<PAUSE:content_not_found>>. NUNCA pause sem o usuário ter citado um título nominalmente.
- Responda sempre em português brasileiro, de forma amigável e humanizada.
- Não revele que você é uma IA a menos que o usuário pergunte.
- Nunca invente filmes que não estão no catálogo.`;

    const history = await this.recentHistory(conversation.id);

    const completion = await this.claude.complete({
      system: systemPrompt,
      messages: history,
      maxTokens: 512,
    });

    const rawText = completion.text.trim();

    // Parse directives
    let paused = false;
    let suggestedContentIds: string[] = [];
    let cleanText = rawText;

    if (/<<PAUSE:content_not_found>>/i.test(rawText)) {
      paused = true;
      cleanText = cleanText.replace(/<<PAUSE:[^>]+>>/gi, '').trim();
      await this.pauseConversation(conversation.id, 'content_not_found');
      await this.notifyAdminForTakeover(platform, externalChatId, messageText);
    }

    const buyMatches = [...rawText.matchAll(/<<BUY:([0-9a-f-]{36})>>/gi)];
    suggestedContentIds = buyMatches.map((m) => m[1]);
    cleanText = cleanText.replace(/<<BUY:[^>]+>>/gi, '').trim();

    // Se BUY foi detectado (1 ou N itens), gera UM link de pagamento
    // agregado: o cart-service aplica o desconto progressivo
    // automaticamente, então 3 filmes pedidos juntos saem com 1 PIX
    // único e desconto consolidado. Igor pediu isso explicitamente.
    let paymentLink: string | undefined;
    if (suggestedContentIds.length) {
      paymentLink = await this.createQuickBuyLink(
        suggestedContentIds,
        externalChatId,
        userId,
      );
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
