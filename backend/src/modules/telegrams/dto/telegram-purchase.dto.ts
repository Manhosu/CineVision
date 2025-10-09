import { IsString, IsOptional, IsEmail, IsEnum, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum PurchaseType {
  WITH_ACCOUNT = 'with_account',
  ANONYMOUS = 'anonymous',
}

export class InitiateTelegramPurchaseDto {
  @ApiProperty({ description: 'Telegram chat ID' })
  @IsString()
  chat_id: string;

  @ApiProperty({ description: 'Telegram user ID' })
  @IsNumber()
  telegram_user_id: number;

  @ApiProperty({ description: 'Content ID to purchase' })
  @IsString()
  content_id: string;

  @ApiProperty({ description: 'Purchase type', enum: PurchaseType })
  @IsEnum(PurchaseType)
  purchase_type: PurchaseType;

  @ApiProperty({ description: 'User email if purchasing with account', required: false })
  @IsOptional()
  @IsEmail()
  user_email?: string;

  @ApiProperty({ description: 'Payment method (pix or card)', required: false })
  @IsOptional()
  @IsString()
  payment_method?: string;
}

export class TelegramPurchaseResponseDto {
  @ApiProperty()
  purchase_id: string;

  @ApiProperty()
  payment_url: string;

  @ApiProperty()
  amount_cents: number;

  @ApiProperty()
  status: string;

  @ApiProperty()
  message: string;
}

export class VerifyEmailDto {
  @ApiProperty({ description: 'Email to verify' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Telegram user ID' })
  @IsNumber()
  telegram_user_id: number;
}

export class VerifyEmailResponseDto {
  @ApiProperty()
  exists: boolean;

  @ApiProperty()
  user_id?: string;

  @ApiProperty()
  message: string;
}
