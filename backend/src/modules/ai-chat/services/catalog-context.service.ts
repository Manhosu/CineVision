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
   * Search for content relevant to a user query. Simple keyword-based search.
   * Returns top K hits with key metadata for prompt injection.
   */
  async searchRelevant(query: string, limit = 8): Promise<CatalogHit[]> {
    const term = (query || '').trim();
    if (!term) return [];

    // Tokenize: split into words, remove stopwords / chat noise.
    const stopwords = new Set([
      'o','a','os','as','um','uma','de','do','da','dos','das','para','por','com','em','no','na','que','e','ou','meu','minha','quero','queria','seu','sua','tem','ter','ai','aí','aqui','vc','voce','você','boa','bom','bonito','boas','noite','tarde','dia','filme','filmes','serie','series','série','séries','comprar','compra','quanto','custa','tudo','nao','não','sim','algum','alguma','assistir','novo','nova','pode','pra','para','este','esta','esse','essa','isso','aquele','aquela','assim','agora','tambem','também','tipo','beleza','obrigado','obrigada','valeu','sobre','show','legal','qual','quais','quanto','quanta','onde','quando','como','porque','por que','preço','preco','valor','custo','dinheiro','reais','real','disponivel','disponível','tem','tinha','seria','poderia','gostaria','queria','olá','ola','oi','hello','tudo','bem','blz','kkk','hahaha'
    ]);
    const tokens = term
      .toLowerCase()
      .replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !stopwords.has(t));

    if (!tokens.length) {
      // fall back: search the original term verbatim against title only
      const { data } = await this.supabase.client
        .from('content')
        .select('id, title, price_cents, release_year, content_type, genres, poster_url, status')
        .eq('status', 'PUBLISHED')
        .ilike('title', `%${term}%`)
        .limit(limit);
      return this.mapHits(data);
    }

    // PASS 1 — search title only (high precision)
    const seen = new Map<string, any>();
    for (const token of tokens) {
      const escaped = token.replace(/[%_]/g, ' ');
      const { data } = await this.supabase.client
        .from('content')
        .select('id, title, price_cents, release_year, content_type, genres, poster_url, status')
        .eq('status', 'PUBLISHED')
        .ilike('title', `%${escaped}%`)
        .limit(limit);
      for (const row of data || []) {
        if (!seen.has(row.id)) seen.set(row.id, row);
        if (seen.size >= limit) break;
      }
      if (seen.size >= limit) break;
    }

    // PASS 2 — if no title hit, try description/synopsis
    if (!seen.size) {
      for (const token of tokens) {
        const escaped = token.replace(/[%_]/g, ' ');
        const { data } = await this.supabase.client
          .from('content')
          .select('id, title, price_cents, release_year, content_type, genres, poster_url, status')
          .eq('status', 'PUBLISHED')
          .or(`description.ilike.%${escaped}%,synopsis.ilike.%${escaped}%`)
          .limit(limit);
        for (const row of data || []) {
          if (!seen.has(row.id)) seen.set(row.id, row);
          if (seen.size >= limit) break;
        }
        if (seen.size >= limit) break;
      }
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
