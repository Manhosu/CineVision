import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  OneToMany,
  JoinTable,
  Index,
} from 'typeorm';
import { Category } from './category.entity';
import { ContentLanguage } from './content-language.entity';
import { User } from '../../users/entities/user.entity';
import { createEnumColumn } from '../../../database/transformers/enum.transformer';

export enum ContentStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum ContentAvailability {
  SITE_ONLY = 'site',
  TELEGRAM_ONLY = 'telegram',
  BOTH = 'both',
}

export enum ContentType {
  MOVIE = 'movie',
  SERIES = 'series',
  DOCUMENTARY = 'documentary',
}

export enum VideoProcessingStatus {
  PENDING = 'pending',
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
}

export enum VideoQuality {
  AUTO = 'auto',
  ORIGINAL = 'original',
  HD_1080 = '1080p',
  HD_720 = '720p',
  SD_480 = '480p',
  SD_360 = '360p',
}

@Entity('content')
@Index('idx_content_title_search', { synchronize: false }) // Criado via migração
@Index('idx_content_status_type_created', ['status', 'type', 'created_at'])
@Index('idx_content_popularity', ['is_featured', 'views_count', 'purchases_count'])
export class Content {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  synopsis?: string;

  @Column({ nullable: true })
  thumbnail_url?: string;

  @Column({ nullable: true })
  poster_url?: string;

  @Column({ nullable: true })
  backdrop_url?: string;

  @Column({ nullable: true })
  banner_url?: string;

  @Column({ nullable: true })
  trailer_url?: string;

  @Column({ nullable: true })
  video_url?: string;

  @Column({ type: 'int', nullable: false })
  price_cents: number;

  @Column({ type: 'varchar', length: 3, default: 'BRL' })
  currency: string;

  // Stripe integration fields
  @Column({ type: 'varchar', nullable: true })
  stripe_product_id?: string;

  @Column({ type: 'varchar', nullable: true })
  stripe_price_id?: string;

  // Storage keys for S3
  @Column({ type: 'varchar', nullable: true })
  file_storage_key?: string;

  @Column({ type: 'varchar', nullable: true })
  cover_storage_key?: string;

  @Column({ type: 'varchar', nullable: true })
  trailer_storage_key?: string;

  // Sales tracking
  @Column({ type: 'int', default: 0 })
  weekly_sales: number;

  @Column({ type: 'int', default: 0 })
  total_sales: number;

  @Column({ type: 'int', nullable: true })
  duration_minutes?: number;

  @Column({ nullable: true })
  release_year?: number;

  // Series-specific fields
  @Column({ type: 'int', nullable: true })
  total_seasons?: number;

  @Column({ type: 'int', nullable: true })
  total_episodes?: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  age_rating?: string;

  @Column({ nullable: true })
  director?: string;

  @Column({ type: 'text', nullable: true })
  cast?: string;

  @Column({ type: 'text', nullable: true })
  genres?: string;

  @Column({ nullable: true })
  imdb_rating?: number;

  @Column({ nullable: true })
  storage_path?: string;

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

  @Column({ type: 'timestamptz', nullable: true })
  processing_started_at?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  processing_completed_at?: Date;

  @Column({ type: 'text', nullable: true })
  processing_error?: string;

  @Column({ ...createEnumColumn(ContentType, ContentType.MOVIE), name: 'content_type' })
  type: ContentType;

  @Column(createEnumColumn(ContentAvailability, ContentAvailability.BOTH))
  availability: ContentAvailability;

  @Column(createEnumColumn(ContentStatus, ContentStatus.DRAFT))
  status: ContentStatus;

  @Column({ default: false })
  is_featured: boolean;

  @Column({ default: 0 })
  views_count: number;

  @Column({ default: 0 })
  purchases_count: number;

  @ManyToMany(() => Category, (category) => category.contents)
  @JoinTable({
    name: 'content_categories',
    joinColumn: {
      name: 'content_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'category_id',
      referencedColumnName: 'id',
    },
  })
  categories: Category[];

  @OneToMany(() => ContentLanguage, (language) => language.content, { cascade: true })
  languages: ContentLanguage[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Colunas de auditoria
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  created_by?: User;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  updated_by?: User;
}
