import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumberString } from 'class-validator';

export class TelegramCallbackDto {
  @ApiProperty({
    description: 'Temporary token from Telegram link',
    example: 'abc123def456ghi789',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    description: 'Telegram user ID',
    example: '123456789',
  })
  @IsNumberString()
  @IsNotEmpty()
  telegram_id: string;

  @ApiProperty({
    description: 'Telegram username',
    example: 'johndoe',
    required: false,
  })
  @IsString()
  @IsOptional()
  telegram_username?: string;

  @ApiProperty({
    description: 'Telegram first name',
    example: 'John',
    required: false,
  })
  @IsString()
  @IsOptional()
  telegram_first_name?: string;

  @ApiProperty({
    description: 'Telegram last name',
    example: 'Doe',
    required: false,
  })
  @IsString()
  @IsOptional()
  telegram_last_name?: string;

  @ApiProperty({
    description: 'HMAC signature for security validation',
    example: 'sha256=abc123def456...',
  })
  @IsString()
  @IsNotEmpty()
  signature: string;
}

export class TelegramCallbackResponseDto {
  @ApiProperty({
    description: 'User information',
    type: 'object',
  })
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    telegram_id?: string;
    telegram_username?: string;
    telegram_chat_id?: string;
    role: string;
    status: string;
    blocked: boolean;
    avatar_url?: string;
    last_login?: Date;
    email_verified_at?: Date;
    created_at: Date;
    updated_at: Date;
  };

  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  access_token: string;

  @ApiProperty({
    description: 'JWT refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refresh_token: string;

  @ApiProperty({
    description: 'Whether this is a new user registration',
    example: true,
  })
  is_new_user: boolean;
}