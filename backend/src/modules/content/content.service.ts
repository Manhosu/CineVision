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
    const queryBuilder = this.contentRepository.createQueryBuilder('content')
      .where('content.status = :status', { status: ContentStatus.PUBLISHED })
      .leftJoinAndSelect('content.categories', 'categories')
      .leftJoinAndSelect('content.languages', 'languages');

    if (genre) {
      queryBuilder.andWhere('categories.name = :genre', { genre });
    }

    if (search && search.trim()) {
      queryBuilder.andWhere('LOWER(content.title) LIKE LOWER(:search)', {
        search: `%${search.trim()}%`
      });
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

  async findAllSeries(page = 1, limit = 20, genre?: string, sort = 'created_at', search?: string) {
    const queryBuilder = this.contentRepository.createQueryBuilder('content')
      .where('content.status = :status', { status: ContentStatus.PUBLISHED })
      .andWhere('content.content_type = :type', { type: 'series' })
      .leftJoinAndSelect('content.categories', 'categories')
      .leftJoinAndSelect('content.languages', 'languages');

    if (genre) {
      queryBuilder.andWhere('categories.name = :genre', { genre });
    }

    if (search && search.trim()) {
      queryBuilder.andWhere('LOWER(content.title) LIKE LOWER(:search)', {
        search: `%${search.trim()}%`
      });
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
}