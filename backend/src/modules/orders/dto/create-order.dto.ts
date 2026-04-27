import { IsOptional, IsUUID, IsString, IsEnum, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PurchaseDeliveryType } from '../../purchases/entities/purchase.entity';

export class CreateOrderFromCartInput {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID(4)
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({ enum: PurchaseDeliveryType })
  @IsOptional()
  @IsEnum(PurchaseDeliveryType)
  preferredDelivery?: PurchaseDeliveryType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telegramChatId?: string;
}

export class CreateRecoveryOrderInput {
  @IsUUID(4)
  originalOrderId: string;

  @IsOptional()
  @IsString()
  discountPercent?: string;
}
