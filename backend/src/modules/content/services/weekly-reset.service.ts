import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../../../config/supabase.service';

@Injectable()
export class WeeklyResetService {
  private readonly logger = new Logger(WeeklyResetService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Reset weekly sales counter every Sunday at 00:00 (midnight São Paulo time)
   * Before resetting, save a snapshot of the current top 10 to weekly_rankings
   */
  @Cron('0 0 * * 0', {
    name: 'reset-weekly-sales',
    timeZone: 'America/Sao_Paulo',
  })
  async resetWeeklySales() {
    this.logger.log('Starting weekly sales reset...');

    try {
      // 1. Save snapshot of current top 10 movies and series to weekly_rankings
      await this.saveWeeklySnapshot();

      // 2. Reset all weekly_sales to 0
      const { error } = await this.supabaseService.client
        .from('content')
        .update({ weekly_sales: 0 })
        .gte('weekly_sales', 0);

      if (error) {
        throw new Error(`Failed to reset weekly sales: ${error.message}`);
      }

      this.logger.log('Weekly sales reset completed!');
      return { success: true };
    } catch (error) {
      this.logger.error('Error resetting weekly sales:', error);
      throw error;
    }
  }

  /**
   * Save a snapshot of the current top 10 movies and series to weekly_rankings
   */
  private async saveWeeklySnapshot() {
    const weekStart = new Date().toISOString().split('T')[0];

    // Get top 10 movies
    const { data: topMovies } = await this.supabaseService.client
      .from('content')
      .select('id, title, weekly_sales, views_count, content_type')
      .eq('content_type', 'movie')
      .order('weekly_sales', { ascending: false, nullsFirst: false })
      .order('views_count', { ascending: false })
      .limit(10);

    // Get top 10 series
    const { data: topSeries } = await this.supabaseService.client
      .from('content')
      .select('id, title, weekly_sales, views_count, content_type')
      .eq('content_type', 'series')
      .order('weekly_sales', { ascending: false, nullsFirst: false })
      .order('views_count', { ascending: false })
      .limit(10);

    const rankings = [
      ...(topMovies || []).map((item, index) => ({
        content_id: item.id,
        content_type: 'movie',
        position: index + 1,
        weekly_sales: item.weekly_sales || 0,
        views_count: item.views_count || 0,
        week_start: weekStart,
      })),
      ...(topSeries || []).map((item, index) => ({
        content_id: item.id,
        content_type: 'series',
        position: index + 1,
        weekly_sales: item.weekly_sales || 0,
        views_count: item.views_count || 0,
        week_start: weekStart,
      })),
    ];

    if (rankings.length > 0) {
      const { error } = await this.supabaseService.client
        .from('weekly_rankings')
        .insert(rankings);

      if (error) {
        this.logger.error('Error saving weekly snapshot:', error);
      } else {
        this.logger.log(`Saved ${rankings.length} weekly ranking entries`);
      }
    }
  }

  /**
   * Manual trigger for testing purposes
   */
  async manualReset() {
    this.logger.log('Manual weekly sales reset triggered');
    return this.resetWeeklySales();
  }
}
