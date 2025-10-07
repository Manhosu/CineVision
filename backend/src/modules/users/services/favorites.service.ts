import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserFavorite } from '../entities/user-favorite.entity';
import { Content, ContentStatus } from '../../content/entities/content.entity';
import { User } from '../entities/user.entity';
import { FavoriteResponseDto } from '../dto/favorite.dto';

@Injectable()
export class FavoritesService {
  private readonly logger = new Logger(FavoritesService.name);

  constructor(
    @InjectRepository(UserFavorite)
    private favoriteRepository: Repository<UserFavorite>,
    @InjectRepository(Content)
    private contentRepository: Repository<Content>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Get all favorites for a user
   */
  async getUserFavorites(userId: string): Promise<FavoriteResponseDto[]> {
    const favorites = await this.favoriteRepository.find({
      where: { user_id: userId },
      relations: ['content', 'content.categories'],
      order: { created_at: 'DESC' },
    });

    return favorites.map(fav => ({
      id: fav.id,
      user_id: fav.user_id,
      content_id: fav.content_id,
      created_at: fav.created_at,
      content: fav.content,
    }));
  }

  /**
   * Add content to user favorites
   */
  async addFavorite(userId: string, contentId: string): Promise<FavoriteResponseDto> {
    // Check if user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if content exists and is published
    const content = await this.contentRepository.findOne({
      where: { id: contentId },
      relations: ['categories'],
    });

    if (!content) {
      throw new NotFoundException('Content not found');
    }

    if (content.status !== ContentStatus.PUBLISHED) {
      throw new BadRequestException('Cannot favorite unpublished content');
    }

    // Check if already favorited
    const existing = await this.favoriteRepository.findOne({
      where: {
        user_id: userId,
        content_id: contentId,
      },
    });

    if (existing) {
      throw new BadRequestException('Content already in favorites');
    }

    // Create favorite
    const favorite = this.favoriteRepository.create({
      user_id: userId,
      content_id: contentId,
    });

    const saved = await this.favoriteRepository.save(favorite);

    this.logger.log(`User ${userId} added content ${contentId} to favorites`);

    return {
      id: saved.id,
      user_id: saved.user_id,
      content_id: saved.content_id,
      created_at: saved.created_at,
      content: content,
    };
  }

  /**
   * Remove content from user favorites
   */
  async removeFavorite(userId: string, contentId: string): Promise<void> {
    const favorite = await this.favoriteRepository.findOne({
      where: {
        user_id: userId,
        content_id: contentId,
      },
    });

    if (!favorite) {
      throw new NotFoundException('Favorite not found');
    }

    await this.favoriteRepository.remove(favorite);

    this.logger.log(`User ${userId} removed content ${contentId} from favorites`);
  }

  /**
   * Check if content is in user favorites
   */
  async isFavorite(userId: string, contentId: string): Promise<boolean> {
    const count = await this.favoriteRepository.count({
      where: {
        user_id: userId,
        content_id: contentId,
      },
    });

    return count > 0;
  }

  /**
   * Get favorite count for content
   */
  async getFavoriteCount(contentId: string): Promise<number> {
    return this.favoriteRepository.count({
      where: { content_id: contentId },
    });
  }

  /**
   * Get total favorites for user
   */
  async getUserFavoriteCount(userId: string): Promise<number> {
    return this.favoriteRepository.count({
      where: { user_id: userId },
    });
  }
}
