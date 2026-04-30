import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PurchaseDeliveryType } from '../../purchases/entities/purchase.entity';

export class CheckoutCartDto {
  @ApiPropertyOptional({
    description: 'Preferred delivery method for all items',
    enum: PurchaseDeliveryType,
    default: PurchaseDeliveryType.SITE,
  })
  @IsOptional()
  @IsEnum(PurchaseDeliveryType)
  preferred_delivery?: PurchaseDeliveryType;

  @ApiPropertyOptional({ description: 'Session ID for guest checkout' })
  @IsOptional()
  @IsString()
  session_id?: string;

  @ApiPropertyOptional({
    description:
      'Telegram chat ID do cliente (vem do link enviado pela IA via Business DM, query param ?chat=). Usado pra entrega via Telegram após pagamento confirmado.',
  })
  @IsOptional()
  @IsString()
  telegram_chat_id?: string;
}
