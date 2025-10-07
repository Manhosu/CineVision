import { IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddFavoriteDto {
  @ApiProperty({
    description: 'Content ID to add to favorites',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  content_id: string;
}

export class RemoveFavoriteDto {
  @ApiProperty({
    description: 'Content ID to remove from favorites',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  content_id: string;
}

export class FavoriteResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  user_id: string;

  @ApiProperty()
  content_id: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty({ required: false })
  content?: any;
}
