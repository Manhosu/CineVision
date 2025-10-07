import { IsString, IsUUID, IsEnum, IsNumber, IsObject, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum WebhookPaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export class PaymentWebhookDto {
  @ApiProperty({
    description: 'Payment provider ID',
    example: 'stripe_pi_1234567890',
  })
  @IsString()
  payment_id: string;

  @ApiProperty({
    description: 'Purchase token from initiation',
    example: '987fcdeb-51a2-43d7-8765-123456789abc',
  })
  @IsUUID(4)
  purchase_token: string;

  @ApiProperty({
    description: 'Payment status',
    enum: WebhookPaymentStatus,
    example: WebhookPaymentStatus.PAID,
  })
  @IsEnum(WebhookPaymentStatus)
  status: WebhookPaymentStatus;

  @ApiProperty({
    description: 'Amount in cents',
    example: 1990,
  })
  @IsNumber()
  amount_cents: number;

  @ApiProperty({
    description: 'Webhook signature for verification',
    example: 'sha256=1234567890abcdef',
  })
  @IsString()
  signature: string;

  @ApiPropertyOptional({
    description: 'Additional metadata from payment provider',
    type: 'object',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Failure reason if payment failed',
    example: 'insufficient_funds',
  })
  @IsOptional()
  @IsString()
  failure_reason?: string;
}

export class PaymentWebhookResponseDto {
  @ApiProperty({
    description: 'Purchase ID that was updated',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  purchase_id: string;

  @ApiProperty({
    description: 'Updated purchase status',
    example: 'paid',
  })
  status: string;

  @ApiProperty({
    description: 'Content delivery information',
    type: 'object',
    required: false,
  })
  delivery?: {
    type: string;
    access_token?: string;
    expires_at?: Date;
    telegram_sent?: boolean;
  };

  @ApiProperty({
    description: 'Processing timestamp',
    example: '2024-09-25T10:35:00Z',
  })
  processed_at: Date;
}