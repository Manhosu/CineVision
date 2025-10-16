import { IsString, IsOptional, IsNotEmpty, MaxLength, IsBoolean, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateContentRequestDto {
  @ApiProperty({
    description: 'Title of the requested content',
    example: 'Nome do Filme',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({
    description: 'Additional description or details about the request',
    example: 'Por favor, adicione este filme com boa qualidade',
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Telegram ID of the requester',
    example: '123456789',
  })
  @IsString()
  @IsOptional()
  telegram_id?: string;

  @ApiPropertyOptional({
    description: 'Telegram username of the requester',
    example: 'john_doe',
  })
  @IsString()
  @IsOptional()
  telegram_username?: string;

  @ApiPropertyOptional({
    description: 'Telegram first name of the requester',
    example: 'John',
  })
  @IsString()
  @IsOptional()
  telegram_first_name?: string;

  @ApiPropertyOptional({
    description: 'User ID if the request comes from authenticated user',
    example: 'user-uuid-here',
  })
  @IsString()
  @IsOptional()
  user_id?: string;

  @ApiPropertyOptional({
    description: 'User email for notifications',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsOptional()
  user_email?: string;

  @ApiPropertyOptional({
    description: 'Whether to send notification when content is added',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  notify_when_added?: boolean;
}