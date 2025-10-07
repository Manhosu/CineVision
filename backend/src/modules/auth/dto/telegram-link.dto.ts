import { ApiProperty } from '@nestjs/swagger';

export class TelegramLinkResponseDto {
  @ApiProperty({
    description: 'Temporary token for Telegram authentication',
    example: 'abc123def456ghi789',
  })
  token: string;

  @ApiProperty({
    description: 'Deep link URL for Telegram bot',
    example: 'https://t.me/CineVisionApp_Bot?start=abc123def456ghi789',
  })
  deep_link: string;

  @ApiProperty({
    description: 'QR code data for mobile scanning',
    example: 'https://t.me/CineVisionApp_Bot?start=abc123def456ghi789',
  })
  qr_data: string;

  @ApiProperty({
    description: 'Token expiration time in seconds',
    example: 120,
  })
  expires_in: number;
}