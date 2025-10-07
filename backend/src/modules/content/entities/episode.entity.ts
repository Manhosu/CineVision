import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
} from 'typeorm';
import { Series } from './series.entity';
import { User } from '../../users/entities/user.entity';
import { createEnumColumn } from '../../../database/transformers/enum.transformer';
import { VideoProcessingStatus } from './content.entity';

@Entity('episodes')
@Index('idx_episode_series_season_number', ['series', 'season_number', 'episode_number'])
@Index('idx_episode_processing_status', ['processing_status'])
export class Episode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'int', nullable: false })
  season_number: number;

  @Column({ type: 'int', nullable: false })
  episode_number: number;

  @Column({ nullable: true })
  thumbnail_url?: string;

  @Column({ nullable: true })
  video_url?: string;

  // Individual pricing (only if series.price_per_episode = true)
  @Column({ type: 'int', nullable: true })
  price_cents?: number;

  @Column({ type: 'varchar', length: 3, default: 'BRL' })
  currency: string;

  // Stripe integration (only if priced individually)
  @Column({ type: 'varchar', nullable: true })
  stripe_product_id?: string;

  @Column({ type: 'varchar', nullable: true })
  stripe_price_id?: string;

  @Column({ type: 'int', nullable: true })
  duration_minutes?: number;

  // Storage and streaming
  @Column({ nullable: true })
  storage_path?: string;

  @Column({ nullable: true })
  file_storage_key?: string;

  @Column({ nullable: true })
  original_file_path?: string;

  @Column({ nullable: true })
  hls_master_url?: string;

  @Column({ nullable: true })
  hls_base_path?: string;

  @Column(createEnumColumn(VideoProcessingStatus, VideoProcessingStatus.PENDING))
  processing_status: VideoProcessingStatus;

  @Column({ type: 'int', nullable: true })
  processing_progress?: number;

  @Column({ type: 'text', nullable: true })
  available_qualities?: string;

  @Column({ type: 'bigint', nullable: true })
  file_size_bytes?: number;

  @Column({ nullable: true })
  video_codec?: string;

  @Column({ nullable: true })
  audio_codec?: string;

  @Column({ type: 'int', nullable: true })
  bitrate_kbps?: number;

  @Column({ type: 'int', nullable: true })
  width?: number;

  @Column({ type: 'int', nullable: true })
  height?: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  frame_rate?: number;

  @Column({ type: 'timestamp', nullable: true })
  processing_started_at?: Date;

  @Column({ type: 'timestamp', nullable: true })
  processing_completed_at?: Date;

  @Column({ type: 'text', nullable: true })
  processing_error?: string;

  @Column({ default: 0 })
  views_count: number;

  @ManyToOne(() => Series, (series) => series.episodes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'series_id' })
  series: Series;

  @Column({ type: 'uuid' })
  series_id: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  created_by?: User;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  updated_by?: User;
}
