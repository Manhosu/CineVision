import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../config/supabase.service';

/**
 * Igor (13/06): agrega `ai_usage_log` pro dashboard `/admin/ai-usage`.
 * Mostra quanto a IA Claude está custando e quem está consumindo, pra
 * Igor identificar abuso (scraper, loop, cliente chatão) na hora.
 */
@Injectable()
export class AdminAiUsageService {
  private readonly logger = new Logger(AdminAiUsageService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get sb() {
    return this.supabaseService.client;
  }

  /** Totais por janela (24h / 7d / 30d). */
  async getTotals() {
    const now = Date.now();
    const wins = [
      { key: '24h', sinceMs: now - 24 * 3600 * 1000 },
      { key: '7d', sinceMs: now - 7 * 24 * 3600 * 1000 },
      { key: '30d', sinceMs: now - 30 * 24 * 3600 * 1000 },
    ];
    const result: Record<string, { cost_usd: number; calls: number; in_tokens: number; out_tokens: number; cache_read: number }> = {};
    for (const w of wins) {
      const { data, error } = await this.sb
        .from('ai_usage_log')
        .select('cost_usd, input_tokens, output_tokens, cache_read_tokens')
        .gte('created_at', new Date(w.sinceMs).toISOString());
      if (error) throw new Error(`ai_usage_log query failed: ${error.message}`);
      const rows = data || [];
      result[w.key] = {
        cost_usd: rows.reduce((a, r) => a + Number(r.cost_usd || 0), 0),
        calls: rows.length,
        in_tokens: rows.reduce((a, r) => a + (r.input_tokens || 0), 0),
        out_tokens: rows.reduce((a, r) => a + (r.output_tokens || 0), 0),
        cache_read: rows.reduce((a, r) => a + (r.cache_read_tokens || 0), 0),
      };
    }
    return result;
  }

  /** Top usuários por gasto nos últimos 7 dias. */
  async getTopUsers(limit = 20) {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { data, error } = await this.sb
      .from('ai_usage_log')
      .select('user_id, external_chat_id, cost_usd')
      .gte('created_at', since);
    if (error) throw new Error(`top users query failed: ${error.message}`);

    const agg = new Map<string, { user_id: string | null; external_chat_id: string | null; cost_usd: number; calls: number }>();
    for (const row of data || []) {
      const key = row.user_id || `chat:${row.external_chat_id}`;
      const cur = agg.get(key) || { user_id: row.user_id, external_chat_id: row.external_chat_id, cost_usd: 0, calls: 0 };
      cur.cost_usd += Number(row.cost_usd || 0);
      cur.calls += 1;
      agg.set(key, cur);
    }
    const sorted = Array.from(agg.values()).sort((a, b) => b.cost_usd - a.cost_usd).slice(0, limit);

    // Hidrata nomes/emails dos users identificados.
    const userIds = sorted.map((r) => r.user_id).filter(Boolean) as string[];
    let nameMap = new Map<string, { name: string | null; email: string | null }>();
    if (userIds.length) {
      const { data: users } = await this.sb
        .from('users')
        .select('id, name, email')
        .in('id', userIds);
      nameMap = new Map((users || []).map((u: any) => [u.id, { name: u.name, email: u.email }]));
    }
    return sorted.map((r) => ({
      ...r,
      name: r.user_id ? nameMap.get(r.user_id)?.name || null : null,
      email: r.user_id ? nameMap.get(r.user_id)?.email || null : null,
    }));
  }

  /** Histograma de chamadas por hora nas últimas 24h. */
  async getHourlyDistribution() {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data, error } = await this.sb
      .from('ai_usage_log')
      .select('created_at, cost_usd')
      .gte('created_at', since);
    if (error) throw new Error(`hourly query failed: ${error.message}`);

    const buckets: Record<string, { calls: number; cost_usd: number }> = {};
    for (let i = 23; i >= 0; i--) {
      const d = new Date(Date.now() - i * 3600 * 1000);
      const key = d.toISOString().slice(0, 13); // YYYY-MM-DDTHH
      buckets[key] = { calls: 0, cost_usd: 0 };
    }
    for (const row of data || []) {
      const key = String(row.created_at).slice(0, 13);
      if (buckets[key]) {
        buckets[key].calls += 1;
        buckets[key].cost_usd += Number(row.cost_usd || 0);
      }
    }
    return Object.entries(buckets).map(([hour, v]) => ({ hour, ...v }));
  }
}
