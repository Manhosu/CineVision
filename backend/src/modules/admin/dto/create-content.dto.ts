import { IsString, IsInt, IsOptional, IsEnum, IsArray, IsBoolean, Min, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContentType, ContentAvailability } from '../../content/entities/content.entity';

export class CreateContentDto {
  @ApiPropertyOptional({ description: 'Content type (movie, series, documentary)', default: 'movie' })
  @IsOptional()
  @IsEnum(ContentType)
  type?: ContentType;

  @ApiProperty({ description: 'Content title' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Short description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Full synopsis' })
  @IsOptional()
  @IsString()
  synopsis?: string;

  @ApiPropertyOptional({ description: 'Price in cents (e.g., 1990 for R$ 19,90)', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  price_cents?: number;

  @ApiPropertyOptional({ description: 'Currency code (ISO 4217)', default: 'BRL' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'Availability (site, telegram, or both)', default: 'site' })
  @IsOptional()
  @IsEnum(ContentAvailability)
  availability?: ContentAvailability;

  @ApiPropertyOptional({ description: 'Array of genre names' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genres?: string[];

  @ApiPropertyOptional({ description: 'Category IDs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  category_ids?: string[];

  @ApiPropertyOptional({ description: 'Trailer URL (YouTube, Vimeo, etc)' })
  @IsOptional()
  @IsUrl()
  trailer_url?: string;

  @ApiPropertyOptional({ description: 'Cover image URL or upload key' })
  @IsOptional()
  @IsString()
  cover_url?: string;

  @ApiPropertyOptional({ description: 'Poster image URL or upload key' })
  @IsOptional()
  @IsString()
  poster_url?: string;

  @ApiPropertyOptional({ description: 'Backdrop image URL or upload key' })
  @IsOptional()
  @IsString()
  backdrop_url?: string;

  @ApiPropertyOptional({ description: 'Language code (e.g., pt-BR, en-US)' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ description: 'Subtitle configurations', type: 'array' })
  @IsOptional()
  @IsArray()
  subtitles?: Array<{
    language: string;
    url: string;
    label?: string;
  }>;

  @ApiPropertyOptional({ description: 'Release year' })
  @IsOptional()
  @IsInt()
  release_year?: number;

  @ApiPropertyOptional({ description: 'Director name' })
  @IsOptional()
  @IsString()
  director?: string;

  @ApiPropertyOptional({ description: 'Cast (comma-separated or array)' })
  @IsOptional()
  cast?: string | string[];

  @ApiPropertyOptional({ description: 'IMDB rating' })
  @IsOptional()
  imdb_rating?: number;

  @ApiPropertyOptional({ description: 'Duration in minutes' })
  @IsOptional()
  @IsInt()
  duration_minutes?: number;

  @ApiPropertyOptional({ description: 'Mark as featured content', default: false })
  @IsOptional()
  @IsBoolean()
  is_featured?: boolean;
}

export class InitiateUploadDto {
  @ApiProperty({ description: 'Content ID' })
  @IsString()
  content_id: string;

  @ApiProperty({ description: 'File name' })
  @IsString()
  file_name: string;

  @ApiProperty({ description: 'File size in bytes' })
  @IsInt()
  @Min(1)
  file_size: number;

  @ApiProperty({ description: 'Content type (MIME type)' })
  @IsString()
  content_type: string;

  @ApiPropertyOptional({ description: 'Chunk size in bytes', default: 10485760 })
  @IsOptional()
  @IsInt()
  chunk_size?: number;
}

export class CompleteUploadDto {
  @ApiProperty({ description: 'Content ID' })
  @IsString()
  content_id: string;

  @ApiProperty({ description: 'Upload ID from S3' })
  @IsString()
  upload_id: string;

  @ApiProperty({ description: 'S3 key' })
  @IsString()
  key: string;

  @ApiProperty({ description: 'Array of uploaded parts with ETags' })
  @IsArray()
  parts: Array<{
    PartNumber: number;
    ETag: string;
  }>;
}

export class PublishContentDto {
  @ApiProperty({ description: 'Content ID' })
  @IsString()
  content_id: string;

  @ApiPropertyOptional({ description: 'Send Telegram notification', default: true })
  @IsOptional()
  @IsBoolean()
  notify_users?: boolean;
}

export class CreateSeriesDto {
  @ApiProperty({ description: 'Series title' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Series description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Price in cents (can be per-series or per-episode)' })
  @IsInt()
  @Min(0)
  price_cents: number;

  @ApiPropertyOptional({ description: 'If true, each episode is priced individually', default: false })
  @IsOptional()
  @IsBoolean()
  price_per_episode?: boolean;

  @ApiPropertyOptional({ description: 'Currency code', default: 'BRL' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ description: 'Availability' })
  @IsEnum(ContentAvailability)
  availability: ContentAvailability;

  @ApiPropertyOptional({ description: 'Genres' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genres?: string[];

  @ApiPropertyOptional({ description: 'Category IDs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  category_ids?: string[];

  @ApiPropertyOptional({ description: 'Total seasons' })
  @IsOptional()
  @IsInt()
  total_seasons?: number;
}

export class CreateEpisodeDto {
  @ApiProperty({ description: 'Series ID' })
  @IsString()
  series_id: string;

  @ApiProperty({ description: 'Episode title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Season number' })
  @IsInt()
  @Min(1)
  season_number: number;

  @ApiProperty({ description: 'Episode number' })
  @IsInt()
  @Min(1)
  episode_number: number;

  @ApiPropertyOptional({ description: 'Episode description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Individual price in cents (only if series is price_per_episode)' })
  @IsOptional()
  @IsInt()
  price_cents?: number;

  @ApiPropertyOptional({ description: 'Duration in minutes' })
  @IsOptional()
  @IsInt()
  duration_minutes?: number;
}
