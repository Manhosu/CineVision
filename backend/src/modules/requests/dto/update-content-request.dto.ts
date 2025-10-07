import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus } from '../entities/content-request.entity';

export class UpdateContentRequestDto {
  @ApiPropertyOptional({
    description: 'Status of the content request',
    enum: RequestStatus,
    example: RequestStatus.COMPLETED,
  })
  @IsEnum(RequestStatus)
  @IsOptional()
  status?: RequestStatus;

  @ApiPropertyOptional({
    description: 'Admin notes about the request',
    example: 'Content has been added to the catalog',
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  admin_notes?: string;

  @ApiPropertyOptional({
    description: 'Request priority level',
    enum: ['low', 'medium', 'high', 'urgent'],
    example: 'high',
  })
  @IsString()
  @IsOptional()
  priority?: string;
}