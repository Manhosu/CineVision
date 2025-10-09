import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../../config/supabase.service';
import { FavoriteResponseDto } from '../dto/favorite.dto';

@Injectable()
export class FavoritesSupabaseService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Get all favorites for a user
   */
  async getUserFavorites(userId: string): Promise<FavoriteResponseDto[]> {
    const client = this.supabase.client;

    // Set the user_id for RLS
    await client.rpc('set_config', {
      setting: 'app.user_id',
      value: userId,
    });

    const { data, error } = await client
      .from('user_favorites')
      .select(`
        id,
        user_id,
        content_id,
        created_at,
        content:content_id (
          id,
          title,
          description,
          poster_url,
          thumbnail_url,
          backdrop_url,
          price_cents,
          genres,
          imdb_rating,
          release_year,
          duration_minutes,
          content_type
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`Failed to fetch favorites: ${error.message}`);
    }

    return data.map((favorite) => ({
      id: favorite.id,
      user_id: favorite.user_id,
      content_id: favorite.content_id,
      created_at: favorite.created_at,
      content: favorite.content,
    }));
  }

  /**
   * Add content to favorites
   */
  async addFavorite(userId: string, contentId: string): Promise<FavoriteResponseDto> {
    const client = this.supabase.client;

    // Check if content exists
    const { data: content, error: contentError } = await client
      .from('content')
      .select('id, title, description, poster_url, thumbnail_url, backdrop_url, price_cents, genres, imdb_rating, release_year, duration_minutes, content_type')
      .eq('id', contentId)
      .single();

    if (contentError || !content) {
      throw new NotFoundException(`Content with ID ${contentId} not found`);
    }

    // Check if already favorited
    const { data: existing } = await client
      .from('user_favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .single();

    if (existing) {
      throw new BadRequestException('Content already in favorites');
    }

    // Set the user_id for RLS
    await client.rpc('set_config', {
      setting: 'app.user_id',
      value: userId,
    });

    // Add to favorites
    const { data: favorite, error: insertError } = await client
      .from('user_favorites')
      .insert({
        user_id: userId,
        content_id: contentId,
      })
      .select()
      .single();

    if (insertError) {
      throw new BadRequestException(`Failed to add favorite: ${insertError.message}`);
    }

    return {
      id: favorite.id,
      user_id: favorite.user_id,
      content_id: favorite.content_id,
      created_at: favorite.created_at,
      content,
    };
  }

  /**
   * Remove content from favorites
   */
  async removeFavorite(userId: string, contentId: string): Promise<void> {
    const client = this.supabase.client;

    // Set the user_id for RLS
    await client.rpc('set_config', {
      setting: 'app.user_id',
      value: userId,
    });

    const { error } = await client
      .from('user_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('content_id', contentId);

    if (error) {
      throw new NotFoundException(`Failed to remove favorite: ${error.message}`);
    }
  }

  /**
   * Check if content is favorited by user
   */
  async isFavorite(userId: string, contentId: string): Promise<boolean> {
    const client = this.supabase.client;

    const { data, error } = await client
      .from('user_favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is expected
      throw new BadRequestException(`Failed to check favorite status: ${error.message}`);
    }

    return !!data;
  }
}
