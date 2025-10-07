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
   * Note: Currently disabled as weekly_sales column doesn't exist
   */
  // @Cron('0 0 * * 1', {
  //   name: 'reset-weekly-sales',
  //   timeZone: 'America/Sao_Paulo',
  // })
  async resetWeeklySales() {
    this.logger.log('🔄 Weekly sales reset is currently disabled (weekly_sales column not implemented)');
    
    // TODO: Implement weekly sales tracking if needed
    // For now, we'll use purchases_count as the main metric
    this.logger.log('✅ Weekly sales reset skipped - using purchases_count instead');
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