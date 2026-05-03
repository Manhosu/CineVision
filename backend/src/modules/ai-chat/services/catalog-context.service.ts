import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../config/supabase.service';

export interface CatalogHit {
  id: string;
  title: string;
  price_cents: number;
  release_year?: number;
  type?: string;
  genres?: string;
  poster_url?: string;
}

@Injectable()
export class CatalogContextService {
  private readonly logger = new Logger(CatalogContextService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Search for content relevant to a user query.
   *
   * F2.8 (vídeo IMG_8806 + video (5)) — Igor reportou que IA não acha
   * filme quando cliente escreve sem acento ("diario" → não acha
   * "Diário") ou pelo título em inglês ("The Vampire Diaries" → não
   * acha "Diário de um Vampiro"). Antes desse fix, a busca era
   * tokenizada com `ilike` direto, sem unaccent e sem
   * `title_secondary`.
   *
   * Agora usamos a função SQL `search_content` (mesma que serve a
   * busca pública do site), que combina:
   *   - unaccent + similarity (trigram) — tolera erros de acento e
   *     pequenas variações ortográficas;
   *   - busca em `title` E `title_secondary` (alias em inglês) —
   *     resolve "Tendrama"/"The Drama" → "O Drama";
   *   - full-text search em português;
   *   - ranking ponderado.
   */
  async searchRelevant(query: string, limit = 8): Promise<CatalogHit[]> {
    const term = (query || '').trim();
    if (!term) return [];

    try {
      const { data, error } = await this.supabase.client.rpc('search_content', {
        search_query: term,
        content_type_filter: null,
        result_limit: limit,
        result_offset: 0,
      });

      if (error) {
        this.logger.warn(
          `search_content RPC failed for "${term}": ${error.message} — falling back to ILIKE`,
        );
        return this.searchRelevantFallback(term, limit);
      }

      if (Array.isArray(data) && data.length) {
        return this.mapHits(data);
      }

      // RPC retornou vazio. Antes de devolver "nada encontrado", tenta
      // o fallback ilike (cobre casos onde o conteúdo recém criado
      // não está no índice trigram ainda, raríssimo mas existe).
      return this.searchRelevantFallback(term, limit);
    } catch (err: any) {
      this.logger.warn(
        `search_content RPC threw for "${term}": ${err.message} — falling back to ILIKE`,
      );
      return this.searchRelevantFallback(term, limit);
    }
  }

  /**
   * Fallback simples por se a RPC falhar (function ainda não migrada
   * em algum ambiente). Mantém o comportamento antigo de tokenização
   * + ilike, mas com uma busca extra em `title_secondary`.
   */
  private async searchRelevantFallback(term: string, limit: number): Promise<CatalogHit[]> {
    const stopwords = new Set([
      'o','a','os','as','um','uma','de','do','da','dos','das','para','por','com','em','no','na','que','e','ou','meu','minha','quero','queria','seu','sua','tem','ter','ai','aí','aqui','vc','voce','você','boa','bom','bonito','boas','noite','tarde','dia','filme','filmes','serie','series','série','séries','comprar','compra','quanto','custa','tudo','nao','não','sim','algum','alguma','assistir','novo','nova','pode','pra','para','este','esta','esse','essa','isso','aquele','aquela','assim','agora','tambem','também','tipo','beleza','obrigado','obrigada','valeu','sobre','show','legal','qual','quais','quanto','quanta','onde','quando','como','porque','por que','preço','preco','valor','custo','dinheiro','reais','real','disponivel','disponível','tem','tinha','seria','poderia','gostaria','queria','olá','ola','oi','hello','tudo','bem','blz','kkk','hahaha'
    ]);
    const tokens = term
      .toLowerCase()
      .replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !stopwords.has(t));

    const select = 'id, title, title_secondary, price_cents, release_year, content_type, genres, poster_url, status';

    if (!tokens.length) {
      const { data } = await this.supabase.client
        .from('content')
        .select(select)
        .eq('status', 'PUBLISHED')
        .or(`title.ilike.%${term}%,title_secondary.ilike.%${term}%`)
        .limit(limit);
      return this.mapHits(data);
    }

    const seen = new Map<string, any>();
    for (const token of tokens) {
      const escaped = token.replace(/[%_]/g, ' ');
      const { data } = await this.supabase.client
        .from('content')
        .select(select)
        .eq('status', 'PUBLISHED')
        .or(`title.ilike.%${escaped}%,title_secondary.ilike.%${escaped}%`)
        .limit(limit);
      for (const row of data || []) {
        if (!seen.has(row.id)) seen.set(row.id, row);
        if (seen.size >= limit) break;
      }
      if (seen.size >= limit) break;
    }

    return this.mapHits(Array.from(seen.values()));
  }

  private mapHits(data: any[] | null | undefined): CatalogHit[] {
    return (data || []).map((d: any) => ({
      id: d.id,
      title: d.title,
      price_cents: d.price_cents,
      release_year: d.release_year,
      type: d.content_type,
      genres: d.genres,
      poster_url: d.poster_url,
    }));
  }

  formatHitsForPrompt(hits: CatalogHit[]): string {
    if (!hits.length) return 'CATÁLOGO: (nenhum filme encontrado para este termo)';

    const lines = hits.map((h) => {
      const price = (h.price_cents / 100).toFixed(2).replace('.', ',');
      const year = h.release_year ? ` (${h.release_year})` : '';
      return `- ID=${h.id} | ${h.title}${year} | tipo=${h.type || 'filme'} | R$${price}`;
    });
    return `CATÁLOGO RELEVANTE:\n${lines.join('\n')}`;
  }
}
