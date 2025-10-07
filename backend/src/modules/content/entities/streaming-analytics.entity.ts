import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Content, VideoQuality } from './content.entity';
import { User } from '../../users/entities/user.entity';
import { createEnumColumn } from '../../../database/transformers/enum.transformer';

export enum StreamingEventType {
  PLAY_START = 'play_start',
  PLAY_PAUSE = 'play_pause',
  PLAY_RESUME = 'play_resume',
  PLAY_STOP = 'play_stop',
  QUALITY_CHANGE = 'quality_change',
  BUFFER_START = 'buffer_start',
  BUFFER_END = 'buffer_end',
  SEEK = 'seek',
  ERROR = 'error',
}

export enum StreamingPlatform {
  WEB = 'web',
  TELEGRAM = 'telegram',
  MOBILE_APP = 'mobile_app',
  TV_APP = 'tv_app',
}

@Entity('streaming_analytics')
@Index('idx_streaming_analytics_content_date', ['content_id', 'created_at'])
@Index('idx_streaming_analytics_user_date', ['user_id', 'created_at'])
@Index('idx_streaming_analytics_session', ['session_id'])
@Index('idx_streaming_analytics_event_type', ['event_type'])
@Index('idx_streaming_analytics_platform', ['platform'])
export class StreamingAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  content_id: string;

  @Column('uuid', { nullable: true })
  user_id?: string;

  @Column({ nullable: false })
  session_id: string;

  @Column(createEnumColumn(StreamingEventType))
  event_type: StreamingEventType;

  @Column(createEnumColumn(StreamingPlatform))
  platform: StreamingPlatform;

  @Column(createEnumColumn(VideoQuality, VideoQuality.AUTO))
  quality: VideoQuality;

  @Column({ type: 'int', nullable: true })
  timestamp_seconds?: number;

  @Column({ type: 'int', nullable: true })
  duration_seconds?: number;

  @Column({ type: 'int', nullable: true })
  buffer_duration_ms?: number;

  @Column({ type: 'int', nullable: true })
  bitrate_kbps?: number;

  @Column({ nullable: true })
  user_agent?: string;

  @Column({ type: 'text', nullable: true })
  ip_address?: string;

  @Column({ nullable: true })
  country?: string;

  @Column({ nullable: true })
  city?: string;

  @Column({ nullable: true })
  device_type?: string;

  @Column({ nullable: true })
  browser?: string;

  @Column({ nullable: true })
  os?: string;

  @Column({ type: 'int', nullable: true })
  screen_width?: number;

  @Column({ type: 'int', nullable: true })
  screen_height?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  connection_speed_mbps?: number;

  @Column({ type: 'text', nullable: true })
  error_message?: string;

  @Column({ type: 'text', nullable: true })
  metadata?: string;

  @ManyToOne(() => Content)
  @JoinColumn({ name: 'content_id' })
  content: Content;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @CreateDateColumn()
  created_at: Date;

  // Computed properties
  get is_mobile(): boolean {
    return this.device_type?.toLowerCase().includes('mobile') || false;
  }

  get is_desktop(): boolean {
    return this.device_type?.toLowerCase().includes('desktop') || false;
  }

  get is_tablet(): boolean {
    return this.device_type?.toLowerCase().includes('tablet') || false;
  }

  get is_tv(): boolean {
    return this.device_type?.toLowerCase().includes('tv') || false;
  }

  get quality_label(): string {
    const qualityLabels = {
      [VideoQuality.AUTO]: 'Auto',
      [VideoQuality.ORIGINAL]: 'Original',
      [VideoQuality.HD_1080]: '1080p',
      [VideoQuality.HD_720]: '720p',
      [VideoQuality.SD_480]: '480p',
      [VideoQuality.SD_360]: '360p',
    };
    return qualityLabels[this.quality] || 'Unknown';
  }

  get is_high_quality(): boolean {
    return [VideoQuality.ORIGINAL, VideoQuality.HD_1080, VideoQuality.HD_720].includes(this.quality);
  }

  get is_error_event(): boolean {
    return this.event_type === StreamingEventType.ERROR;
  }

  get is_playback_event(): boolean {
    return [
      StreamingEventType.PLAY_START,
      StreamingEventType.PLAY_PAUSE,
      StreamingEventType.PLAY_RESUME,
      StreamingEventType.PLAY_STOP,
    ].includes(this.event_type);
  }

  get is_quality_event(): boolean {
    return this.event_type === StreamingEventType.QUALITY_CHANGE;
  }

  get is_buffer_event(): boolean {
    return [
      StreamingEventType.BUFFER_START,
      StreamingEventType.BUFFER_END,
    ].includes(this.event_type);
  }
}
