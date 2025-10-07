import { ApiProperty } from '@nestjs/swagger';
import { PurchaseStatus, PurchaseDeliveryType } from '../entities/purchase.entity';

export class InitiatePurchaseResponseDto {
  @ApiProperty({
    description: 'Purchase ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Unique purchase token for Telegram bot',
    example: '987fcdeb-51a2-43d7-8765-123456789abc',
  })
  purchase_token: string;

  @ApiProperty({
    description: 'Deep link to Telegram bot',
    example: 'https://t.me/CineVisionApp_Bot?start=987fcdeb-51a2-43d7-8765-123456789abc',
  })
  telegram_deep_link: string;

  @ApiProperty({
    description: 'Purchase status',
    enum: PurchaseStatus,
    example: PurchaseStatus.PENDING,
  })
  status: PurchaseStatus;

  @ApiProperty({
    description: 'Amount in cents',
    example: 1990,
  })
  amount_cents: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'BRL',
  })
  currency: string;

  @ApiProperty({
    description: 'Preferred delivery method',
    enum: PurchaseDeliveryType,
    example: PurchaseDeliveryType.SITE,
  })
  preferred_delivery: PurchaseDeliveryType;

  @ApiProperty({
    description: 'Content information',
    type: 'object',
  })
  content: {
    id: string;
    title: string;
    poster_url?: string;
  };

  @ApiProperty({
    description: 'Purchase creation timestamp',
    example: '2024-09-25T10:30:00Z',
  })
  created_at: Date;
}