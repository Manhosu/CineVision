import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Content } from '../entities/content.entity';

@Injectable()
export class WeeklyResetService {
  private readonly logger = new Logger(WeeklyResetService.name);

  constructor(
    @InjectRepository(Content)
    private contentRepository: Repository<Content>,
  ) {}

  /**
   * Reset weekly sales counter every Monday at 00:00 (midnight)
   * Cron expression: '0 0 * * 1' = minute 0, hour 0, every Monday
   */
  @Cron('0 0 * * 1', {
    name: 'reset-weekly-sales',
    timeZone: 'America/Sao_Paulo',
  })
  async resetWeeklySales() {
    this.logger.log('🔄 Starting weekly sales reset...');

    try {
      // Reset all weekly_sales to 0
      const result = await this.contentRepository
        .createQueryBuilder()
        .update()
        .set({ weekly_sales: 0 })
        .execute();

      this.logger.log(`✅ Weekly sales reset completed! ${result.affected} records updated`);
      return { success: true, affected: result.affected };
    } catch (error) {
      this.logger.error('❌ Error resetting weekly sales:', error);
      throw error;
    }
  }

  /**
   * Manual trigger for testing purposes
   * Can be called via API endpoint if needed
   */
  async manualReset() {
    this.logger.log('🔧 Manual weekly sales reset triggered');
    return this.resetWeeklySales();
  }
}