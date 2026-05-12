import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Content, ContentStatus, ContentType } from './entities/content.entity';
import { Category } from './entities/category.entity';

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(Content)
    private contentRepository: Repository<Content>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  async findAllMovies(page = 1, limit = 20, genre?: string, sort = 'created_at', search?: string) {
    // Igor reportou que sagas (Harry Potter, Velozes & Furiosos) eram
    // cortadas com o limite de 20. Permite até 100 por chamada — suficiente
    // pra qualquer franquia, e o frontend pagina se precisar de mais.
    limit = Math.min(Math.max(limit, 1), 100);

    // N11 (Igor 04/05): se há search, baixamos todos publicados e filtramos
    // por título normalizado (NFD + strip diacritics) em JS — assim
    // "diario" acha "Diário", "mae" acha "Mãe". O Postgres aqui não tem
    // unaccent disponível em todos os deploys e LOWER+LIKE é ASCII-only.
    if (search && search.trim()) {
      return this.searchMoviesAccentInsensitive(search, page, limit, genre, sort);
    }

    const queryBuilder = this.contentRepository.createQueryBuilder('content')
      .where('content.status = :status', { status: ContentStatus.PUBLISHED })
      .leftJoinAndSelect('content.categories', 'categories')
      .leftJoinAndSelect('content.languages', 'languages');

    if (genre) {
      queryBuilder.andWhere('categories.name = :genre', { genre });
    }

    switch (sort) {
      case 'newest':
        queryBuilder.orderBy('content.created_at', 'DESC');
        break;
      case 'popular':
        queryBuilder.orderBy('content.views_count', 'DESC');
        break;
      case 'rating':
        queryBuilder.orderBy('content.imdb_rating', 'DESC');
        break;
      case 'price_low':
        queryBuilder.orderBy('content.price_cents', 'ASC');
        break;
      case 'price_high':
        queryBuilder.orderBy('content.price_cents', 'DESC');
        break;
      default:
        queryBuilder.orderBy('content.created_at', 'DESC');
    }

    const [movies, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      movies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  /**
   * N11 — busca acento-insensível em JS. Carrega até 500 publicados
   * (catálogo atual ~258), normaliza title+description via NFD+strip,
   * filtra. Pagina o resultado in-memory.
   */
  private async searchMoviesAccentInsensitive(
    search: string,
    page: number,
    limit: number,
    genre: string | undefined,
    sort: string,
  ) {
    const qb = this.contentRepository.createQueryBuilder('content')
      .where('content.status = :status', { status: ContentStatus.PUBLISHED })
      .andWhere('content.content_type = :type', { type: 'movie' })
      .leftJoinAndSelect('content.categories', 'categories')
      .leftJoinAndSelect('content.languages', 'languages')
      .take(500);

    if (genre) qb.andWhere('categories.name = :genre', { genre });

    const all = await qb.getMany();
    console.log(`[N11] Loaded ${all.length} movies for accent-insensitive search of "${search}"`);

    // [̀-ͯ] = bloco "Combining Diacritical Marks". Escape
    // Unicode explícito (não depende da codificação do source).
    const normalize = (s: string) =>
      (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const q = normalize(search.trim());
    console.log(`[N11] Normalized query "${search}" → "${q}"`);

    const filtered = all.filter((m) => {
      return normalize(m.title || '').includes(q)
        || normalize((m as any).description || '').includes(q);
    });
    console.log(`[N11] Filtered to ${filtered.length} matches`);

    // Sort in memory
    const sorted = [...filtered];
    switch (sort) {
      case 'newest':
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'popular':
        sorted.sort((a, b) => ((b as any).views_count || 0) - ((a as any).views_count || 0));
        break;
      case 'rating':
        sorted.sort((a, b) => ((b as any).imdb_rating || 0) - ((a as any).imdb_rating || 0));
        break;
      case 'price_low':
        sorted.sort((a, b) => ((a as any).price_cents || 0) - ((b as any).price_cents || 0));
        break;
      case 'price_high':
        sorted.sort((a, b) => ((b as any).price_cents || 0) - ((a as any).price_cents || 0));
        break;
      default:
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    const total = sorted.length;
    const offset = (page - 1) * limit;
    const movies = sorted.slice(offset, offset + limit);

    return {
      movies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  async findAllSeries(page = 1, limit = 20, genre?: string, sort = 'created_at', search?: string) {
    limit = Math.min(Math.max(limit, 1), 100);

    // N11 — mesma lógica do findAllMovies pra séries.
    if (search && search.trim()) {
      return this.searchSeriesAccentInsensitive(search, page, limit, genre, sort);
    }

    const queryBuilder = this.contentRepository.createQueryBuilder('content')
      .where('content.status = :status', { status: ContentStatus.PUBLISHED })
      .andWhere('content.content_type = :type', { type: 'series' })
      .leftJoinAndSelect('content.categories', 'categories')
      .leftJoinAndSelect('content.languages', 'languages');

    if (genre) {
      queryBuilder.andWhere('categories.name = :genre', { genre });
    }

    switch (sort) {
      case 'newest':
        queryBuilder.orderBy('content.created_at', 'DESC');
        break;
      case 'popular':
        queryBuilder.orderBy('content.views_count', 'DESC');
        break;
      case 'rating':
        queryBuilder.orderBy('content.imdb_rating', 'DESC');
        break;
      case 'price_low':
        queryBuilder.orderBy('content.price_cents', 'ASC');
        break;
      case 'price_high':
        queryBuilder.orderBy('content.price_cents', 'DESC');
        break;
      default:
        queryBuilder.orderBy('content.created_at', 'DESC');
    }

    const [series, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      movies: series, // Keep the same property name for compatibility with frontend
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  /**
   * N11 — busca acento-insensível pra séries.
   */
  private async searchSeriesAccentInsensitive(
    search: string,
    page: number,
    limit: number,
    genre: string | undefined,
    sort: string,
  ) {
    const qb = this.contentRepository.createQueryBuilder('content')
      .where('content.status = :status', { status: ContentStatus.PUBLISHED })
      .andWhere('content.content_type = :type', { type: 'series' })
      .leftJoinAndSelect('content.categories', 'categories')
      .leftJoinAndSelect('content.languages', 'languages')
      .take(500);

    if (genre) qb.andWhere('categories.name = :genre', { genre });

    const all = await qb.getMany();

    const normalize = (s: string) =>
      (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const q = normalize(search.trim());

    const filtered = all.filter((m) => {
      return normalize(m.title || '').includes(q)
        || normalize((m as any).description || '').includes(q);
    });

    const sorted = [...filtered];
    switch (sort) {
      case 'newest':
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'popular':
        sorted.sort((a, b) => ((b as any).views_count || 0) - ((a as any).views_count || 0));
        break;
      case 'rating':
        sorted.sort((a, b) => ((b as any).imdb_rating || 0) - ((a as any).imdb_rating || 0));
        break;
      default:
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    const total = sorted.length;
    const offset = (page - 1) * limit;
    const series = sorted.slice(offset, offset + limit);

    return {
      movies: series, // mesmo formato pro frontend
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  async findMovieById(id: string) {
    const movie = await this.contentRepository.findOne({
      where: { id, status: ContentStatus.PUBLISHED },
      relations: ['categories', 'languages'],
    });

    if (!movie) {
      throw new NotFoundException('Movie not found');
    }

    return movie;
  }

  async findSeriesById(id: string) {
    const series = await this.contentRepository.findOne({
      where: { id, status: ContentStatus.PUBLISHED },
      relations: ['categories', 'languages'],
    });

    if (!series) {
      throw new NotFoundException('Series not found');
    }

    return series;
  }

  async findRelatedMovies(movieId: string, genres: string[] = [], limit = 6) {
    const queryBuilder = this.contentRepository.createQueryBuilder('content')
      .leftJoinAndSelect('content.categories', 'categories')
      .where('content.status = :status', { status: ContentStatus.PUBLISHED })
      .andWhere('content.id != :movieId', { movieId });

    if (genres.length > 0) {
      queryBuilder.andWhere('categories.name IN (:...genres)', { genres });
    }

    const relatedMovies = await queryBuilder
      .orderBy('RANDOM()')
      .take(limit)
      .getMany();

    return relatedMovies;
  }

  async findSeriesEpisodes(seriesId: string, season?: number) {
    // First check if series exists
    const series = await this.contentRepository.findOne({
      where: { id: seriesId, status: ContentStatus.PUBLISHED },
    });

    if (!series) {
      throw new NotFoundException('Series not found');
    }

    // Query episodes from the episodes table
    const query = `
      SELECT
        id,
        series_id,
        season_number,
        episode_number,
        title,
        description,
        thumbnail_url,
        video_url,
        duration_minutes,
        storage_path,
        file_storage_key,
        processing_status,
        available_qualities,
        views_count,
        created_at,
        updated_at
      FROM episodes
      WHERE series_id = $1
      ${season ? 'AND season_number = $2' : ''}
      ORDER BY season_number ASC, episode_number ASC
    `;

    const params = season ? [seriesId, season] : [seriesId];
    const episodes = await this.contentRepository.query(query, params);

    return episodes;
  }

  async findAllCategories() {
    return this.categoryRepository.find({
      order: { name: 'ASC' },
    });
  }

  async findAllContent() {
    return this.contentRepository.find({
      relations: ['categories'],
      where: { status: ContentStatus.PUBLISHED },
      order: { created_at: 'DESC' },
    });
  }

  async findTop10Films() {
    const results = await this.contentRepository
      .createQueryBuilder('content')
      .where('content.status = :status', { status: ContentStatus.PUBLISHED })
      .andWhere("content.content_type = :type", { type: 'movie' })
      .orderBy('content.weekly_sales', 'DESC') // Prioriza vendas semanais
      .addOrderBy('content.views_count', 'DESC') // Depois visualizações
      .addOrderBy('content.created_at', 'DESC') // Por último, mais recentes
      .take(10)
      .getMany();

    return results;
  }

  async findTop10Series() {
    const results = await this.contentRepository
      .createQueryBuilder('content')
      .where('content.status = :status', { status: ContentStatus.PUBLISHED })
      .andWhere("content.content_type = :type", { type: 'series' })
      .orderBy('content.weekly_sales', 'DESC') // Prioriza vendas semanais
      .addOrderBy('content.views_count', 'DESC') // Depois visualizações
      .addOrderBy('content.created_at', 'DESC') // Por último, mais recentes
      .take(10)
      .getMany();

    return results;
  }

  async findFeaturedContent(limit = 10) {
    const results = await this.contentRepository
      .createQueryBuilder('content')
      .where('content.status = :status', { status: ContentStatus.PUBLISHED })
      .andWhere('content.is_featured = :featured', { featured: true })
      .leftJoinAndSelect('content.categories', 'categories')
      .leftJoinAndSelect('content.languages', 'languages')
      .orderBy('content.created_at', 'DESC')
      .take(limit)
      .getMany();

    return results;
  }

  async findReleases(limit = 20) {
    console.log('[ContentService] findReleases called with limit:', limit);
    const results = await this.contentRepository
      .createQueryBuilder('content')
      .where('content.status = :status', { status: ContentStatus.PUBLISHED })
      .andWhere('content.is_release = :isRelease', { isRelease: true })
      .leftJoinAndSelect('content.categories', 'categories')
      .leftJoinAndSelect('content.languages', 'languages')
      .orderBy('content.created_at', 'DESC')
      .take(limit)
      .getMany();

    console.log('[ContentService] findReleases returned', results.length, 'items');
    return results;
  }

  async deleteAllMovies() {
    try {
      const result = await this.contentRepository
        .createQueryBuilder()
        .delete()
        .from(Content)
        .where("content_type = :type", { type: ContentType.MOVIE })
        .execute();

      return {
        success: true,
        deletedCount: result.affected || 0,
        deletedMovies: []
      };
    } catch (error) {
      throw error;
    }
  }

  async deleteAllContent() {
    try {
      const result = await this.contentRepository
        .createQueryBuilder()
        .delete()
        .from(Content)
        .execute();

      return {
        success: true,
        deletedCount: result.affected || 0,
        deletedContent: []
      };
    } catch (error) {
      throw error;
    }
  }

  async findPersonWithContent(personId: string): Promise<any> {
    throw new NotFoundException('People feature requires Supabase mode');
  }

  async getHomepageData(): Promise<Array<{ id: string; slug: string; title: string; type: string; content: any[] }>> {
    throw new NotFoundException('Homepage carousel config requires Supabase mode');
  }
}