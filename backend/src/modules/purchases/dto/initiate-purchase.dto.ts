import { IsUUID, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PurchaseDeliveryType } from '../entities/purchase.entity';

export class InitiatePurchaseDto {
  @ApiPropertyOptional({
    description: 'User ID (optional for guest purchases)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID(4)
  user_id?: string;

  @ApiProperty({
    description: 'Content ID to purchase',
    example: '987fcdeb-51a2-43d7-8765-123456789abc',
  })
  @IsUUID(4)
  content_id: string;

  @ApiProperty({
    description: 'Preferred delivery method',
    enum: PurchaseDeliveryType,
    example: PurchaseDeliveryType.SITE,
  })
  @IsEnum(PurchaseDeliveryType)
  preferred_delivery: PurchaseDeliveryType;
}