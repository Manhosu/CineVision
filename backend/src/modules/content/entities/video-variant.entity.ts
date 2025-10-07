import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Content, VideoQuality, VideoProcessingStatus } from './content.entity';
import { createEnumColumn } from '../../../database/transformers/enum.transformer';

@Entity('video_variants')
@Index('idx_video_variant_content_quality', ['content_id', 'quality'])
@Index('idx_video_variant_status', ['status'])
export class VideoVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  content_id: string;

  @Column(createEnumColumn(VideoQuality))
  quality: VideoQuality;

  @Column(createEnumColumn(VideoProcessingStatus, VideoProcessingStatus.PENDING))
  status: VideoProcessingStatus;

  @Column({ nullable: true })
  playlist_url?: string;

  @Column({ nullable: true })
  segments_path?: string;

  @Column({ type: 'int', nullable: true })
  bitrate_kbps?: number;

  @Column({ type: 'int', nullable: true })
  width?: number;

  @Column({ type: 'int', nullable: true })
  height?: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  frame_rate?: number;

  @Column({ type: 'bigint', nullable: true })
  file_size_bytes?: number;

  @Column({ type: 'int', nullable: true })
  duration_seconds?: number;

  @Column({ type: 'int', nullable: true })
  segment_count?: number;

  @Column({ type: 'decimal', precision: 3, scale: 1, nullable: true, default: 6.0 })
  target_duration?: number;

  @Column({ nullable: true })
  video_codec?: string;

  @Column({ nullable: true })
  audio_codec?: string;

  @Column({ type: 'text', nullable: true })
  encoding_params?: string;

  @Column({ type: 'timestamptz', nullable: true })
  processing_started_at?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  processing_completed_at?: Date;

  @Column({ type: 'text', nullable: true })
  processing_error?: string;

  @Column({ type: 'int', nullable: true })
  processing_progress?: number;

  @ManyToOne(() => Content)
  @JoinColumn({ name: 'content_id' })
  content: Content;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Computed properties
  get resolution(): string {
    if (this.width && this.height) {
      return `${this.width}x${this.height}`;
    }
    return this.quality;
  }

  get is_completed(): boolean {
    return this.status === VideoProcessingStatus.READY;
  }

  get is_processing(): boolean {
    return [
      VideoProcessingStatus.UPLOADING,
      VideoProcessingStatus.PROCESSING,
    ].includes(this.status);
  }

  get is_failed(): boolean {
    return this.status === VideoProcessingStatus.FAILED;
  }
}
