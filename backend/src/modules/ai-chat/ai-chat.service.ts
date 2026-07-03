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

  // Igor (13/06): circuit breaker pra Claude. Quando a Anthropic está em
  // outage (503/529 em sequência), o retry agressivo queimava tokens
  // faturados sem entregar resposta. Se 3 falhas em 60s, pausa IA por 5min.
  private claudeFailures: number[] = [];
  private claudeOpenUntil = 0;
  private readonly CB_WINDOW_MS = 60_000;
  private readonly CB_THRESHOLD = 3;
  private readonly CB_OPEN_DURATION_MS = 5 * 60_000;

  // Igor (13/06): rate limit por user — 60 msgs/hora numa janela rolante.
  // Bot legítimo no fluxo de compra manda 5-15 msgs; cap em 60 só corta
  // abuso/scraper/loop entre bots externos.
  private userMsgWindow: Map<string, number[]> = new Map();
  private readonly RL_WINDOW_MS = 60 * 60_000;
  private readonly RL_MAX_PER_HOUR = 60;

  private isCircuitOpen(): boolean {
    return Date.now() < this.claudeOpenUntil;
  }

  private recordClaudeFailure() {
    const now = Date.now();
    this.claudeFailures = this.claudeFailures.filter((t) => now - t < this.CB_WINDOW_MS);
    this.claudeFailures.push(now);
    if (this.claudeFailures.length >= this.CB_THRESHOLD) {
      this.claudeOpenUntil = now + this.CB_OPEN_DURATION_MS;
      this.claudeFailures = [];
      this.logger.error(
        `[circuit-breaker] ${this.CB_THRESHOLD} falhas Claude em ${this.CB_WINDOW_MS / 1000}s — pausando IA por ${this.CB_OPEN_DURATION_MS / 60000}min`,
      );
    }
  }

  private isOverRateLimit(userId: string): boolean {
    const now = Date.now();
    const hits = (this.userMsgWindow.get(userId) || []).filter(
      (t) => now - t < this.RL_WINDOW_MS,
    );
    if (hits.length >= this.RL_MAX_PER_HOUR) {
      this.userMsgWindow.set(userId, hits);
      return true;
    }
    hits.push(now);
    this.userMsgWindow.set(userId, hits);
    // GC ocasional pra Map não crescer indefinido.
    if (this.userMsgWindow.size > 5000) {
      for (const [k, v] of this.userMsgWindow.entries()) {
        const live = v.filter((t) => now - t < this.RL_WINDOW_MS);
        if (live.length === 0) this.userMsgWindow.delete(k);
        else this.userMsgWindow.set(k, live);
      }
    }
    return false;
  }

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

  private async recentHistory(conversationId: string, limit = 8): Promise<AiMessage[]> {
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

    // Igor (13/06): guards de custo — circuit breaker (Anthropic em outage)
    // e rate limit (60 msgs/h por cliente, evita scraper/loop). Respostas
    // fixas, sem chamar Claude.
    if (this.isCircuitOpen()) {
      const reply = 'Estamos com instabilidade momentânea, em alguns minutos voltamos a responder. Obrigado pela paciência! 🍿';
      await this.appendMessage(conversation.id, 'assistant', reply);
      return { text: reply, paused: false };
    }
    const rlKey = conversation.user_id || externalChatId;
    if (rlKey && this.isOverRateLimit(rlKey)) {
      const reply = 'Você atingiu o limite de mensagens da hora. Aguarde um pouco e a gente continua! 😊';
      await this.appendMessage(conversation.id, 'assistant', reply);
      this.logger.warn(`[rate-limit] user ${rlKey} hit cap of ${this.RL_MAX_PER_HOUR}/h on conv ${conversation.id}`);
      return { text: reply, paused: false };
    }

    // Igor (08/05): cliente mandando gratidao apos compra ("obrigado",
    // "muitissimo obrigada", "valeu", "amei") deve receber resposta
    // gentil, MESMO em conversa pausada (admin/owner takeover ja
    // respondeu o atendimento, o "obrigado" e so um agradecimento
    // residual que deve receber retorno educado e nao "ja chamei a
    // equipe").
    //
    // Por isso o pre-check fica ANTES do check de ai_enabled.
    // Texto fixo do Igor — sem chamar Claude.
    const gratitudePattern =
      /\b(obrigad[oa]s?|muito\s+obrigad[oa]|muit[ií]ssim[oa]\s+obrigad[oa]|valeu|brigad[oa]|gratid[ãa]o|grato|grata|parab[ée]ns|amei|adorei|melhores|sucesso|maravilhos[ao]|excelente|tmj|vlw)\b/i;
    if (gratitudePattern.test(messageText)) {
      const reply = 'Qualquer coisa só me chamar, ficamos à sua disposição ❤️🍿';
      await this.appendMessage(conversation.id, 'assistant', reply);
      this.logger.log(
        `Gratitude detected in conv ${conversation.id} (ai_enabled=${conversation.ai_enabled}) — replied with fixed text, skipped Claude`,
      );
      return { text: reply, paused: false, suggestedContentIds: [] };
    }

    if (!conversation.ai_enabled) {
      // Igor (02/06): reativa IA AQUI também — não só pelo cron de
      // reengagement. Cenário real: conversa pausada (admin/owner
      // takeover) ficou parada dias, cliente volta a falar; o cron
      // pega só conversas idle (last_message_at < cutoff) e o cliente
      // falando agora joga ela pra fora dessa janela. Resultado: bot
      // respondia "chamei a equipe" mesmo a pausa sendo de 3 dias atrás.
      // Mesma whitelist do reengagement.service.ts pra consistência.
      const TAKEOVER_REASONS = new Set(['owner_takeover', 'admin_takeover']);
      const SOFT_PAUSE_REASONS = new Set([
        'content_not_found',
        'needs_human',
        'media_received',
        'receipt_image_received',
        'detail_ids_invalid',
        'manual',
      ]);
      const TAKEOVER_TIMEOUT_MS = 60 * 60 * 1000; // 1h
      const SOFT_TIMEOUT_MS = 30 * 60 * 1000; // 30min

      // paused_at null = conversa antiga pausada antes do campo existir.
      // Tratar como "pausa infinita" para garantir reativação imediata.
      const pausedFor = conversation.paused_at
        ? Date.now() - new Date(conversation.paused_at).getTime()
        : Infinity;
      const isTakeoverExpired =
        TAKEOVER_REASONS.has(conversation.paused_reason || '') &&
        pausedFor >= TAKEOVER_TIMEOUT_MS;
      const isSoftExpired =
        SOFT_PAUSE_REASONS.has(conversation.paused_reason || '') &&
        pausedFor >= SOFT_TIMEOUT_MS;

      if (isTakeoverExpired || isSoftExpired) {
        const oldReason = conversation.paused_reason;
        await this.supabase.client
          .from('ai_conversations')
          .update({
            ai_enabled: true,
            paused_reason: null,
            paused_at: null,
          })
          .eq('id', conversation.id);
        conversation.ai_enabled = true;
        conversation.paused_reason = null;
        conversation.paused_at = null;
        this.logger.log(
          `Conversation ${conversation.id} auto-reactivated on customer return (was ${oldReason} for ${Math.round(pausedFor / 60000)}min)`,
        );
        // Deixa o flow continuar normal — a IA vai responder essa mensagem.
      } else {
        // Pausa ainda ativa — Igor está no atendimento recente. Mensagem
        // do cliente já foi salva acima e vai aparecer no painel.
        this.logger.log(
          `Conversation ${conversation.id} paused (reason: ${conversation.paused_reason || 'unknown'}, paused for ${Math.round(pausedFor / 60000)}min) — message persisted but no AI reply.`,
        );
        return { text: '', paused: true };
      }
    }

    // Build context: training + catalog hits + history
    const training = await this.getTraining();
    // Limite 5 itens (era 8) — cada item com sinopse custa ~150 tokens
    const hits = await this.catalog.searchRelevant(messageText, 5);
    const catalogBlock = this.catalog.formatHitsForPrompt(hits);

    // FAQ: máximo 15 pares — evita prompt crescer sem limite com FAQ grande
    const faqText = (training.faq_pairs || []).slice(0, 15)
      .map((f: any) => `P: ${f.question}\nR: ${f.answer}`)
      .join('\n\n');

    // Igor (21/05): orientação de venda anexada SEMPRE (sem sobrescrever o
    // prompt customizado do painel) — IA já manda o link de compra após
    // responder, cita a qualidade e reforça o acesso vitalício.
    const salesGuide = `INSTRUÇÕES DE VENDA (sempre seguir):
- Quando falar de um título específico do catálogo, SEMPRE inclua o marcador <<DETAIL:ID>> usando o ID EXATO que aparece no CATÁLOGO RELEVANTE — isso já envia o link de compra pro cliente. Faça isso logo depois de responder, sem esperar o cliente pedir.
- Se perguntarem a qualidade, responda pelo campo "Qualidade" do catálogo (ex: 1080p Full HD). Sem esse campo, diga que é em alta qualidade.
- O acesso ao filme/série é PRA SEMPRE (vitalício): compra uma vez e assiste quando e quantas vezes quiser. Reforce isso quando fizer sentido.`;

    // Igor (13/06 + 17/06 + 02/07): cache split. Bloco estável + catálogo volátil.
    // Haiku 4.5 exige MÍNIMO 4096 tokens no bloco cacheável (era 1024
    // no Haiku antigo; docs Anthropic atualizadas confirmam 4096 pro 4.5).
    // Se ficar abaixo, cache é IGNORADO silenciosamente — pagando input
    // full em toda chamada (foi o que aconteceu de 17/06 até 02/07,
    // stableBlock tinha ~1293 tokens e cache_read/creation vinha 0 sempre).
    // Cache_read custa ~3% do input full — economia esperada de ~90% nas
    // chamadas dentro da janela de 5min. Contexto expandido abaixo cobre
    // fluxos concretos + exemplos + edge cases — passa dos 4096 tokens
    // sem precisar padding artificial e ainda melhora qualidade das
    // respostas com casos reais que aparecem no atendimento.
    const cinevisionContext = `CONTEXTO DA CINE VISION (referência completa para atender):

## Sobre a plataforma
A Cine Vision é uma plataforma brasileira de venda avulsa de filmes e séries via Telegram, com mais de 1000 títulos catalogados incluindo filmes de todas as décadas, séries clássicas e recentes, animações, documentários, novelinhas (filmes curtos populares), lançamentos, sessão da tarde e conteúdo infantil. O cliente compra por título individual e recebe acesso vitalício — uma compra, assiste quantas vezes quiser, quando quiser. Não é assinatura mensal, não tem streaming próprio — a entrega é via grupo do Telegram onde o cliente vê os arquivos direto e pode baixar/assistir no próprio Telegram.

## Modelo de negócio
- Compra avulsa: R$ 3,90 a R$ 19,90 por título dependendo do lançamento.
- Pré-venda: filme ainda não liberado, cliente compra com desconto e recebe notificação automática quando liberar.
- Sem assinatura, sem plano, sem mensalidade. Pagou uma vez, tem pra sempre.
- Pagamento: PIX (instantâneo, aprovação em segundos) ou cartão (mesmo timing).
- Entrega: após pagar, cliente recebe link direto do grupo do filme no Telegram. O bot gera invite de uso único automaticamente. Entra no grupo, tá o filme lá.
- Suporte: via chat do próprio bot (você, a Yanna) ou WhatsApp Business.

## Catálogo
- Sempre em expansão. Filmes/séries novos entram na home como "lançamentos" (badge NOVIDADE).
- Séries têm múltiplas temporadas às vezes cadastradas separadamente (ex: "From: Origem 3ª Temporada" é diferente de "From: Origem 1ª Temporada"). Quando o cliente cita só o nome, mostre a temporada mais atual disponível ou pergunte qual quer.
- Qualidade padrão: 1080p Full HD. Alguns títulos raros podem ser 720p HD (indicado no campo Qualidade).
- Áudio: dublado (PT-BR), legendado ou dual (áudio original + legenda). Cada título tem seu tipo no campo Áudio.
- Se o cliente pergunta um título e ele NÃO está no bloco CATÁLOGO RELEVANTE, não invente — significa que não temos.

## Fluxo padrão de atendimento
1. Cliente pergunta sobre título → você confirma se está no catálogo (bloco CATÁLOGO RELEVANTE abaixo) e responde brevemente com nome + tipo (filme/série) + confirmação.
2. Se está disponível: indique com <<DETAIL:ID>> usando o ID EXATO do catálogo — isso mostra o botão de compra automaticamente, sem você precisar pedir/perguntar. Faça isso na mesma resposta, não espere próxima mensagem.
3. Se NÃO está disponível: fale que ainda não temos e peça pro cliente solicitar via /solicitar (comando do bot que cadastra pedido pra equipe adicionar). Nunca prometa "em breve" se não estiver marcado como pré-venda no catálogo.
4. Dúvidas comuns: responda direto pelo catálogo — qualidade, áudio, preço, tipo. Se cliente pergunta "tá dublado?", olhe o campo Áudio do título.
5. Cliente pedindo lista ampla ("o que vocês têm?", "quais filmes?", "me manda o catálogo") → use <<LIST_REDIRECT>> que envia o link da home direto.
6. Reclamação de pagamento não confirmado: oriente a clicar em "Não consegui pagar" no checkout — isso ativa o fluxo de PIX manual com chave copiável.
7. Cliente perguntando sobre entrega/acesso após comprar: acesso ao grupo é automático via bot em segundos. Se não recebeu, pede pra checar o Telegram e mensagens diretas do bot.

## Estilo e tom
- Informal, simpático, direto ao ponto. Português brasileiro casual.
- Frases curtas — no máximo 2-3 por resposta.
- Use expressões tipo "Opa!", "Blz!", "Beleza!", "Show!", "Tá aqui sim!" naturalmente.
- Sem enrolação, sem "irei verificar", sem "aguarde um momento".
- Emojis moderados — 🎬 🍿 ⭐ funcionam bem, mas não abuse.
- Não use "você" formal — se aproxime como amigo indicando filme.
- NUNCA use tabelas — só texto corrido.

## Exemplos de conversa (padrão a seguir)

Exemplo 1 — cliente pede filme direto:
Cliente: "Tem Divertida Mente 2?"
Você: "Opa, tá aqui sim! 🎬 Divertida Mente 2, dublado, R$ 6,90. <<DETAIL:xxxx>>"

Exemplo 2 — cliente pede algo que não temos:
Cliente: "Vocês têm Vingadores Guerra Infinita?"
Você: "Ainda não temos esse não! Mas manda /solicitar aqui que a gente adiciona no catálogo em breve 🙌"

Exemplo 3 — cliente pergunta ambíguo/curto:
Cliente: "Missão Impossível"
Você: (busque no catálogo, mostre o(s) disponível(is)) "Achei essas: Missão Impossível Acerto Final (dublado) e Missão Impossível 7 (dublado). Qual quer? <<DETAIL:xxxx>>"

Exemplo 4 — cliente pergunta lista:
Cliente: "Me manda a lista dos filmes"
Você: "Bora ver o catálogo completo? <<LIST_REDIRECT>>"

Exemplo 5 — cliente pergunta qualidade:
Cliente: "Está em 4k?"
Você: "Tá em 1080p Full HD, alta qualidade!" (ou o que estiver no campo Qualidade)

Exemplo 6 — cliente reclama de pagamento:
Cliente: "Não consegui pagar o pix, não vai"
Você: "Ah, então clica em 'Não consegui pagar' no checkout que aparece a chave PIX manual, é só copiar e colar no seu banco 👍"

Exemplo 7 — cliente reclama que não recebeu após pagar:
Cliente: "Paguei e não recebi nada"
Você: "Deixa eu chamar o atendente pra confirmar aí, um segundinho! <<PAUSE:manual_check>>"

Exemplo 8 — série com múltiplas temporadas:
Cliente: "Casa do Dragão"
Você: (mostre a temporada mais recente ou lista as opções) "Tá aqui! Casa do Dragão, 3 temporadas disponíveis. <<DETAIL:xxxx>>"

Exemplo 9 — cliente pergunta preço genérico:
Cliente: "Quanto custa?"
Você: "Depende do filme! Varia de R$ 3,90 a R$ 19,90. Qual filme quer? Te falo o valor certinho."

Exemplo 10 — saudação simples:
Cliente: "Oi"
Você: "Opa, tudo bem? 🎬 Qual filme você tá procurando?"

## Limites de escopo (importante)
- Você NÃO responde sobre vida pessoal do cliente, política, religião, conselhos, saúde, relacionamento, trabalho, dinheiro (fora do preço do filme), qualquer coisa fora do catálogo Cine Vision.
- Se cliente insistir em assunto pessoal, traga de volta pro filme educadamente ("Aqui eu cuido só do catálogo mesmo 🎬 Quer indicação de filme?").
- Se pergunta é curta e ambígua (1-3 palavras), assuma que é TÍTULO de filme/série e busque no catálogo antes de pedir esclarecimento.
- Se cliente perguntar quem é o dono, quem administra, qual empresa — responda genérico ("Sou a atendente da Cine Vision! Como posso te ajudar com o catálogo?"). Não dê nome, CNPJ, endereço.
- Nunca prometa desconto/cupom se não tem cupom ativo no catálogo. Não invente promoção.
- Nunca compartilhe informação de outros clientes.

## Comandos disponíveis no bot (pra você citar quando útil)
- /start — reinicia conversa e mostra menu principal
- /catalogo ou /filmes — abre link do catálogo
- /solicitar — cliente pede filme que não tem
- /meuscompras — lista o que o cliente já comprou
- /suporte — chama atendente humano
- /pix — instruções de pagamento PIX manual

## Marcadores especiais que você usa (sistema processa depois)
- <<DETAIL:ID>> — mostra o card do filme com botão de compra. ID vem do bloco CATÁLOGO RELEVANTE, campo ID.
- <<LIST_REDIRECT>> — envia link do catálogo completo.
- <<PAUSE:motivo>> — quando não sabe/não pode responder e precisa chamar humano. Motivos comuns: manual_check (pagamento), film_not_found (link inválido), sensitive_topic (assunto delicado), technical_issue (erro técnico).

## O que evitar sempre
- Não confirme que temos filme sem checar o CATÁLOGO RELEVANTE — se não tá lá, não temos.
- Não invente ID, UUID, ou qualquer identificador — sempre use o exato do catálogo.
- Não use markdown de tabela.
- Não use asteriscos pra negrito no texto respondendo pro cliente (Telegram renderiza estranho).
- Não pergunte "como posso ajudar" se o cliente já falou o filme — responda direto.
- Não peça pra cliente esperar sem <<PAUSE>> — se precisa esperar humano, marque com PAUSE.

## FAQ interna (dúvidas frequentes de cliente e como responder)

Q: "É pirata / crime / legal?"
R: Assume sempre a legitimidade da plataforma. "É uma plataforma legalizada de venda de conteúdo brasileiro no Telegram. Se quiser saber mais é só me perguntar sobre os filmes 🎬"

Q: "Como funciona o acesso? Preciso baixar app?"
R: "Não precisa app nada! Depois que compra, cai um link do grupo do filme no Telegram. Entra e o filme tá lá pra assistir ou baixar 👍"

Q: "Posso assistir na TV?"
R: "Dá sim! Você baixa no celular e joga na TV via Chromecast, cabo HDMI ou pelo próprio Telegram Web na Smart TV. Alguns títulos também rodam direto pelo Telegram Desktop se você tem PC conectado na TV."

Q: "É pra vida toda mesmo?"
R: "É sim! Uma compra, acesso pra sempre. Não tem mensalidade, não tem plano — o grupo do filme fica com você indefinidamente."

Q: "E se o filme sair do catálogo?"
R: "Depois que você comprou, o grupo fica ativo pra você mesmo se retirarmos da vitrine. Seu acesso não é revogado."

Q: "Posso baixar o filme?"
R: "Pode! Os arquivos ficam no grupo do Telegram e você baixa pra assistir offline. Mas atenção — não redistribua pra outros grupos, isso é violação dos termos."

Q: "Como pago pelo PIX?"
R: "É automático. Clica em Comprar, aparece o QR Code do PIX e você paga direto pelo app do seu banco. Aprovação em segundos e o link do grupo cai aqui no Telegram."

Q: "Não recebi o QR Code, o que faço?"
R: "Sério? Deixa eu chamar alguém pra verificar teu pedido, tá? <<PAUSE:qr_code_missing>>"

Q: "Posso trocar de filme se não gostar?"
R: "Não fazemos troca porque é conteúdo digital com entrega imediata, mas se tiver algum problema técnico com o arquivo é só me chamar que a gente resolve!"

Q: "Vocês têm 4K?"
R: (Cheque o campo Qualidade do título) "Esse aqui tá em 1080p Full HD! A gente ainda não trabalha com 4K por causa do tamanho dos arquivos, mas 1080p renderiza lindo na TV. 👌"

Q: "Tem legenda embutida ou pode escolher?"
R: "Depende do título! Filmes dublados vêm com áudio PT-BR nativo. Legendados tem legenda embutida em português. Alguns dual tem opção de escolher — vejo no arquivo pra você se quiser detalhe."

Q: "Como faço pra ver quais filmes já comprei?"
R: "Digita /minhascompras aqui no bot que aparece tudo que você já pegou 👍"

Q: "Vocês têm desenho/animação pras crianças?"
R: "Tem sim! Bastante título infantil e animação. Qual você tá procurando?"

Q: "Vocês têm sessão da tarde? Aqueles filmes antigos?"
R: "Temos vários clássicos e sessão da tarde no catálogo. Qual você lembra? 🍿"

Q: "Vocês têm Netflix / Prime / HBO?"
R: "Não somos essas plataformas não! Somos independentes com catálogo próprio. Mas boa parte do que rola nelas também tem aqui, pode buscar o filme que você quer que a gente confirma."

Q: "É seguro pagar aqui?"
R: "Totalmente! Pagamento passa pelo sistema de PIX do Banco Central, seguro. Você paga direto pelo app do seu banco, não passa nada por aqui."

Q: "Posso comprar como presente pra alguém?"
R: "Pode! Depois que comprar, você compartilha o link do grupo com quem quiser presentear. Aí é só a pessoa entrar."

## Objeções típicas e como contornar

Objeção 1 — preço alto:
Cliente: "Achei caro"
Você: "É pra sempre viu! Uma compra, assiste quantas vezes quiser. Se pensar em quanto rende, o valor de plano de streaming mensal já é bem mais caro."

Objeção 2 — desconfiança:
Cliente: "Como sei que vou receber mesmo?"
Você: "É automático! Depois que o PIX cair, chega o link do grupo aqui em segundos. Se por algum motivo não chegar em 1 minuto, é só me chamar."

Objeção 3 — comparação com concorrente:
Cliente: "Vi no site X mais barato"
Você: "Show, mas aqui você tem garantia de acesso vitalício e canal de suporte direto (sou eu 😄). Se preferir dar uma pesquisada, sem stress! Se voltar, tô aqui."

Objeção 4 — quer teste grátis:
Cliente: "Tem trailer? Quero ver antes"
Você: "O trailer você acha no YouTube fácil! Aqui a gente vende o filme completo direto. Se topar depois de ver o trailer, é só voltar aqui."

Objeção 5 — dúvida sobre qualidade:
Cliente: "Quero saber a qualidade do arquivo antes"
Você: (informe pelo campo Qualidade — geralmente 1080p Full HD). "Tá em 1080p Full HD, roda liso na TV. Se por acaso chegar arquivo com problema, a gente troca."

## Categorias comuns que aparecem
- Ação
- Aventura
- Animação (crianças/família)
- Comédia
- Drama
- Documentário
- Terror / Horror / Suspense
- Ficção Científica
- Romance
- Thriller
- Guerra / História
- Musical
- Séries (drama, comédia, ficção)
- Novelinhas (filmes/séries curtos)
- Clássicos / Sessão da Tarde

Quando cliente pedir gênero em vez de título específico ("me indica um terror"), sugira 2-3 títulos do CATÁLOGO RELEVANTE que se encaixem, com <<DETAIL:ID>> em cada.

## Situações que exigem PAUSE (chamar humano)
- Pagamento não confirmou após vários minutos → <<PAUSE:payment_pending>>
- Arquivo com problema no grupo → <<PAUSE:file_issue>>
- Cliente cita erro específico do sistema → <<PAUSE:technical_issue>>
- Solicitação personalizada (desconto, presente customizado) → <<PAUSE:custom_request>>
- Cliente muito agressivo/hostil → <<PAUSE:tone_escalated>>
- Você não sabe responder com certeza → <<PAUSE:unknown>>
- Cliente quer falar com dono/gerente → <<PAUSE:manager_request>>`;
    const stableBlock = `${training.system_prompt}\n\n${salesGuide}\n\n${cinevisionContext}${faqText ? `\n\nFAQ DE SUPORTE:\n${faqText}` : ''}`;
    const systemBlocks = [
      { text: stableBlock, cached: true },
      { text: catalogBlock, cached: false },
    ];

    const history = await this.recentHistory(conversation.id);

    // Timing pra debug F1.4 (Igor reportou que IA demora 3 mensagens
    // pra responder). Logamos latência total e do Claude isolado.
    const t0 = Date.now();
    let completion: Awaited<ReturnType<typeof this.claude.complete>>;
    try {
      // Igor (13/06): retry agressivo (3x) triplicava tokens faturados
      // quando Anthropic está em outage. Agora 1 tentativa só + circuit
      // breaker (3 falhas em 60s → pausa IA por 5min). Outage tem que
      // ser tratada como outage, não como mais 3 chamadas pagas.
      try {
        completion = await this.claude.complete({
          system: systemBlocks,
          messages: history,
          maxTokens: 512,
        });
      } catch (err: any) {
        this.recordClaudeFailure();
        throw err;
      }
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

      // Erros transientes (timeout, network, overloaded, config_missing)
      // NÃO pausam a conversa — a próxima mensagem do cliente tentará
      // de novo normalmente. Só erros permanentes (auth, low_balance)
      // pausam, pois exigem ação manual para resolver.
      const isPermanentError = kind === 'auth' || kind === 'low_balance';
      if (isPermanentError) {
        await this.pauseConversation(conversation.id, pauseReason);
      }
      // N3 — throttle: só notifica Igor 1x por conversa em janela de
      // 30 min, pra não spammar quando Anthropic está fora do ar e
      // 50 clientes mandam msg em sequência.
      if (await this.shouldNotifyClaudeFailure(conversation.id)) {
        await this.notifyAdminForTakeover(platform, externalChatId, messageText, pauseReason, conversation.id);
      }
      return {
        text: '',
        paused: true,
        suggestedContentIds: [],
      };
    }
    const claudeMs = Date.now() - t0;
    this.logger.log(
      `Claude completion ok in ${claudeMs}ms (in=${completion.inputTokens}, out=${completion.outputTokens}, cache_read=${completion.cacheReadTokens}, cache_create=${completion.cacheCreationTokens}) conv=${conversation.id}`,
    );

    // Igor (13/06): persiste breakdown de custo pra dashboard /admin/ai-usage.
    // Pricing Haiku 4.5: input $0.80, cache_creation $1.00, cache_read $0.08,
    // output $4.00 (USD por 1M tokens). Falha aqui é silenciosa — não pode
    // derrubar a resposta do cliente.
    try {
      const PRICE_IN = 0.8 / 1_000_000;
      const PRICE_OUT = 4.0 / 1_000_000;
      const PRICE_CACHE_CREATE = 1.0 / 1_000_000;
      const PRICE_CACHE_READ = 0.08 / 1_000_000;
      const costUsd =
        completion.inputTokens * PRICE_IN +
        completion.cacheCreationTokens * PRICE_CACHE_CREATE +
        completion.cacheReadTokens * PRICE_CACHE_READ +
        completion.outputTokens * PRICE_OUT;
      await this.supabase.client.from('ai_usage_log').insert({
        conversation_id: conversation.id,
        user_id: conversation.user_id || null,
        external_chat_id: externalChatId,
        platform,
        model: completion.model,
        input_tokens: completion.inputTokens,
        output_tokens: completion.outputTokens,
        cache_read_tokens: completion.cacheReadTokens,
        cache_creation_tokens: completion.cacheCreationTokens,
        cost_usd: costUsd,
        latency_ms: claudeMs,
      });
    } catch (logErr: any) {
      this.logger.warn(`ai_usage_log insert failed: ${logErr.message}`);
    }

    let rawText = completion.text.trim();

    // Igor (27/06): blindagem contra alucinação de URL. A IA Haiku às
    // vezes IGNORA o marker `<<DETAIL:uuid>>` e escreve a URL direto
    // (ex: https://cinevisionapp.com.br/movies/<uuid-inventado>). Como
    // inventa UUID, gera 404 pro cliente. Aqui detectamos qualquer URL
    // `cinevisionapp.com.br/(movies|series|novelinhas)/<uuid>` no texto
    // bruto, validamos se o UUID existe E está PUBLISHED, e:
    //   - válido → mantém URL
    //   - inválido → REMOVE a URL e força PAUSE pra Igor responder.
    const urlMatches = [
      ...rawText.matchAll(
        /https?:\/\/(?:www\.)?cinevisionapp\.com\.br\/(movies|series|novelinhas)\/([0-9a-f-]{36})(\?[^\s]*)?/gi,
      ),
    ];
    if (urlMatches.length) {
      const uuids = Array.from(new Set(urlMatches.map((m) => m[2])));
      const { data: foundContents } = await this.supabase.client
        .from('content')
        .select('id, status')
        .in('id', uuids);
      const validIds = new Set(
        (foundContents || [])
          .filter((c: any) => c.status === 'PUBLISHED' || c.status === 'published')
          .map((c: any) => c.id),
      );
      const invalidUrls: string[] = [];
      for (const m of urlMatches) {
        if (!validIds.has(m[2])) {
          invalidUrls.push(m[0]);
        }
      }
      if (invalidUrls.length) {
        this.logger.warn(
          `[hallucinated-url] removendo ${invalidUrls.length} URL(s) com UUID inválido: ${invalidUrls.join(', ')}`,
        );
        for (const badUrl of invalidUrls) {
          rawText = rawText.split(badUrl).join('');
        }
        // Força PAUSE se TODAS as URLs eram inválidas (cliente recebeu
        // texto "Achei!" + sumiu o link). Pausa pra Igor responder manual.
        if (validIds.size === 0) {
          rawText += '\n\n<<PAUSE:film_not_found>>';
        }
      }
    }

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
      await this.notifyAdminForTakeover(platform, externalChatId, messageText, reason, conversation.id);
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
        await this.notifyAdminForTakeover(platform, externalChatId, messageText, 'detail_ids_invalid', conversation.id);
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
      // Igor (24/05): novelinha → /novelinhas/:id (antes caía em /movies → 404).
      const path =
        c.content_type === 'series'
          ? 'series'
          : c.content_type === 'novelinha'
            ? 'novelinhas'
            : 'movies';
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
      const botUsername = this.configService.get<string>('TELEGRAM_BOT_USERNAME') || 'CineVisionApp_rbot';
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
    // Igor (19/06): diagnóstico de qual chave o backend está usando.
    // Não expõe a chave; só length + 5 primeiros e 4 últimos chars.
    const envKey = process.env.ANTHROPIC_API_KEY || '';
    const keySource = envKey ? 'env' : 'db_fallback';
    const debug = {
      env_present: !!envKey,
      env_length: envKey.length,
      env_preview: envKey ? `${envKey.slice(0, 15)}...${envKey.slice(-4)}` : null,
      env_has_invisible: envKey ? /[\s]/.test(envKey) : false,
      key_source: keySource,
    };
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
        debug,
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
        debug,
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
      // Igor (14/05): N28b — prioriza o DONO do bot Business antes de
      // cair em admin generico do DB. Quem conectou o bot ao próprio
      // Telegram Business é por definição quem deve receber notify de
      // takeover/comprovante. Replicado de telegrams-enhanced.service.
      const { data: businessConns } = await this.supabase.client
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
        this.logger.log(
          `Resolved admin chat_id via business connection: ${value}`,
        );
        return value;
      }

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
    reason?: string,
    conversationId?: string,
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
        `notifyAdminForTakeover: chat=${externalChatId} platform=${platform} reason=${reason} — targetChatId=${targetChatId} telegrams=${!!this.telegramsService} → DROPPED`,
      );
      return;
    }

    // N20 (Igor 08/05): enriquecer DM com motivo da pausa e link direto
    // pra conversa no painel. Antes só mostrava "IA pausada" sem contexto.
    const reasonLabel: Record<string, string> = {
      content_not_found: '🔍 Conteúdo não encontrado no catálogo',
      needs_human: '🙋 Cliente solicitou atendimento humano',
      media_received: '🖼️ Cliente enviou mídia (foto/documento)',
      receipt_image_received: '🧾 Cliente enviou comprovante de pagamento',
      detail_ids_invalid: '🤖 IA inventou IDs inválidos (alucinação)',
      manual: '⏸️ Pausa manual pelo admin',
      claude_auth: '❌ Erro de autenticação Claude',
      claude_low_balance: '💸 Saldo Claude insuficiente',
      unknown: '❓ Motivo desconhecido',
    };
    const reasonText = reason ? (reasonLabel[reason] || `⚠️ ${reason}`) : '⚠️ Não especificado';
    const panelUrl = conversationId
      ? `https://www.cinevisionapp.com.br/admin/ai-chat?conversation=${conversationId}`
      : 'https://www.cinevisionapp.com.br/admin/ai-chat';
    const safeMsg = (originalMessage || '').slice(0, 300).replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');

    const text =
      `🤖 *IA pausada — atenção necessária*\n\n` +
      `*Motivo:* ${reasonText}\n` +
      `*Plataforma:* ${platform}\n` +
      `*Chat ID do cliente:* \`${externalChatId}\`\n\n` +
      `*Última mensagem do cliente:*\n_${safeMsg}_\n\n` +
      `👉 [Assumir atendimento no painel](${panelUrl})`;

    try {
      await this.telegramsService.sendMessage(parseInt(targetChatId, 10), text, {
        parse_mode: 'MarkdownV2',
      });
      this.logger.log(
        `notifyAdminForTakeover OK: client=${externalChatId} reason=${reason} conv=${conversationId} → target=${targetChatId} (source=${targetSource})`,
      );
    } catch (err: any) {
      this.logger.error(
        `notifyAdminForTakeover SEND FAILED: client=${externalChatId} target=${targetChatId} source=${targetSource}: ${err.message}`,
      );
    }
  }
}
