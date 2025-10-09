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

export interface ContentLanguage {
  id: string;
  content_id: string;
  language_type: LanguageType;
  language_code: LanguageCode;
  language_name: string;
  video_url?: string;
  video_storage_key?: string;
  hls_master_url?: string;
  hls_base_path?: string;
  file_size_bytes?: number;
  duration_minutes?: number;
  video_codec?: string;
  audio_codec?: string;
  bitrate_kbps?: number;
  width?: number;
  height?: number;
  frame_rate?: number;
  available_qualities?: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}
