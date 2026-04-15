import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../config/supabase.service';

@Injectable()
export class AdminTop10Service {
  private readonly logger = new Logger(AdminTop10Service.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Get current top 10 content by type (movie or series)
   */
  async getCurrentTop10(type: 'movie' | 'series') {
    const { data, error } = await this.supabaseService.client
      .from('content')
      .select('id, title, thumbnail_url, poster_url, content_type, weekly_sales, views_count, price_cents, status')
      .eq('content_type', type)
      .order('weekly_sales', { ascending: false, nullsFirst: false })
      .order('views_count', { ascending: false })
      .limit(10);

    if (error) {
      this.logger.error(`Error fetching top 10 ${type}:`, error);
      throw new Error(`Failed to fetch top 10 ${type}: ${error.message}`);
    }

    return (data || []).map((item, index) => ({
      position: index + 1,
      ...item,
    }));
  }

  /**
   * Get weekly ranking history for the last N weeks
   */
  async getWeeklyHistory(weeks: number = 4) {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - weeks * 7);

    const { data, error } = await this.supabaseService.client
      .from('weekly_rankings')
      .select(`
        *,
        content:content_id (
          id,
          title,
          thumbnail_url
        )
      `)
      .gte('week_start', sinceDate.toISOString().split('T')[0])
      .order('week_start', { ascending: false })
      .order('position', { ascending: true });

    if (error) {
      this.logger.error('Error fetching weekly history:', error);
      throw new Error(`Failed to fetch weekly history: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get daily sales data for the last N days
   */
  async getDailySalesData(days: number = 7) {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    const { data, error } = await this.supabaseService.client
      .from('daily_sales')
      .select(`
        *,
        content:content_id (
          id,
          title,
          thumbnail_url
        )
      `)
      .gte('sale_date', sinceDate.toISOString().split('T')[0])
      .order('sale_date', { ascending: false })
      .order('sales_count', { ascending: false });

    if (error) {
      this.logger.error('Error fetching daily sales:', error);
      throw new Error(`Failed to fetch daily sales: ${error.message}`);
    }

    return data || [];
  }
}
