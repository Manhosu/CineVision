import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SupabaseService } from '../../../config/supabase.service';

export interface AiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AiCompletionResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  model: string;
  stopReason?: string;
}

/** Bloco do system prompt. `cached: true` marca como cacheável (5min TTL). */
export interface SystemBlock {
  text: string;
  cached?: boolean;
}

// N9 (Igor 7:50 PM 04/05): "ainda tem saldo e não, possivelmente
// ainda não está funcionando". O catch genérico antes só falava
// "claude failed" — agora classificamos a falha em categorias
// específicas pra Igor saber o que está acontecendo (saldo, rate
// limit, key inválida, modelo indisponível, timeout).
export type ClaudeFailureKind =
  | 'auth' // 401 — API key inválida/revogada
  | 'rate_limit' // 429 — rate limit por minuto/dia
  | 'overloaded' // 529 — Anthropic sobrecarregado
  | 'low_balance' // 400 com `credit_balance_too_low` ou similar
  | 'model_unavailable' // 404/400 com `model not found`
  | 'timeout' // axios timeout (12s)
  | 'network' // erro de rede sem resposta
  | 'config_missing' // ANTHROPIC_API_KEY não configurada no env
  | 'unknown';

export class ClaudeApiError extends Error {
  constructor(
    public readonly kind: ClaudeFailureKind,
    public readonly statusCode: number | null,
    public readonly model: string,
    public readonly anthropicError: any,
    message: string,
  ) {
    super(message);
    this.name = 'ClaudeApiError';
  }
}

function classifyClaudeError(err: any, model: string): ClaudeApiError {
  if (err?.code === 'ECONNABORTED' || /timeout/i.test(err?.message || '')) {
    return new ClaudeApiError('timeout', null, model, null, 'Claude timeout');
  }
  const status: number | undefined = err?.response?.status;
  const data = err?.response?.data;
  const errType: string | undefined = data?.error?.type;
  const errMsg: string | undefined = data?.error?.message;

  if (!status) {
    return new ClaudeApiError(
      'network',
      null,
      model,
      data || null,
      `Claude network error: ${err?.message || 'unknown'}`,
    );
  }
  if (status === 401) {
    return new ClaudeApiError('auth', status, model, data, 'Claude 401 — API key inválida ou revogada');
  }
  if (status === 429) {
    return new ClaudeApiError(
      'rate_limit',
      status,
      model,
      data,
      `Claude 429 rate limit — ${errMsg || 'too many requests'}`,
    );
  }
  if (status === 529) {
    return new ClaudeApiError('overloaded', status, model, data, 'Claude 529 — Anthropic sobrecarregado');
  }
  if (status === 400 && /credit|balance|insufficient/i.test(errMsg || '' + errType || '')) {
    return new ClaudeApiError(
      'low_balance',
      status,
      model,
      data,
      `Claude 400 — saldo insuficiente: ${errMsg}`,
    );
  }
  if ((status === 404 || status === 400) && /model/i.test(errType || errMsg || '')) {
    return new ClaudeApiError(
      'model_unavailable',
      status,
      model,
      data,
      `Claude ${status} — modelo "${model}" indisponível: ${errMsg}`,
    );
  }
  return new ClaudeApiError(
    'unknown',
    status,
    model,
    data,
    `Claude ${status} — ${errMsg || err?.message || 'unknown error'}`,
  );
}

@Injectable()
export class ClaudeProvider {
  private readonly logger = new Logger(ClaudeProvider.name);
  private readonly apiUrl = 'https://api.anthropic.com/v1/messages';
  // Igor (08/05): cache de 5min do api key lido do banco. Evita 1 query
  // por chamada Claude mas ainda permite hot reload se Igor trocar.
  private dbKeyCache: { value: string | null; fetchedAt: number } | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabase: SupabaseService,
  ) {}

  // Igor (08/05): Render free tier mantém 2 containers durante deploy.
  // Um deles pode ter env var, outro não. Pra resolver intermitência,
  // caímos pro DB (admin_settings.anthropic_api_key) quando process.env
  // não tem. Garante que TODOS os containers leem a MESMA key.
  private async resolveApiKey(): Promise<string | null> {
    const envKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (envKey) return envKey;

    const now = Date.now();
    if (this.dbKeyCache && now - this.dbKeyCache.fetchedAt < 5 * 60 * 1000) {
      return this.dbKeyCache.value;
    }

    try {
      const { data } = await this.supabase.client
        .from('admin_settings')
        .select('value')
        .eq('key', 'anthropic_api_key')
        .maybeSingle();
      const value = (data?.value as any)?.toString?.() || null;
      // Cacheia apenas valores positivos (mesmo padrão do resolveAdminChatId).
      if (value) {
        this.dbKeyCache = { value, fetchedAt: now };
        this.logger.log(
          `[CLAUDE_DEBUG] Loaded ANTHROPIC_API_KEY from DB fallback (len=${value.length})`,
        );
      }
      return value;
    } catch (err: any) {
      this.logger.error(`resolveApiKey DB fallback failed: ${err.message}`);
      return null;
    }
  }

  async complete(options: {
    system: string | SystemBlock[];
    messages: AiMessage[];
    model?: string;
    maxTokens?: number;
  }): Promise<AiCompletionResult> {
    const apiKey = await this.resolveApiKey();
    if (!apiKey) {
      const allKeys = Object.keys(process.env)
        .filter((k) => /ANTHROPIC|API_KEY|CLAUDE/i.test(k))
        .map((k) => `${k}=${process.env[k] ? `set(len=${process.env[k]!.length})` : 'EMPTY'}`)
        .join(', ');
      this.logger.error(
        `[CLAUDE_DEBUG] ANTHROPIC_API_KEY not loaded (env nor DB). process.env scan: ${allKeys || '(no matches)'} | NODE_ENV=${process.env.NODE_ENV} | CWD=${process.cwd()} | PID=${process.pid}`,
      );
      throw new ClaudeApiError(
        'config_missing',
        null,
        'n/a',
        null,
        'ANTHROPIC_API_KEY não configurada (nem env nem admin_settings DB).',
      );
    }
    this.logger.debug(
      `[CLAUDE_DEBUG] API key OK (len=${apiKey.length}, PID=${process.pid})`,
    );

    const HAIKU_DEFAULT = 'claude-haiku-4-5-20251001';
    const HAIKU_ALIAS = 'claude-haiku-4-5';

    let primaryModel =
      options.model ||
      this.configService.get<string>('AI_MODEL') ||
      HAIKU_DEFAULT;

    // Eduardo (15/07): guard anti-Opus. Bot atende dúvidas simples
    // (catálogo, PIX, suporte) — Opus é ~5x mais caro no preço unitário
    // e no volume real gera fatura absurda ($6 durando 24h em vez de
    // semanas). Se Opus for necessário algum dia pra query específica,
    // remover este guard conscientemente. Enquanto isso, se env AI_MODEL
    // ou caller tentar Opus, força Haiku e loga.
    if (/opus/i.test(primaryModel)) {
      this.logger.warn(
        `[CLAUDE_GUARD] Modelo "${primaryModel}" bloqueado (Opus). Forçando ${HAIKU_DEFAULT} — remova este guard se Opus for realmente necessário.`,
      );
      primaryModel = HAIKU_DEFAULT;
    }

    // N9 — fallback de modelo. Se o principal (com timestamp específico)
    // não estiver disponível por motivo de versão deprecated, tenta
    // o alias sem timestamp. Igor reportou IA caindo mesmo com saldo —
    // alguns desses casos são modelo deprecated; com fallback evitamos.
    const fallbackModel = HAIKU_ALIAS;
    const modelsToTry = primaryModel === fallbackModel
      ? [primaryModel]
      : [primaryModel, fallbackModel];

    // Igor (13/06): normaliza o `system` em blocos. Reordena pra blocos
    // cacheáveis virem PRIMEIRO (cache_control marca o fim da região
    // cacheável; tudo antes é cached). Bloco volátil (catálogo) fica
    // depois — paga input full só ele a cada call, não os 3.4k tokens
    // do prompt estável que ficam em cache hit (~10% do preço).
    const rawBlocks: SystemBlock[] = Array.isArray(options.system)
      ? options.system.filter((b) => b.text)
      : [{ text: options.system, cached: true }];
    const cachedBlocks = rawBlocks.filter((b) => b.cached !== false);
    const uncachedBlocks = rawBlocks.filter((b) => b.cached === false);
    const systemPayload: any[] = [];
    cachedBlocks.forEach((b, i) => {
      const block: any = { type: 'text', text: b.text };
      // Só marca cache_control no ÚLTIMO bloco cached (define o breakpoint).
      if (i === cachedBlocks.length - 1) {
        block.cache_control = { type: 'ephemeral' };
      }
      systemPayload.push(block);
    });
    uncachedBlocks.forEach((b) => {
      systemPayload.push({ type: 'text', text: b.text });
    });

    let lastErr: ClaudeApiError | null = null;
    for (const model of modelsToTry) {
      try {
        const response = await axios.post(
          this.apiUrl,
          {
            model,
            max_tokens: options.maxTokens || 1024,
            system: systemPayload,
            messages: options.messages.filter((m) => m.role !== 'system'),
          },
          {
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'anthropic-beta': 'prompt-caching-2024-07-31',
              'content-type': 'application/json',
            },
            // N3 — antes 30s. 12s é mais que suficiente pra Claude
            // responder em condição normal (~3-5s); se passou disso é
            // melhor cair no retry/fallback rápido do que segurar.
            timeout: 12000,
          },
        );

        const text = (response.data.content || [])
          .filter((b: any) => b.type === 'text')
          .map((b: any) => b.text)
          .join('\n');

        const usage = response.data.usage || {};
        return {
          text,
          inputTokens: usage.input_tokens || 0,
          outputTokens: usage.output_tokens || 0,
          cacheReadTokens: usage.cache_read_input_tokens || 0,
          cacheCreationTokens: usage.cache_creation_input_tokens || 0,
          model,
          stopReason: response.data.stop_reason,
        };
      } catch (err: any) {
        lastErr = classifyClaudeError(err, model);
        this.logger.warn(
          `Claude failure (model=${model}, kind=${lastErr.kind}, status=${lastErr.statusCode}): ${lastErr.message}`,
        );
        // Só faz fallback de modelo em caso de model_unavailable.
        // Outros erros (rate_limit, auth, low_balance) propagam direto.
        if (lastErr.kind !== 'model_unavailable') {
          throw lastErr;
        }
      }
    }
    // Se chegou aqui, todos os modelos falharam.
    throw lastErr!;
  }
}
