import { IsString, IsOptional, IsEmail, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePixSettingsDto {
  @ApiProperty({
    description: 'PIX key for receiving payments (can be email, phone, CPF/CNPJ, or random key)',
    example: 'admin@cinevision.com',
  })
  @IsString()
  @Length(1, 255)
  pix_key: string;

  @ApiPropertyOptional({
    description: 'Merchant name to display on PIX transactions',
    example: 'Cine Vision',
  })
  @IsOptional()
  @IsString()
  @Length(1, 25)
  merchant_name?: string;

  @ApiPropertyOptional({
    description: 'Merchant city to display on PIX transactions',
    example: 'SAO PAULO',
  })
  @IsOptional()
  @IsString()
  @Length(1, 15)
  merchant_city?: string;
}

export class AdminSettingsResponseDto {
  @ApiProperty({ description: 'PIX key configured' })
  pix_key: string;

  @ApiProperty({ description: 'Merchant name' })
  merchant_name: string;

  @ApiProperty({ description: 'Merchant city' })
  merchant_city: string;

  @ApiProperty({ description: 'When settings were last updated' })
  updated_at: Date;
}
