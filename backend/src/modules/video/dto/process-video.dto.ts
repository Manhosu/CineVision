import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, IsEnum, IsBoolean } from 'class-validator';

export enum LanguageType {
  ORIGINAL = 'original',
  DUBBED = 'dubbed',
  SUBTITLED = 'subtitled',
}

export class ProcessVideoDto {
  @ApiProperty({
    description: 'Content ID to associate the video with',
    example: 'abc-123-def-456',
  })
  @IsUUID()
  contentId: string;

  @ApiProperty({
    description: 'S3 path or local path to the video file',
    example: 's3://cinevision-filmes/videos/movie.mkv',
  })
  @IsString()
  inputPath: string;

  @ApiProperty({
    description: 'Language ID if processing language-specific video',
    example: 'lang-123-456',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  languageId?: string;

  @ApiProperty({
    description: 'Type of language version',
    enum: LanguageType,
    example: LanguageType.DUBBED,
    required: false,
  })
  @IsOptional()
  @IsEnum(LanguageType)
  languageType?: LanguageType;

  @ApiProperty({
    description: 'Automatically convert to HLS if file is large (>500MB)',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  autoConvertToHLS?: boolean;
}

export class ProcessVideoResponseDto {
  @ApiProperty({ description: 'Processing job ID' })
  jobId: string;

  @ApiProperty({ description: 'Content ID' })
  contentId: string;

  @ApiProperty({ description: 'Current status' })
  status: 'queued' | 'processing' | 'completed' | 'failed';

  @ApiProperty({ description: 'Message' })
  message: string;

  @ApiProperty({ description: 'Estimated completion time', required: false })
  estimatedCompletion?: string;
}

export class VideoProcessingStatusDto {
  @ApiProperty({ description: 'Content ID' })
  contentId: string;

  @ApiProperty({ description: 'Processing status' })
  status: 'pending' | 'processing' | 'completed' | 'failed';

  @ApiProperty({ description: 'Progress percentage (0-100)' })
  progress: number;

  @ApiProperty({ description: 'Current conversion type', required: false })
  conversionType?: string;

  @ApiProperty({ description: 'Qualities generated', required: false })
  qualitiesGenerated?: string[];

  @ApiProperty({ description: 'Input format', required: false })
  inputFormat?: string;

  @ApiProperty({ description: 'Output format', required: false })
  outputFormat?: string;

  @ApiProperty({ description: 'HLS master URL', required: false })
  hlsMasterUrl?: string;

  @ApiProperty({ description: 'Video URL (direct)', required: false })
  videoUrl?: string;

  @ApiProperty({ description: 'Processing time in seconds', required: false })
  processingTime?: number;

  @ApiProperty({ description: 'Error message if failed', required: false })
  error?: string;

  @ApiProperty({ description: 'Started at', required: false })
  startedAt?: Date;

  @ApiProperty({ description: 'Completed at', required: false })
  completedAt?: Date;
}
