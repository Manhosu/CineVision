import { Controller, Get, Post, Body, Query, UseGuards, Logger } from '@nestjs/common';
import { AnalyticsService, UserSession, ActivityEvent } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Endpoint público para rastrear sessão de usuário
   * POST /api/v1/analytics/session
   */
  @Post('session')
  async trackSession(@Body() session: UserSession) {
    try {
      await this.analyticsService.upsertUserSession(session);
      return { success: true };
    } catch (error) {
      this.logger.error('Error tracking session:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Endpoint para encerrar sessão
   * POST /api/v1/analytics/session/end
   */
  @Post('session/end')
  async endSession(@Body('session_id') sessionId: string) {
    try {
      await this.analyticsService.endUserSession(sessionId);
      return { success: true };
    } catch (error) {
      this.logger.error('Error ending session:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Endpoint para rastrear atividade
   * POST /api/v1/analytics/activity
   */
  @Post('activity')
  async trackActivity(@Body() event: ActivityEvent) {
    try {
      await this.analyticsService.trackActivity(event);
      return { success: true };
    } catch (error) {
      this.logger.error('Error tracking activity:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Endpoint para obter estatísticas em tempo real (ADMIN)
   * GET /api/v1/analytics/realtime-stats
   */
  @Get('realtime-stats')
  async getRealtimeStats() {
    try {
      const stats = await this.analyticsService.getRealtimeStats();
      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error getting realtime stats:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Endpoint para obter sessões ativas (ADMIN)
   * GET /api/v1/analytics/active-sessions
   */
  @Get('active-sessions')
  async getActiveSessions() {
    try {
      const sessions = await this.analyticsService.getActiveSessions();
      return {
        success: true,
        data: sessions,
        count: sessions.length,
      };
    } catch (error) {
      this.logger.error('Error getting active sessions:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Endpoint para obter atividades recentes (ADMIN)
   * GET /api/v1/analytics/recent-activities
   */
  @Get('recent-activities')
  async getRecentActivities(@Query('limit') limit?: string) {
    try {
      const parsedLimit = limit ? parseInt(limit, 10) : 50;
      const activities = await this.analyticsService.getRecentActivities(parsedLimit);
      return {
        success: true,
        data: activities,
        count: activities.length,
      };
    } catch (error) {
      this.logger.error('Error getting recent activities:', error);
      return { success: false, error: error.message };
    }
  }
}
