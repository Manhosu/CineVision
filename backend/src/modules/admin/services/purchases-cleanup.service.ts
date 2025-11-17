import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AdminPurchasesSimpleService } from './admin-purchases-simple.service';

@Injectable()
export class PurchasesCleanupService {
  private readonly logger = new Logger(PurchasesCleanupService.name);

  constructor(
    private readonly adminPurchasesService: AdminPurchasesSimpleService,
  ) {}

  /**
   * Automatically expire pending purchases every hour
   * Runs at the start of every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleExpirePendingPurchases() {
    this.logger.log('🕐 Running automatic pending purchases expiration...');

    try {
      const result = await this.adminPurchasesService.expirePendingPurchases(24);

      if (result.expired > 0) {
        this.logger.log(`✅ Expired ${result.expired} pending purchases automatically`);
      } else {
        this.logger.log('✅ No pending purchases to expire');
      }
    } catch (error) {
      this.logger.error('❌ Error expiring pending purchases:', error);
    }
  }

  /**
   * Automatically clean up old expired purchases every day at 3 AM
   * Runs daily at 3:00 AM
   */
  @Cron('0 3 * * *')
  async handleCleanupExpiredPurchases() {
    this.logger.log('🗑️  Running automatic expired purchases cleanup...');

    try {
      const result = await this.adminPurchasesService.cleanupExpiredPurchases(7);

      if (result.deleted > 0) {
        this.logger.log(`✅ Deleted ${result.deleted} old expired purchases automatically`);
      } else {
        this.logger.log('✅ No old expired purchases to delete');
      }
    } catch (error) {
      this.logger.error('❌ Error cleaning up expired purchases:', error);
    }
  }
}
