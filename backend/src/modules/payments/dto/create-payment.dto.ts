import { IsString, IsEnum, IsOptional, IsUUID, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '../providers/interfaces';

export class CreatePaymentDto {
  @ApiProperty({
    description: 'ID of the purchase to create payment for',
    example: 'a52d5ab1-b1ba-4895-805b-0d30218ed431',
  })
  @IsUUID()
  purchase_id: string;

  @ApiProperty({
    description: 'Payment method to use',
    enum: PaymentMethod,
    example: PaymentMethod.PIX,
  })
  @IsEnum(PaymentMethod)
  payment_method: PaymentMethod;

  @ApiPropertyOptional({
    description: 'Return URL after successful payment (for card payments)',
    example: 'https://cinevision.com/payment/success',
  })
  @IsOptional()
  @IsUrl()
  return_url?: string;

  @ApiPropertyOptional({
    description: 'Cancel URL if payment is cancelled (for card payments)',
    example: 'https://cinevision.com/payment/cancel',
  })
  @IsOptional()
  @IsUrl()
  cancel_url?: string;

  @ApiPropertyOptional({
    description: 'PIX key to use for PIX payments (overrides default)',
    example: 'contato@cinevision.com',
  })
  @IsOptional()
  @IsString()
  pix_key?: string;
}

export class CreatePaymentResponseDto {
  @ApiProperty({
    description: 'Payment intent ID from the provider',
    example: 'pi_1234567890abcdef',
  })
  provider_payment_id: string;

  @ApiProperty({
    description: 'Payment method used',
    enum: PaymentMethod,
    example: PaymentMethod.PIX,
  })
  payment_method: PaymentMethod;

  @ApiPropertyOptional({
    description: 'URL for hosted payment page (card payments only)',
    example: 'https://checkout.stripe.com/pay/cs_test_a1b2c3...',
  })
  payment_url?: string;

  @ApiPropertyOptional({
    description: 'Payment data (PIX instructions, QR codes, etc.)',
    example: {
      client_secret: 'pi_1234567890abcdef_secret_xyz',
      pix_key: 'contato@cinevision.com',
      instructions: 'Use a chave PIX abaixo para realizar o pagamento',
      qr_code_url: null,
    },
  })
  payment_data?: any;

  @ApiProperty({
    description: 'Amount in cents',
    example: 1999,
  })
  amount_cents: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'BRL',
  })
  currency: string;

  @ApiProperty({
    description: 'Purchase ID associated with this payment',
    example: 'a52d5ab1-b1ba-4895-805b-0d30218ed431',
  })
  purchase_id: string;

  @ApiProperty({
    description: 'Provider name',
    example: 'stripe',
  })
  provider: string;

  @ApiProperty({
    description: 'Payment creation timestamp',
    example: '2025-01-24T10:30:00Z',
  })
  created_at: Date;
}

export class PaymentStatusDto {
  @ApiProperty({
    description: 'Provider payment ID to check status for',
    example: 'pi_1234567890abcdef',
  })
  @IsString()
  provider_payment_id: string;
}

export class PaymentStatusResponseDto {
  @ApiProperty({
    description: 'Current payment status',
    enum: ['pending', 'paid', 'failed', 'cancelled', 'refunded'],
    example: 'paid',
  })
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';

  @ApiPropertyOptional({
    description: 'Amount paid in cents',
    example: 1999,
  })
  amount_paid?: number;

  @ApiPropertyOptional({
    description: 'Payment completion timestamp',
    example: '2025-01-24T10:35:00Z',
  })
  paid_at?: Date;

  @ApiPropertyOptional({
    description: 'Failure reason if payment failed',
    example: 'Insufficient funds',
  })
  failure_reason?: string;

  @ApiProperty({
    description: 'Provider payment ID',
    example: 'pi_1234567890abcdef',
  })
  provider_payment_id: string;

  @ApiProperty({
    description: 'Provider name',
    example: 'stripe',
  })
  provider: string;
}