import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus, RequestPriority } from '../entities/content-request.entity';

export class ContentRequestResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the request',
    example: 'request-uuid-here',
  })
  id: string;

  @ApiProperty({
    description: 'Title of the requested content',
    example: 'Nome do Filme',
  })
  title: string;

  @ApiPropertyOptional({
    description: 'Additional description or details about the request',
    example: 'Por favor, adicione este filme com boa qualidade',
  })
  description?: string;

  @ApiProperty({
    description: 'Status of the content request',
    enum: RequestStatus,
    example: RequestStatus.PENDING,
  })
  status: RequestStatus;

  @ApiPropertyOptional({
    description: 'Priority of the content request',
    enum: RequestPriority,
    example: RequestPriority.MEDIUM,
  })
  priority?: RequestPriority;

  @ApiPropertyOptional({
    description: 'Admin notes about the request',
    example: 'Conteúdo foi adicionado ao catálogo',
  })
  admin_notes?: string;

  @ApiPropertyOptional({
    description: 'Admin user ID who is assigned to handle this request',
    example: 'admin-uuid-here',
  })
  assigned_to?: string;

  @ApiPropertyOptional({
    description: 'Telegram ID of the requester',
    example: '123456789',
  })
  requester_telegram_id?: string;

  @ApiPropertyOptional({
    description: 'Telegram username of the requester',
    example: 'john_doe',
  })
  requester_telegram_username?: string;

  @ApiPropertyOptional({
    description: 'Telegram first name of the requester',
    example: 'John',
  })
  requester_telegram_first_name?: string;

  @ApiPropertyOptional({
    description: 'User ID if the request comes from authenticated user',
    example: 'user-uuid-here',
  })
  user_id?: string;

  @ApiProperty({
    description: 'Date when the request was created',
    example: '2024-01-15T10:30:00Z',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Date when the request was last updated',
    example: '2024-01-15T10:30:00Z',
  })
  updated_at: Date;

  @ApiPropertyOptional({
    description: 'Date when the request was processed (approved/rejected)',
    example: '2024-01-15T10:30:00Z',
  })
  processed_at?: Date;

  @ApiPropertyOptional({
    description: 'Date when the request was completed',
    example: '2024-01-15T10:30:00Z',
  })
  completed_at?: Date;
}