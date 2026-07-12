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

      // 2. Igor (11/07): grava previous_rank ANTES de zerar weekly_sales.
      //    Assim as queries de leitura têm um desempate primário (rank
      //    da semana anterior) e o top 10 não randomiza pra views_count
      //    quando todo mundo fica com weekly_sales=0.
      await this.snapshotPreviousRanks();

      // 3. Reset all weekly_sales to 0
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
   * Igor (11/07): grava previous_rank=1..10 pro top 10 atual de cada
   * content_type. NULL o rank de quem não está no top. Rodado ANTES do
   * reset de weekly_sales — assim o snapshot reflete a semana que
   * acabou de terminar.
   *
   * Também usado como backfill manual (endpoint one-shot) quando o
   * deploy acontece no meio da semana e não dá pra esperar domingo.
   */
  async snapshotPreviousRanks() {
    const c = this.supabaseService.client;

    // Zera todos os ranks anteriores primeiro (bot pode ter saído do top 10)
    await c.from('content')
      .update({ previous_rank: null })
      .not('previous_rank', 'is', null);

    const types = ['movie', 'series', 'novelinha'];
    for (const type of types) {
      const { data, error } = await c
        .from('content')
        .select('id')
        .eq('content_type', type)
        .eq('status', 'PUBLISHED')
        .order('weekly_sales', { ascending: false, nullsFirst: false })
        .order('views_count', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        this.logger.warn(`snapshotPreviousRanks(${type}) failed: ${error.message}`);
        continue;
      }
      if (!data?.length) continue;

      // UPDATE 1 por 1 (10 rows max por type = 30 rows total, sem overhead)
      await Promise.all(
        data.map((r, i) =>
          c.from('content').update({ previous_rank: i + 1 }).eq('id', r.id),
        ),
      );
      this.logger.log(`snapshotPreviousRanks(${type}): ${data.length} rows`);
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
