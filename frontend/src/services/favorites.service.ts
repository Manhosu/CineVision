const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface Favorite {
  id: string;
  user_id: string;
  content_id: string;
  created_at: string;
  content?: any;
}

class FavoritesService {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Include cookies for auth
      ...options,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return null as T;
      }

      return await response.json();
    } catch (error) {
      console.error(`Favorites API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  /**
   * Get all user favorites
   */
  async getUserFavorites(): Promise<Favorite[]> {
    return this.request<Favorite[]>('/api/v1/favorites');
  }

  /**
   * Add content to favorites
   */
  async addFavorite(contentId: string): Promise<Favorite> {
    return this.request<Favorite>('/api/v1/favorites', {
      method: 'POST',
      body: JSON.stringify({ content_id: contentId }),
    });
  }

  /**
   * Remove content from favorites
   */
  async removeFavorite(contentId: string): Promise<void> {
    return this.request<void>(`/api/v1/favorites/${contentId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Check if content is favorited
   */
  async checkFavorite(contentId: string): Promise<{ isFavorite: boolean }> {
    return this.request<{ isFavorite: boolean }>(`/api/v1/favorites/check/${contentId}`);
  }
}

export const favoritesService = new FavoritesService(API_BASE_URL);
export default favoritesService;
