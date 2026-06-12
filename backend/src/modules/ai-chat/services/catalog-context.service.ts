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
  /** 'dubbed' | 'subtitled' | 'dubbed_subtitled' (Igor 18/05). */
  audio_type?: string;
  /** Sinopse curta pra IA responder sobre o enredo (Igor 18/05). */
  synopsis?: string;
  /** Título em inglês — vem de `title_en` (ou `title_secondary`). Igor (20/05). */
  title_en?: string;
  /** Qualidade do vídeo (ex: "1080p", "4K"). Igor (21/05). */
  quality_label?: string;
}

/** audio_type → texto amigável que a IA usa pra responder "tá dublado?". */
const AUDIO_LABEL: Record<string, string> = {
  dubbed: 'Dublado',
  subtitled: 'Legendado',
  dubbed_subtitled: 'Dublado e Legendado',
};

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
    const hits = await this.searchRaw(term, limit);
    return this.enrichHits(hits);
  }

  /**
   * Igor (18/05): a IA não respondia "tá dublado?" nem sobre o enredo
   * porque o catálogo mandado pra ela só tinha título/ano/preço. Aqui
   * puxamos `audio_type` e `synopsis` direto da tabela `content` pelos
   * IDs das hits (uma query leve, sem tocar na RPC search_content que
   * também serve a busca pública). Falha aqui não derruba a busca.
   */
  private async enrichHits(hits: CatalogHit[]): Promise<CatalogHit[]> {
    if (!hits.length) return hits;
    try {
      const ids = hits.map((h) => h.id).filter(Boolean);

      // N24 (Igor 07/06): busca content_languages em paralelo com content
      // para derivar audio_type a partir das versões realmente cadastradas.
      // content.audio_type pode estar desatualizado (ex: filme tem versão
      // dublada adicionada depois mas o campo não foi sincronizado).
      const [{ data: contentData }, { data: langData }] = await Promise.all([
        this.supabase.client
          .from('content')
          .select('id, audio_type, synopsis, description, title_en, title_secondary, quality_label')
          .in('id', ids),
        this.supabase.client
          .from('content_languages')
          .select('content_id, language_type')
          .in('content_id', ids)
          .eq('is_active', true),
      ]);

      // Agrupa content_languages por content_id
      const langsByContentId = new Map<string, Set<string>>();
      for (const lang of langData || []) {
        if (!langsByContentId.has(lang.content_id)) {
          langsByContentId.set(lang.content_id, new Set());
        }
        langsByContentId.get(lang.content_id)!.add(lang.language_type);
      }

      const byId = new Map((contentData || []).map((d: any) => [d.id, d]));

      return hits.map((h) => {
        const d = byId.get(h.id);
        if (!d) return h;

        // Deriva audio_type a partir de content_languages (fonte mais confiável)
        let derivedAudioType: string | undefined;
        const langs = langsByContentId.get(h.id);
        if (langs && langs.size > 0) {
          const hasDubbed = langs.has('dubbed');
          const hasSubtitled = langs.has('subtitled');
          if (hasDubbed && hasSubtitled) derivedAudioType = 'dubbed_subtitled';
          else if (hasDubbed) derivedAudioType = 'dubbed';
          else if (hasSubtitled) derivedAudioType = 'subtitled';
        }

        return {
          ...h,
          // Prioridade: content_languages > content.audio_type > undefined
          audio_type: derivedAudioType || d.audio_type || undefined,
          synopsis: (d.synopsis || d.description || '').trim() || undefined,
          title_en: h.title_en || d.title_en || d.title_secondary || undefined,
          quality_label: d.quality_label || undefined,
        };
      });
    } catch (err: any) {
      this.logger.warn(`enrichHits failed: ${err.message}`);
      return hits;
    }
  }

  /**
   * Busca crua: roda a RPC `search_content` (cobre `title` + `description`
   * com unaccent/trigram/full-text) E a busca ILIKE (cobre `title_en` e
   * `title_secondary` — onde mora o título em inglês) em PARALELO, e faz
   * merge deduplicando por id.
   *
   * Igor (20/05): a IA não achava a série "Você" quando o cliente pedia
   * "You" — a RPC só busca em `title`/`description`, e "You" está em
   * `title_en` (210 dos 522 conteúdos têm). Rodar o ILIKE em paralelo
   * (não só como reserva) garante que título em inglês entre nas hits.
   */
  private async searchRaw(term: string, limit: number): Promise<CatalogHit[]> {
    const [rpcHits, altHits] = await Promise.all([
      this.searchViaRpc(term, limit),
      this.searchRelevantFallback(term, limit),
    ]);
    const seen = new Set<string>();
    const out: CatalogHit[] = [];
    for (const h of [...rpcHits, ...altHits]) {
      if (h.id && !seen.has(h.id)) {
        seen.add(h.id);
        out.push(h);
        if (out.length >= limit) break;
      }
    }
    return out;
  }

  /** Wrapper da RPC `search_content` (title + description, unaccent/trigram). */
  private async searchViaRpc(term: string, limit: number): Promise<CatalogHit[]> {
    try {
      const { data, error } = await this.supabase.client.rpc('search_content', {
        search_query: term,
        content_type_filter: null,
        result_limit: limit,
        result_offset: 0,
      });
      if (error) {
        this.logger.warn(`search_content RPC failed for "${term}": ${error.message}`);
        return [];
      }
      return Array.isArray(data) ? this.mapHits(data) : [];
    } catch (err: any) {
      this.logger.warn(`search_content RPC threw for "${term}": ${err.message}`);
      return [];
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

    const select = 'id, title, title_secondary, title_en, price_cents, release_year, content_type, genres, poster_url, status';

    if (!tokens.length) {
      const { data } = await this.supabase.client
        .from('content')
        .select(select)
        .eq('status', 'PUBLISHED')
        .or(`title.ilike.%${term}%,title_secondary.ilike.%${term}%,title_en.ilike.%${term}%`)
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
        .or(`title.ilike.%${escaped}%,title_secondary.ilike.%${escaped}%,title_en.ilike.%${escaped}%`)
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
      title_en: d.title_en || d.title_secondary || undefined,
    }));
  }

  formatHitsForPrompt(hits: CatalogHit[]): string {
    if (!hits.length) return 'CATÁLOGO: (nenhum filme encontrado para este termo)';

    const lines = hits.map((h) => {
      const price = (h.price_cents / 100).toFixed(2).replace('.', ',');
      const year = h.release_year ? ` (${h.release_year})` : '';
      const enTitle =
        h.title_en && h.title_en.toLowerCase() !== (h.title || '').toLowerCase()
          ? ` | inglês: ${h.title_en}`
          : '';
      const audio = h.audio_type
        ? ` | Áudio: ${AUDIO_LABEL[h.audio_type] || h.audio_type}`
        : '';
      const quality = h.quality_label ? ` | Qualidade: ${h.quality_label}` : '';
      const synopsis = h.synopsis
        ? `\n    Sinopse: ${h.synopsis.slice(0, 120)}${h.synopsis.length > 120 ? '…' : ''}`
        : '';
      return `- ID=${h.id} | ${h.title}${year}${enTitle} | tipo=${h.type || 'filme'} | R$${price}${audio}${quality}${synopsis}`;
    });
    return `CATÁLOGO RELEVANTE:\n${lines.join('\n')}`;
  }
}
