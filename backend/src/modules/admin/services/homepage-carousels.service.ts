import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../../config/supabase.service';

export interface HomepageCarousel {
  id: string;
  slug: string;
  title: string;
  type: string;
  category_id: string | null;
  content_ids: string[];
  is_visible: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface UpdateCarouselDto {
  title?: string;
  is_visible?: boolean;
  display_order?: number;
  content_ids?: string[];
  category_id?: string | null;
}

export interface CreateCarouselDto {
  slug: string;
  title: string;
  category_id?: string | null;
  content_ids?: string[];
  is_visible?: boolean;
  display_order?: number;
}

export interface ReorderItem {
  id: string;
  display_order: number;
}

@Injectable()
export class HomepageCarouselsService {
  private readonly logger = new Logger(HomepageCarouselsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll(): Promise<HomepageCarousel[]> {
    const { data, error } = await this.supabaseService.client
      .from('homepage_carousels')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      this.logger.error('Failed to fetch homepage carousels:', error);
      throw new Error(`Failed to fetch homepage carousels: ${error.message}`);
    }

    return data || [];
  }

  async findVisible(): Promise<HomepageCarousel[]> {
    const { data, error } = await this.supabaseService.client
      .from('homepage_carousels')
      .select('*')
      .eq('is_visible', true)
      .order('display_order', { ascending: true });

    if (error) {
      this.logger.error('Failed to fetch visible homepage carousels:', error);
      throw new Error(`Failed to fetch visible homepage carousels: ${error.message}`);
    }

    return data || [];
  }

  async update(id: string, dto: UpdateCarouselDto): Promise<HomepageCarousel> {
    const updates: Partial<HomepageCarousel> & { updated_at: string } = {
      updated_at: new Date().toISOString(),
    };

    if (dto.title !== undefined) updates.title = dto.title;
    if (dto.is_visible !== undefined) updates.is_visible = dto.is_visible;
    if (dto.display_order !== undefined) updates.display_order = dto.display_order;
    if (dto.content_ids !== undefined) updates.content_ids = dto.content_ids;
    if (dto.category_id !== undefined) updates.category_id = dto.category_id;

    const { data, error } = await this.supabaseService.client
      .from('homepage_carousels')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to update carousel ${id}:`, error);
      throw new Error(`Failed to update carousel: ${error.message}`);
    }

    if (!data) {
      throw new NotFoundException(`Carousel with id ${id} not found`);
    }

    return data;
  }

  async create(dto: CreateCarouselDto): Promise<HomepageCarousel> {
    const payload = {
      slug: dto.slug,
      title: dto.title,
      type: 'manual' as const,
      category_id: dto.category_id ?? null,
      content_ids: dto.content_ids ?? [],
      is_visible: dto.is_visible ?? true,
      display_order: dto.display_order ?? 0,
    };

    const { data, error } = await this.supabaseService.client
      .from('homepage_carousels')
      .insert(payload)
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to create carousel:', error);
      throw new Error(`Failed to create carousel: ${error.message}`);
    }

    return data;
  }

  async delete(id: string): Promise<void> {
    // Only manual carousels may be deleted
    const { data: carousel, error: fetchError } = await this.supabaseService.client
      .from('homepage_carousels')
      .select('type')
      .eq('id', id)
      .single();

    if (fetchError || !carousel) {
      throw new NotFoundException(`Carousel with id ${id} not found`);
    }

    if (carousel.type !== 'manual') {
      throw new BadRequestException('Only manual carousels can be deleted');
    }

    const { error } = await this.supabaseService.client
      .from('homepage_carousels')
      .delete()
      .eq('id', id);

    if (error) {
      this.logger.error(`Failed to delete carousel ${id}:`, error);
      throw new Error(`Failed to delete carousel: ${error.message}`);
    }
  }

  // Igor (12/05): carrosséis cujo conteúdo é manualmente curado pelo admin.
  // Os "auto" (top10_films, top10_series, releases, all_movies, all_series,
  // category) ignoram content_ids[] e populam por regras — não faz sentido
  // mostrar pro admin durante create/edit de conteúdo.
  private readonly MANUAL_CAROUSEL_TYPES = new Set(['featured', 'manual']);

  /**
   * Retorna os carrosséis em que o admin pode inserir conteúdos manualmente
   * (featured = banner hero; manual = qualquer um criado pelo admin).
   * Usado no formulário de create/edit de conteúdo.
   */
  async findEligibleForManualInsertion(): Promise<HomepageCarousel[]> {
    const { data, error } = await this.supabaseService.client
      .from('homepage_carousels')
      .select('*')
      .in('type', Array.from(this.MANUAL_CAROUSEL_TYPES))
      .order('display_order', { ascending: true });

    if (error) {
      this.logger.error('Failed to fetch eligible carousels:', error);
      throw new Error(`Failed to fetch eligible carousels: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Retorna os IDs dos carrosséis em que um conteúdo específico aparece.
   * Usado para pré-selecionar checkboxes no edit.
   */
  async findCarouselsContaining(contentId: string): Promise<string[]> {
    const { data, error } = await this.supabaseService.client
      .from('homepage_carousels')
      .select('id, content_ids, type')
      .in('type', Array.from(this.MANUAL_CAROUSEL_TYPES));

    if (error) {
      this.logger.error('Failed to fetch carousels containing content:', error);
      throw new Error(`Failed to fetch carousels: ${error.message}`);
    }

    return (data || [])
      .filter((c: any) => Array.isArray(c.content_ids) && c.content_ids.includes(contentId))
      .map((c: any) => c.id);
  }

  /**
   * Sincroniza atomicamente os carrosséis em que um conteúdo aparece:
   * adiciona ao content_ids[] dos carrosséis em targetCarouselIds e remove
   * dos demais (entre os elegíveis para inserção manual).
   *
   * Race-safe: faz um SELECT antes de cada UPDATE para garantir que não
   * sobrescreve content_ids[] em paralelo.
   */
  async syncContentToCarousels(contentId: string, targetCarouselIds: string[]): Promise<void> {
    const target = new Set(targetCarouselIds);
    const eligible = await this.findEligibleForManualInsertion();

    for (const carousel of eligible) {
      const currentIds: string[] = Array.isArray(carousel.content_ids) ? carousel.content_ids : [];
      const hasIt = currentIds.includes(contentId);
      const shouldHaveIt = target.has(carousel.id);

      if (hasIt === shouldHaveIt) continue; // sem mudança

      const newIds = shouldHaveIt
        ? [...currentIds, contentId] // adiciona no fim
        : currentIds.filter((id) => id !== contentId);

      const { error } = await this.supabaseService.client
        .from('homepage_carousels')
        .update({ content_ids: newIds, updated_at: new Date().toISOString() })
        .eq('id', carousel.id);

      if (error) {
        this.logger.error(
          `Failed to sync content ${contentId} to carousel ${carousel.id}: ${error.message}`,
        );
        throw new Error(`Falha ao sincronizar carrossel: ${error.message}`);
      }
    }
  }

  async reorder(items: ReorderItem[]): Promise<void> {
    if (!items || items.length === 0) return;

    const updates = items.map(({ id, display_order }) =>
      this.supabaseService.client
        .from('homepage_carousels')
        .update({ display_order, updated_at: new Date().toISOString() })
        .eq('id', id),
    );

    const results = await Promise.all(updates);

    for (const result of results) {
      if (result.error) {
        this.logger.error('Failed to reorder carousels:', result.error);
        throw new Error(`Failed to reorder carousels: ${result.error.message}`);
      }
    }
  }
}
