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
import { Content } from './content.entity';
import { createEnumColumn } from '../../../database/transformers/enum.transformer';

export enum LanguageType {
  DUBBED = 'dubbed',
  SUBTITLED = 'subtitled',
}

export enum LanguageCode {
  PT_BR = 'pt-BR',
  EN_US = 'en-US',
  ES_ES = 'es-ES',
  FR_FR = 'fr-FR',
  IT_IT = 'it-IT',
  DE_DE = 'de-DE',
  JA_JP = 'ja-JP',
  KO_KR = 'ko-KR',
  ZH_CN = 'zh-CN',
}

@Entity('content_languages')
@Index('idx_content_language_content_id', ['content_id'])
@Index('idx_content_language_type_code', ['language_type', 'language_code'])
@Index('idx_content_language_unique', ['content_id', 'language_type', 'language_code'], { unique: true })
export class ContentLanguage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  content_id: string;

  @ManyToOne(() => Content, (content) => content.languages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'content_id' })
  content: Content;

  @Column(createEnumColumn(LanguageType, LanguageType.DUBBED))
  language_type: LanguageType;

  @Column(createEnumColumn(LanguageCode, LanguageCode.PT_BR))
  language_code: LanguageCode;

  @Column({ nullable: false })
  language_name: string; // Ex: "Português (Brasil)", "English (US)"

  @Column({ nullable: true })
  video_url?: string;

  @Column({ nullable: true })
  video_storage_key?: string;

  @Column({ nullable: true })
  hls_master_url?: string;

  @Column({ nullable: true })
  hls_base_path?: string;

  @Column({ type: 'bigint', nullable: true })
  file_size_bytes?: number;

  @Column({ type: 'int', nullable: true })
  duration_minutes?: number;

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

  @Column({ type: 'text', nullable: true })
  available_qualities?: string; // JSON string com qualidades disponíveis

  @Column({ nullable: true, default: 'pending' })
  upload_status?: string; // pending, processing, completed, failed

  @Column({ default: true })
  is_active: boolean;

  @Column({ default: false })
  is_default: boolean; // Idioma padrão para o conteúdo

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}