import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../config/supabase.service';

@Injectable()
export class AdminStatsService {
  private readonly logger = new Logger(AdminStatsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Get total users count
   */
  async getTotalUsers() {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const { count, error } = await this.supabaseService.client
        .from('users')
        .select('*', { count: 'exact', head: true });

      if (error) {
        this.logger.error('Error getting users count:', error);
        return { total: 0, usersChange: '0%', error: error.message };
      }

      // Get users count from 7 days ago
      const { count: previousCount } = await this.supabaseService.client
        .from('users')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', sevenDaysAgo.toISOString());

      const usersChange = this.calculatePercentageChange(count || 0, previousCount || 0);

      return {
        total: count || 0,
        usersChange,
        message: 'Total users retrieved successfully',
      };
    } catch (error) {
      this.logger.error('Exception getting users count:', error);
      return { total: 0, usersChange: '0%', error: error.message };
    }
  }

  /**
   * Calculate percentage change between two values
   */
  private calculatePercentageChange(current: number, previous: number): string {
    if (previous === 0) {
      return current > 0 ? '+100%' : '0%';
    }
    const change = ((current - previous) / previous) * 100;
    const sign = change > 0 ? '+' : '';
    return `${sign}${Math.round(change)}%`;
  }

  /**
   * Get content statistics
   */
  async getContentStats() {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      // Get total content count
      const { count: totalCount, error: totalError } = await this.supabaseService.client
        .from('content')
        .select('*', { count: 'exact', head: true });

      if (totalError) {
        this.logger.error('Error getting content count:', totalError);
      }

      // Get content count from 7 days ago
      const { count: previousTotalCount } = await this.supabaseService.client
        .from('content')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', sevenDaysAgo.toISOString());

      // Get published content count
      const { count: publishedCount, error: publishedError } = await this.supabaseService.client
        .from('content')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'PUBLISHED');

      if (publishedError) {
        this.logger.error('Error getting published content count:', publishedError);
      }

      // Get movies count
      const { count: moviesCount, error: moviesError } = await this.supabaseService.client
        .from('content')
        .select('*', { count: 'exact', head: true })
        .eq('content_type', 'movie');

      if (moviesError) {
        this.logger.error('Error getting movies count:', moviesError);
      }

      // Get series count
      const { count: seriesCount, error: seriesError } = await this.supabaseService.client
        .from('content')
        .select('*', { count: 'exact', head: true })
        .eq('content_type', 'series');

      if (seriesError) {
        this.logger.error('Error getting series count:', seriesError);
      }

      // Get total views from all content
      const { data: viewsData, error: viewsError } = await this.supabaseService.client
        .from('content')
        .select('views, created_at');

      let totalViews = 0;
      let previousViews = 0;
      if (!viewsError && viewsData) {
        totalViews = viewsData.reduce((sum, item) => sum + (item.views || 0), 0);
        // Calculate views from content created before 7 days ago
        previousViews = viewsData
          .filter(item => new Date(item.created_at) < sevenDaysAgo)
          .reduce((sum, item) => sum + (item.views || 0), 0);
      } else if (viewsError) {
        this.logger.error('Error getting views count:', viewsError);
      }

      const contentChange = this.calculatePercentageChange(totalCount || 0, previousTotalCount || 0);
      const viewsChange = this.calculatePercentageChange(totalViews, previousViews);

      return {
        total: totalCount || 0,
        published: publishedCount || 0,
        movies: moviesCount || 0,
        series: seriesCount || 0,
        totalViews: totalViews,
        contentChange,
        viewsChange,
        message: 'Content statistics retrieved successfully',
      };
    } catch (error) {
      this.logger.error('Exception getting content stats:', error);
      return {
        total: 0,
        published: 0,
        movies: 0,
        series: 0,
        totalViews: 0,
        contentChange: '0%',
        viewsChange: '0%',
        error: error.message,
      };
    }
  }

  /**
   * Get content requests statistics
   */
  async getRequestStats() {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Check if content_requests table exists
      const { count: totalCount, error: totalError } = await this.supabaseService.client
        .from('content_requests')
        .select('*', { count: 'exact', head: true });

      if (totalError) {
        // Table might not exist yet
        this.logger.warn('Error getting content requests count:', totalError);
        return {
          total: 0,
          pending: 0,
          requestsChange: '0%',
          message: 'Content requests table not available',
        };
      }

      // Get pending requests count
      const { count: pendingCount, error: pendingError } = await this.supabaseService.client
        .from('content_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (pendingError) {
        this.logger.error('Error getting pending requests count:', pendingError);
      }

      // Get pending requests count from 7 days ago
      const { count: previousPendingCount } = await this.supabaseService.client
        .from('content_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .lt('created_at', sevenDaysAgo.toISOString());

      const requestsChange = this.calculatePercentageChange(pendingCount || 0, previousPendingCount || 0);

      return {
        total: totalCount || 0,
        pending: pendingCount || 0,
        requestsChange,
        message: 'Request statistics retrieved successfully',
      };
    } catch (error) {
      this.logger.error('Exception getting request stats:', error);
      return {
        total: 0,
        pending: 0,
        requestsChange: '0%',
        error: error.message,
      };
    }
  }
}
