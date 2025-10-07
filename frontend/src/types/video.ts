// Video Player Types

export interface StreamingData {
  streamUrl: string;
  manifestUrl: string;
  expiresAt: string;
  accessToken: string;
  qualities: string[];
}

export interface VideoContent {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  poster?: string;
  duration?: number;
  duration_minutes?: number;
  price_cents: number;
  status: 'processing' | 'ready' | 'error' | 'deleted';
  processing_status?: ProcessingStatus;
  created_at: string;
  updated_at: string;
}

export interface ProcessingStatus {
  stage: 'uploading' | 'transcoding' | 'packaging' | 'ready' | 'error';
  progress: number; // 0-100
  message?: string;
  estimated_completion?: string;
  available_qualities: QualityVariant[];
  error_details?: {
    code: string;
    message: string;
    timestamp: string;
  };
}

export interface QualityVariant {
  resolution: '240p' | '360p' | '480p' | '720p' | '1080p' | '1440p' | '2160p';
  width: number;
  height: number;
  bitrate: number; // kbps
  fps: number;
  codec: string;
  ready: boolean;
  size_bytes?: number;
  duration_ms?: number;
}

export interface SubtitleTrack {
  id: string;
  language: string;
  label: string;
  format: 'vtt' | 'srt';
  url: string;
  default?: boolean;
}

export interface VideoPlayerConfiguration {
  // Streaming settings
  adaptiveBitrate: boolean;
  bufferSize: number; // seconds
  maxRetries: number;
  retryDelay: number; // ms

  // Quality settings
  defaultQuality?: string;
  autoQuality: boolean;
  qualityChangeThreshold: number; // bandwidth percentage

  // UI settings
  showControls: boolean;
  controlsTimeout: number; // ms
  showQualitySelector: boolean;
  showCastButton: boolean;
  showSubtitles: boolean;

  // Accessibility
  enableKeyboardControls: boolean;
  enableScreenReader: boolean;
  focusManagement: boolean;

  // Analytics
  enableAnalytics: boolean;
  analyticsEndpoint?: string;
  reportInterval: number; // seconds
}

export interface PlaybackSession {
  id: string;
  contentId: string;
  userId?: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // seconds
  position: number; // seconds
  completed: boolean;
  quality: string;
  device: DeviceInfo;
  errors: PlaybackError[];
  metrics: PlaybackMetrics;
}

export interface PlaybackMetrics {
  // Performance metrics
  startupTime: number; // ms
  bufferingEvents: BufferingEvent[];
  qualityChanges: QualityChange[];
  errors: PlaybackError[];

  // Bandwidth metrics
  averageBandwidth: number; // bps
  peakBandwidth: number; // bps
  bandwidthSamples: BandwidthSample[];

  // Playback metrics
  totalPlayTime: number; // ms
  totalBufferTime: number; // ms
  seekEvents: SeekEvent[];

  // Quality metrics
  averageQuality: string;
  qualityDistribution: Record<string, number>; // quality -> percentage
  droppedFrames: number;
  frameRate: number;
}

export interface BufferingEvent {
  timestamp: Date;
  duration: number; // ms
  position: number; // seconds in video
  reason: 'startup' | 'seeking' | 'underrun' | 'quality_change';
}

export interface QualityChange {
  timestamp: Date;
  from: string;
  to: string;
  reason: 'bandwidth' | 'manual' | 'error' | 'startup';
  bandwidth?: number; // bps
}

export interface SeekEvent {
  timestamp: Date;
  from: number; // seconds
  to: number; // seconds
  method: 'scrub' | 'click' | 'keyboard' | 'api';
}

export interface BandwidthSample {
  timestamp: Date;
  bandwidth: number; // bps
  method: 'segment' | 'manifest' | 'estimate';
}

export interface PlaybackError {
  timestamp: Date;
  code: string;
  message: string;
  severity: 'warning' | 'error' | 'fatal';
  category: 'network' | 'media' | 'drm' | 'player' | 'browser';
  details?: Record<string, any>;
}

export interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet' | 'tv' | 'unknown';
  os: string;
  browser: string;
  version: string;
  screenResolution: string;
  connectionType?: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  devicePixelRatio: number;
}

// Cast/AirPlay Types
export interface CastDevice {
  id: string;
  name: string;
  type: 'chromecast' | 'airplay' | 'dlna';
  status: 'available' | 'connecting' | 'connected' | 'error';
  capabilities: CastCapability[];
}

export type CastCapability =
  | 'video_out'
  | 'audio_out'
  | 'media_control'
  | 'subtitle_support'
  | 'quality_control';

export interface CastSession {
  id: string;
  device: CastDevice;
  contentId: string;
  startTime: Date;
  status: 'connecting' | 'connected' | 'playing' | 'paused' | 'buffering' | 'ended' | 'error';
  position: number; // seconds
  volume: number; // 0-1
  muted: boolean;
  quality: string;
}

// Event Types
export interface VideoPlayerEvent {
  type: VideoPlayerEventType;
  timestamp: Date;
  data?: Record<string, any>;
}

export type VideoPlayerEventType =
  | 'player_ready'
  | 'video_loaded'
  | 'play'
  | 'pause'
  | 'seeking'
  | 'seeked'
  | 'time_update'
  | 'duration_change'
  | 'volume_change'
  | 'quality_change'
  | 'buffer_start'
  | 'buffer_end'
  | 'fullscreen_enter'
  | 'fullscreen_exit'
  | 'cast_start'
  | 'cast_end'
  | 'error'
  | 'ended';

// API Response Types
export interface StreamingUrlResponse {
  streamUrl: string;
  manifestUrl: string;
  expiresAt: string;
  accessToken: string;
  qualities: string[];
}

export interface ProcessingStatusResponse {
  contentId: string;
  stage: ProcessingStatus['stage'];
  progress: number;
  message?: string;
  transcoding: {
    currentQuality?: string;
    completedQualities: string[];
    estimatedTimeRemaining?: number;
  };
}

export interface ContentAccessResponse {
  authorized: boolean;
  contentId: string;
  userId?: string;
  purchaseId?: string;
  expiresAt?: string;
  message?: string;
}

// Error Types
export class VideoPlayerError extends Error {
  constructor(
    message: string,
    public code: string,
    public category: PlaybackError['category'],
    public severity: PlaybackError['severity'] = 'error',
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'VideoPlayerError';
  }
}

export const VIDEO_ERROR_CODES = {
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',

  // Media errors
  MEDIA_DECODE_ERROR: 'MEDIA_DECODE_ERROR',
  MEDIA_FORMAT_UNSUPPORTED: 'MEDIA_FORMAT_UNSUPPORTED',
  MEDIA_LOAD_ERROR: 'MEDIA_LOAD_ERROR',

  // Player errors
  PLAYER_NOT_SUPPORTED: 'PLAYER_NOT_SUPPORTED',
  PLAYER_INITIALIZATION_FAILED: 'PLAYER_INITIALIZATION_FAILED',
  MANIFEST_LOAD_FAILED: 'MANIFEST_LOAD_FAILED',

  // DRM errors (for future use)
  DRM_NOT_SUPPORTED: 'DRM_NOT_SUPPORTED',
  DRM_LICENSE_ERROR: 'DRM_LICENSE_ERROR',

  // Browser/Device errors
  BROWSER_NOT_SUPPORTED: 'BROWSER_NOT_SUPPORTED',
  AUTOPLAY_BLOCKED: 'AUTOPLAY_BLOCKED',
} as const;

export type VideoErrorCode = keyof typeof VIDEO_ERROR_CODES;