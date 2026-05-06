import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface AiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AiCompletionResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  stopReason?: string;
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

  constructor(private readonly configService: ConfigService) {}

  async complete(options: {
    system: string;
    messages: AiMessage[];
    model?: string;
    maxTokens?: number;
  }): Promise<AiCompletionResult> {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const primaryModel =
      options.model ||
      this.configService.get<string>('AI_MODEL') ||
      'claude-haiku-4-5-20251001';

    // N9 — fallback de modelo. Se o principal (com timestamp específico)
    // não estiver disponível por motivo de versão deprecated, tenta
    // o alias sem timestamp. Igor reportou IA caindo mesmo com saldo —
    // alguns desses casos são modelo deprecated; com fallback evitamos.
    const fallbackModel = 'claude-haiku-4-5';
    const modelsToTry = primaryModel === fallbackModel
      ? [primaryModel]
      : [primaryModel, fallbackModel];

    let lastErr: ClaudeApiError | null = null;
    for (const model of modelsToTry) {
      try {
        const response = await axios.post(
          this.apiUrl,
          {
            model,
            max_tokens: options.maxTokens || 1024,
            system: options.system,
            messages: options.messages.filter((m) => m.role !== 'system'),
          },
          {
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
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

        return {
          text,
          inputTokens: response.data.usage?.input_tokens || 0,
          outputTokens: response.data.usage?.output_tokens || 0,
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
