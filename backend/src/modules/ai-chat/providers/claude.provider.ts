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

    const model =
      options.model ||
      this.configService.get<string>('AI_MODEL') ||
      'claude-haiku-4-5-20251001';

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
        timeout: 30000,
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
  }
}
