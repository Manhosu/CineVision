import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import { Content } from '../content/entities/content.entity';
import { User } from '../users/entities/user.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { SystemLog, LogLevel, LogType } from '../logs/entities/system-log.entity';
import { StreamingAnalytics } from '../content/entities/streaming-analytics.entity';
import { ContentRequest } from '../requests/entities/content-request.entity';
import {
  MetricsResponseDto,
  MetricsPeriod,
  GetMetricsDto,
  UpdateUserStatusDto,
  UpdateUserBalanceDto,
  RetryPaymentDto,
  RefundPaymentDto,
  NotifyUserDto,
} from './dto/metrics.dto';
import { subDays, startOfMonth, startOfYear, format } from 'date-fns';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Content)
    private contentRepository: Repository<Content>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Purchase)
    private purchaseRepository: Repository<Purchase>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(SystemLog)
    private systemLogRepository: Repository<SystemLog>,
    @InjectRepository(StreamingAnalytics)
    private streamingAnalyticsRepository: Repository<StreamingAnalytics>,
    @InjectRepository(ContentRequest)
    private contentRequestRepository: Repository<ContentRequest>,
  ) {}

  async getMetrics(query: GetMetricsDto): Promise<MetricsResponseDto> {
    const { start_date, end_date } = this.getDateRange(query.period, query.start_date, query.end_date);

    // Execute all queries in parallel for better performance
    const [
      totalRevenue,
      totalUsers,
      totalContent,
      activePurchases,
      concurrentStreams,
      storageUsage,
      revenueSeries,
      topContent,
      conversionData,
      errorRate,
      avgSessionDuration,
      userMetrics,
      paymentMetrics,
    ] = await Promise.all([
      this.getTotalRevenue(start_date, end_date),
      this.getTotalUsers(),
      this.getTotalContent(),
      this.getActivePurchases(),
      this.getConcurrentStreams(),
      this.getStorageUsage(),
      this.getRevenueSeries(start_date, end_date),
      this.getTopContent(start_date, end_date),
      this.getConversionRate(start_date, end_date),
      this.getErrorRate(start_date, end_date),
      this.getAverageSessionDuration(start_date, end_date),
      this.getUserMetrics(start_date, end_date),
      this.getPaymentMetrics(start_date, end_date),
    ]);

    return {
      // Overview metrics
      total_revenue: totalRevenue,
      total_users: totalUsers,
      total_content: totalContent,
      active_purchases: activePurchases,
      concurrent_streams: concurrentStreams,
      storage_usage_gb: storageUsage,

      // Time series data
      revenue_series: revenueSeries,

      // Content analytics
      top_content: topContent,

      // Performance metrics
      conversion_rate: conversionData.conversion_rate,
      error_rate: errorRate,
      average_session_duration: avgSessionDuration,

      // User metrics
      new_users_count: userMetrics.new_users,
      active_users_count: userMetrics.active_users,
      blocked_users_count: userMetrics.blocked_users,

      // Payment metrics
      successful_payments: paymentMetrics.successful,
      failed_payments: paymentMetrics.failed,
      pending_payments: paymentMetrics.pending,
      refunded_amount: paymentMetrics.refunded_amount,
    };
  }

  async updateUserStatus(dto: UpdateUserStatusDto): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findOne({ where: { id: dto.user_id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isBlocked = dto.status === 'blocked';
    await this.userRepository.update(dto.user_id, { blocked: isBlocked });

    // Log the action
    await this.systemLogRepository.save({
      entity_type: 'user',
      entity_id: dto.user_id,
      action: dto.status === 'blocked' ? 'block_user' : 'unblock_user',
      user_id: null, // Would be the admin user ID in real implementation
      meta: { previous_status: user.blocked ? 'blocked' : 'active', new_status: dto.status },
    });

    return {
      success: true,
      message: `User ${dto.status === 'blocked' ? 'blocked' : 'unblocked'} successfully`,
    };
  }

  async updateUserBalance(dto: UpdateUserBalanceDto): Promise<{ success: boolean; new_balance: number }> {
    const user = await this.userRepository.findOne({ where: { id: dto.user_id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Note: This assumes a balance field exists on User entity
    // You may need to add this field or handle balance differently
    const currentBalance = 0; // user.balance || 0;
    const newBalance = currentBalance + dto.amount;

    // await this.userRepository.update(dto.user_id, { balance: newBalance });

    // Log the balance change
    await this.systemLogRepository.save({
      entity_type: 'user',
      entity_id: dto.user_id,
      action: 'balance_update',
      user_id: null, // Admin user ID
      meta: {
        previous_balance: currentBalance,
        amount_changed: dto.amount,
        new_balance: newBalance,
        reason: dto.reason,
      },
    });

    return {
      success: true,
      new_balance: newBalance,
    };
  }

  async retryPaymentWebhook(dto: RetryPaymentDto): Promise<{ success: boolean; message: string }> {
    const payment = await this.paymentRepository.findOne({ where: { id: dto.payment_id } });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Implement webhook retry logic here
    // This would depend on your payment provider integration

    await this.systemLogRepository.save({
      entity_type: 'payment',
      entity_id: dto.payment_id,
      action: 'webhook_retry',
      user_id: null, // Admin user ID
      meta: { payment_status: payment.status },
    });

    return {
      success: true,
      message: 'Payment webhook retry initiated',
    };
  }

  async refundPayment(dto: RefundPaymentDto): Promise<{ success: boolean; refund_amount: number }> {
    const payment = await this.paymentRepository.findOne({ where: { id: dto.payment_id } });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('Only completed payments can be refunded');
    }

    const refundAmount = dto.amount || payment.amount_cents / 100;

    // Implement actual refund logic with payment provider
    // This would depend on your Stripe/payment provider integration

    // Update payment status
    await this.paymentRepository.update(dto.payment_id, {
      status: 'REFUNDED' as any,
    });

    // Log the refund
    await this.systemLogRepository.save({
      entity_type: 'payment',
      entity_id: dto.payment_id,
      action: 'payment_refund',
      user_id: null, // Admin user ID
      meta: {
        refund_amount: refundAmount,
        reason: dto.reason,
        original_amount: payment.amount_cents / 100,
      },
    });

    return {
      success: true,
      refund_amount: refundAmount,
    };
  }

  async notifyUserContentAvailable(dto: NotifyUserDto): Promise<{ success: boolean }> {
    // Implement notification logic (Telegram bot integration)
    // This would send a message to the user about content availability

    await this.systemLogRepository.save({
      entity_type: 'user',
      entity_id: dto.user_id,
      action: 'content_notification',
      user_id: null, // Admin user ID
      meta: {
        content_id: dto.content_id,
        message: dto.message,
      },
    });

    return { success: true };
  }

  // Extended CRUD methods for admin

  async getAllUsers(page: number, limit: number, search?: string, status?: 'active' | 'blocked') {
    const queryBuilder = this.userRepository.createQueryBuilder('user');

    if (search) {
      queryBuilder.where('user.email ILIKE :search', { search: `%${search}%` });
    }

    if (status) {
      const isBlocked = status === 'blocked';
      queryBuilder.andWhere('user.blocked = :blocked', { blocked: isBlocked });
    }

    const [users, total] = await queryBuilder
      .orderBy('user.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { users, total, page, limit };
  }

  async getUserDetails(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get user's purchase history
    const purchases = await this.purchaseRepository.find({
      where: { user_id: userId },
      relations: ['content'],
      order: { created_at: 'DESC' },
      take: 10,
    });

    // Get user's recent activity
    const recentActivity = await this.systemLogRepository.find({
      where: { entity_id: userId, type: LogType.USER },
      order: { created_at: 'DESC' },
      take: 10,
    });

    return {
      user,
      purchases,
      recent_activity: recentActivity,
      total_purchases: purchases.length,
      total_spent: purchases.reduce((sum, p) => sum + (p.amount_cents || 0), 0) / 100,
    };
  }

  async getAllContent(page: number, limit: number, search?: string, status?: string) {
    const queryBuilder = this.contentRepository.createQueryBuilder('content')
      .leftJoinAndSelect('content.categories', 'categories');

    if (search) {
      queryBuilder.where('content.title ILIKE :search', { search: `%${search}%` });
    }

    if (status) {
      queryBuilder.andWhere('content.status = :status', { status });
    }

    const [content, total] = await queryBuilder
      .orderBy('content.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Get purchase count for each content
    const contentWithStats = await Promise.all(
      content.map(async (item) => {
        const purchaseCount = await this.purchaseRepository.count({
          where: { content_id: item.id },
        });

        const revenue = await this.purchaseRepository
          .createQueryBuilder('purchase')
          .select('SUM(purchase.amount_cents)', 'total')
          .where('purchase.content_id = :contentId', { contentId: item.id })
          .getRawOne();

        return {
          ...item,
          purchase_count: purchaseCount,
          total_revenue: parseFloat(revenue.total || 0) / 100,
        };
      })
    );

    return { content: contentWithStats, total, page, limit };
  }

  async updateContentAvailability(contentId: string, availability: 'site' | 'telegram' | 'both') {
    const content = await this.contentRepository.findOne({ where: { id: contentId } });
    if (!content) {
      throw new NotFoundException('Content not found');
    }

    await this.contentRepository.update(contentId, { availability: availability as any });

    await this.systemLogRepository.save({
      entity_type: 'content',
      entity_id: contentId,
      action: 'availability_update',
      user_id: null, // Admin user ID
      meta: { new_availability: availability, previous_availability: content.availability },
    });

    return { success: true };
  }

  async getAllPayments(page: number, limit: number, status?: string, provider?: string) {
    const queryBuilder = this.paymentRepository.createQueryBuilder('payment')
      .leftJoinAndSelect('payment.purchase', 'purchase')
      .leftJoinAndSelect('purchase.content', 'content')
      .leftJoinAndSelect('purchase.user', 'user');

    if (status) {
      queryBuilder.where('payment.status = :status', { status });
    }

    if (provider) {
      queryBuilder.andWhere('payment.provider = :provider', { provider });
    }

    const [payments, total] = await queryBuilder
      .orderBy('payment.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { payments, total, page, limit };
  }

  async getAllOrders(page: number, limit: number, status?: string) {
    const queryBuilder = this.contentRequestRepository.createQueryBuilder('request')
      .leftJoinAndSelect('request.user', 'user');

    if (status) {
      queryBuilder.where('request.status = :status', { status });
    }

    const [orders, total] = await queryBuilder
      .orderBy('request.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { orders, total, page, limit };
  }

  async getSystemLogs(page: number, limit: number, level?: string, entity?: string, type?: string) {
    const queryBuilder = this.systemLogRepository.createQueryBuilder('log');

    if (level) {
      queryBuilder.where('log.level = :level', { level });
    }

    if (entity) {
      queryBuilder.andWhere('log.entity_id = :entity', { entity });
    }

    if (type) {
      queryBuilder.andWhere('log.type = :type', { type });
    }

    const [logs, total] = await queryBuilder
      .orderBy('log.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { logs, total, page, limit };
  }

  // Private helper methods

  private getDateRange(period?: MetricsPeriod, start_date?: string, end_date?: string) {
    if (start_date && end_date) {
      return { start_date: new Date(start_date), end_date: new Date(end_date) };
    }

    const now = new Date();
    let start: Date;

    switch (period) {
      case MetricsPeriod.LAST_7_DAYS:
        start = subDays(now, 7);
        break;
      case MetricsPeriod.LAST_30_DAYS:
        start = subDays(now, 30);
        break;
      case MetricsPeriod.LAST_90_DAYS:
        start = subDays(now, 90);
        break;
      case MetricsPeriod.CURRENT_MONTH:
        start = startOfMonth(now);
        break;
      case MetricsPeriod.CURRENT_YEAR:
        start = startOfYear(now);
        break;
      default:
        start = subDays(now, 30);
    }

    return { start_date: start, end_date: now };
  }

  private async getTotalRevenue(start_date: Date, end_date: Date): Promise<number> {
    const result = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('SUM(payment.amount_cents)', 'total')
      .where('payment.status = :status', { status: 'COMPLETED' })
      .andWhere('payment.processed_at BETWEEN :start AND :end', { start: start_date, end: end_date })
      .getRawOne();

    return parseFloat(result.total || 0) / 100; // Convert cents to currency
  }

  private async getTotalUsers(): Promise<number> {
    return this.userRepository.count();
  }

  private async getTotalContent(): Promise<number> {
    return this.contentRepository.count({ where: { status: 'PUBLISHED' as any } });
  }

  private async getActivePurchases(): Promise<number> {
    return this.purchaseRepository.count({ where: { status: 'PAID' as any } });
  }

  private async getConcurrentStreams(): Promise<number> {
    // Approximate concurrent streams based on recent streaming activity
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const result = await this.streamingAnalyticsRepository
      .createQueryBuilder('analytics')
      .select('COUNT(DISTINCT analytics.session_id)', 'count')
      .where('analytics.event_type = :type', { type: 'HEARTBEAT' })
      .andWhere('analytics.created_at > :since', { since: fiveMinutesAgo })
      .getRawOne();

    return parseInt(result.count || 0);
  }

  private async getStorageUsage(): Promise<number> {
    // This would need to be implemented with actual S3/storage metrics
    // For now, return a mock value based on content count
    const contentCount = await this.contentRepository.count();
    return Math.round(contentCount * 2.5); // Assume ~2.5GB per content item
  }

  private async getRevenueSeries(start_date: Date, end_date: Date) {
    const result = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('DATE(payment.processed_at)', 'date')
      .addSelect('SUM(payment.amount_cents)', 'revenue')
      .addSelect('COUNT(*)', 'purchases')
      .where('payment.status = :status', { status: 'COMPLETED' })
      .andWhere('payment.processed_at BETWEEN :start AND :end', { start: start_date, end: end_date })
      .groupBy('DATE(payment.processed_at)')
      .orderBy('date', 'ASC')
      .getRawMany();

    return result.map(item => ({
      date: format(new Date(item.date), 'yyyy-MM-dd'),
      revenue: parseFloat(item.revenue || 0) / 100,
      purchases: parseInt(item.purchases),
    }));
  }

  private async getTopContent(start_date: Date, end_date: Date) {
    const result = await this.purchaseRepository
      .createQueryBuilder('purchase')
      .leftJoin('purchase.content', 'content')
      .select('content.id', 'content_id')
      .addSelect('content.title', 'title')
      .addSelect('COUNT(*)', 'purchases')
      .addSelect('SUM(purchase.amount_cents)', 'revenue')
      .where('purchase.created_at BETWEEN :start AND :end', { start: start_date, end: end_date })
      .groupBy('content.id, content.title')
      .orderBy('COUNT(*)', 'DESC')
      .limit(10)
      .getRawMany();

    return result.map(item => ({
      content_id: item.content_id,
      title: item.title,
      purchases: parseInt(item.purchases),
      revenue: parseFloat(item.revenue || 0) / 100,
      views: 0, // Would need to calculate from streaming analytics
    }));
  }

  private async getConversionRate(start_date: Date, end_date: Date) {
    // Simplified conversion rate calculation
    const totalPurchases = await this.purchaseRepository.count({
      where: { created_at: Between(start_date, end_date) },
    });

    const completedPurchases = await this.purchaseRepository.count({
      where: {
        created_at: Between(start_date, end_date),
        status: 'PAID' as any,
      },
    });

    const conversion_rate = totalPurchases > 0 ? (completedPurchases / totalPurchases) * 100 : 0;
    return { conversion_rate };
  }

  private async getErrorRate(start_date: Date, end_date: Date): Promise<number> {
    const totalLogs = await this.systemLogRepository.count({
      where: { created_at: Between(start_date, end_date) },
    });

    const errorLogs = await this.systemLogRepository.count({
      where: {
        created_at: Between(start_date, end_date),
        level: LogLevel.ERROR,
      },
    });

    return totalLogs > 0 ? (errorLogs / totalLogs) * 100 : 0;
  }

  private async getAverageSessionDuration(start_date: Date, end_date: Date): Promise<number> {
    // Calculate average streaming session duration
    const result = await this.streamingAnalyticsRepository
      .createQueryBuilder('analytics')
      .select('AVG(analytics.watch_time_seconds)', 'avg_duration')
      .where('analytics.created_at BETWEEN :start AND :end', { start: start_date, end: end_date })
      .andWhere('analytics.event_type = :type', { type: 'SESSION_END' })
      .getRawOne();

    return parseFloat(result.avg_duration || 0);
  }

  private async getUserMetrics(start_date: Date, end_date: Date) {
    const [new_users, active_users, blocked_users] = await Promise.all([
      this.userRepository.count({
        where: { created_at: Between(start_date, end_date) },
      }),
      this.userRepository.count({
        where: { blocked: false },
      }),
      this.userRepository.count({
        where: { blocked: true },
      }),
    ]);

    return { new_users, active_users, blocked_users };
  }

  private async getPaymentMetrics(start_date: Date, end_date: Date) {
    const [successful, failed, pending, refundedResult] = await Promise.all([
      this.paymentRepository.count({
        where: {
          created_at: Between(start_date, end_date),
          status: 'COMPLETED' as any,
        },
      }),
      this.paymentRepository.count({
        where: {
          created_at: Between(start_date, end_date),
          status: 'FAILED' as any,
        },
      }),
      this.paymentRepository.count({
        where: {
          created_at: Between(start_date, end_date),
          status: 'PENDING' as any,
        },
      }),
      this.paymentRepository
        .createQueryBuilder('payment')
        .select('SUM(payment.amount_cents)', 'total')
        .where('payment.status = :status', { status: 'REFUNDED' })
        .andWhere('payment.processed_at BETWEEN :start AND :end', { start: start_date, end: end_date })
        .getRawOne(),
    ]);

    return {
      successful,
      failed,
      pending,
      refunded_amount: parseFloat(refundedResult.total || 0) / 100,
    };
  }

  async getContentStats() {
    const [total, totalViews] = await Promise.all([
      this.contentRepository.count(),
      this.contentRepository
        .createQueryBuilder('content')
        .select('SUM(content.views_count)', 'total')
        .getRawOne(),
    ]);

    return {
      total,
      totalViews: parseInt(totalViews.total || 0),
    };
  }

  async getUserStats() {
    const total = await this.userRepository.count();

    return {
      total,
    };
  }

  async getRequestsStats() {
    const pending = await this.contentRequestRepository.count({
      where: { status: 'pending' as any },
    });

    return {
      pending,
    };
  }
}