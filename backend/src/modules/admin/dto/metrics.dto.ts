import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';

export enum MetricsPeriod {
  LAST_7_DAYS = '7d',
  LAST_30_DAYS = '30d',
  LAST_90_DAYS = '90d',
  CURRENT_MONTH = 'month',
  CURRENT_YEAR = 'year',
}

export class GetMetricsDto {
  @IsOptional()
  @IsEnum(MetricsPeriod)
  period?: MetricsPeriod = MetricsPeriod.LAST_30_DAYS;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;
}

export class MetricsResponseDto {
  // Overview metrics
  total_revenue: number;
  total_users: number;
  total_content: number;
  active_purchases: number;
  concurrent_streams: number;
  storage_usage_gb: number;

  // Time series data
  revenue_series: Array<{
    date: string;
    revenue: number;
    purchases: number;
  }>;

  // Content analytics
  top_content: Array<{
    content_id: string;
    title: string;
    purchases: number;
    revenue: number;
    views: number;
  }>;

  // Performance metrics
  conversion_rate: number;
  error_rate: number;
  average_session_duration: number;

  // User metrics
  new_users_count: number;
  active_users_count: number;
  blocked_users_count: number;

  // Payment metrics
  successful_payments: number;
  failed_payments: number;
  pending_payments: number;
  refunded_amount: number;
}

export class UpdateUserStatusDto {
  @IsString()
  user_id: string;

  @IsEnum(['active', 'blocked'])
  status: 'active' | 'blocked';
}

export class UpdateUserBalanceDto {
  @IsString()
  user_id: string;

  amount: number;

  @IsString()
  reason: string;
}

export class RetryPaymentDto {
  @IsString()
  payment_id: string;
}

export class RefundPaymentDto {
  @IsString()
  payment_id: string;

  amount?: number; // Optional partial refund

  @IsString()
  reason: string;
}

export class NotifyUserDto {
  @IsString()
  user_id: string;

  @IsString()
  content_id: string;

  @IsString()
  message: string;
}

export class SystemConfigDto {
  pix_key?: string;
  stripe_publishable_key?: string;
  stripe_secret_key?: string;
  stripe_webhook_secret?: string;
  cdn_access_key?: string;
  cdn_secret_key?: string;
  telegram_bot_token?: string;
  default_timeout?: number;
  max_retry_attempts?: number;
}