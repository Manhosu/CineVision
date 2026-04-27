import { IsUUID, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddCartItemDto {
  @ApiProperty({ description: 'Content ID to add to cart' })
  @IsUUID(4)
  content_id: string;

  @ApiPropertyOptional({
    description: 'Session ID for guest users (optional, used when not authenticated)',
  })
  @IsOptional()
  @IsString()
  session_id?: string;
}
