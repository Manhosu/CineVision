'use client';

export interface StreamingEvent {
  id: string;
  type: StreamingEventType;
  timestamp: number;
  sessionId: string;
  contentId: string;
  userId?: string;
  data: Record<string, any>;
}

export type StreamingEventType =
  | 'session_start'
  | 'session_end'
  | 'play'
  | 'pause'
  | 'seek'
  | 'buffer_start'
  | 'buffer_end'
  | 'quality_change'
  | 'error'
  | 'cast_start'
  | 'cast_end'
  | 'fullscreen_enter'
  | 'fullscreen_exit'
  | 'subtitle_change'
  | 'volume_change'
  | 'playback_rate_change'
  | 'heartbeat';

export interface StreamingSession {
  id: string;
  contentId: string;
  userId?: string;
  startTime: number;
  endTime?: number;
  duration: number;
  totalPlayTime: number;
  bufferingTime: number;
  seekCount: number;
  qualityChanges: QualityChangeEvent[];
  errors: ErrorEvent[];
  device: DeviceInfo;
  network: NetworkInfo;
  completed: boolean;
  completionPercentage: number;
}

export interface QualityChangeEvent {
  timestamp: number;
  from: string | null;
  to: string;
  reason: 'auto' | 'manual' | 'network' | 'device';
  bandwidth?: number;
}

export interface ErrorEvent {
  timestamp: number;
  code: string;
  message: string;
  severity: 'warning' | 'error' | 'fatal';
  recoverable: boolean;
  context?: Record<string, any>;
}

export interface DeviceInfo {
  type: string;
  os: string;
  browser: string;
  version: string;
  screenResolution: string;
  isSmartTV: boolean;
  isLowEnd: boolean;
}

export interface NetworkInfo {
  connectionType?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

export interface AnalyticsMetrics {
  // Performance metrics
  averageStartupTime: number;
  bufferRatio: number; // Buffering time / Play time
  seekFrequency: number; // Seeks per hour
  completionRate: number; // Percentage of sessions completed

  // Quality metrics
  averageQuality: string;
  qualityDistribution: Record<string, number>;
  qualityStability: number; // 1 - (changes / playTime)

  // Error metrics
  errorRate: number; // Errors per session
  fatalErrorRate: number;

  // Engagement metrics
  averageWatchTime: number;
  dropOffPoints: Array<{ time: number; percentage: number }>;

  // Device/Network metrics
  deviceDistribution: Record<string, number>;
  networkDistribution: Record<string, number>;
}

export class StreamingAnalytics {
  private currentSession: StreamingSession | null = null;
  private events: StreamingEvent[] = [];
  private metrics: Partial<AnalyticsMetrics> = {};
  private eventQueue: StreamingEvent[] = [];
  private uploadTimer: NodeJS.Timeout | null = null;

  private readonly MAX_QUEUE_SIZE = 50;
  private readonly UPLOAD_INTERVAL = 30000; // 30 seconds
  private readonly HEARTBEAT_INTERVAL = 15000; // 15 seconds

  constructor() {
    this.startUploadTimer();
    this.startHeartbeat();
  }

  /**
   * Start a new streaming session
   */
  startSession(contentId: string, userId?: string, device?: DeviceInfo): string {
    const sessionId = this.generateSessionId();

    this.currentSession = {
      id: sessionId,
      contentId,
      userId,
      startTime: Date.now(),
      duration: 0,
      totalPlayTime: 0,
      bufferingTime: 0,
      seekCount: 0,
      qualityChanges: [],
      errors: [],
      device: device || this.detectDevice(),
      network: this.detectNetwork(),
      completed: false,
      completionPercentage: 0,
    };

    this.trackEvent('session_start', {
      contentId,
      userId,
      device: this.currentSession.device,
      network: this.currentSession.network,
    });

    return sessionId;
  }

  /**
   * End the current streaming session
   */
  endSession(reason: 'completed' | 'user_exit' | 'error' = 'user_exit'): void {
    if (!this.currentSession) return;

    this.currentSession.endTime = Date.now();
    this.currentSession.duration = this.currentSession.endTime - this.currentSession.startTime;
    this.currentSession.completed = reason === 'completed';

    this.trackEvent('session_end', {
      reason,
      duration: this.currentSession.duration,
      totalPlayTime: this.currentSession.totalPlayTime,
      bufferingTime: this.currentSession.bufferingTime,
      seekCount: this.currentSession.seekCount,
      qualityChanges: this.currentSession.qualityChanges.length,
      errors: this.currentSession.errors.length,
      completed: this.currentSession.completed,
      completionPercentage: this.currentSession.completionPercentage,
    });

    // Force upload session data
    this.uploadQueuedEvents();

    this.currentSession = null;
  }

  /**
   * Track a streaming event
   */
  trackEvent(type: StreamingEventType, data: Record<string, any> = {}): void {
    if (!this.currentSession) return;

    const event: StreamingEvent = {
      id: this.generateEventId(),
      type,
      timestamp: Date.now(),
      sessionId: this.currentSession.id,
      contentId: this.currentSession.contentId,
      userId: this.currentSession.userId,
      data,
    };

    this.events.push(event);
    this.eventQueue.push(event);

    // Update session metrics based on event
    this.updateSessionMetrics(event);

    // Upload if queue is full
    if (this.eventQueue.length >= this.MAX_QUEUE_SIZE) {
      this.uploadQueuedEvents();
    }
  }

  /**
   * Track playback start
   */
  trackPlay(currentTime: number): void {
    this.trackEvent('play', { currentTime });
  }

  /**
   * Track playback pause
   */
  trackPause(currentTime: number, duration: number): void {
    this.trackEvent('pause', { currentTime, duration });
  }

  /**
   * Track seek operation
   */
  trackSeek(from: number, to: number, duration: number): void {
    if (this.currentSession) {
      this.currentSession.seekCount++;
    }

    this.trackEvent('seek', { from, to, duration });
  }

  /**
   * Track buffering events
   */
  trackBuffering(started: boolean, currentTime: number): void {
    this.trackEvent(started ? 'buffer_start' : 'buffer_end', { currentTime });
  }

  /**
   * Track quality changes
   */
  trackQualityChange(from: string | null, to: string, reason: QualityChangeEvent['reason'], bandwidth?: number): void {
    const qualityChange: QualityChangeEvent = {
      timestamp: Date.now(),
      from,
      to,
      reason,
      bandwidth,
    };

    if (this.currentSession) {
      this.currentSession.qualityChanges.push(qualityChange);
    }

    this.trackEvent('quality_change', qualityChange);
  }

  /**
   * Track errors
   */
  trackError(code: string, message: string, severity: ErrorEvent['severity'] = 'error', recoverable = true, context?: Record<string, any>): void {
    const error: ErrorEvent = {
      timestamp: Date.now(),
      code,
      message,
      severity,
      recoverable,
      context,
    };

    if (this.currentSession) {
      this.currentSession.errors.push(error);
    }

    this.trackEvent('error', error);

    // Log to console for debugging
    const logLevel = severity === 'fatal' ? 'error' : severity === 'error' ? 'warn' : 'info';
    console[logLevel](`Streaming ${severity}:`, { code, message, context });
  }

  /**
   * Track casting events
   */
  trackCast(started: boolean, deviceName?: string, deviceType?: string): void {
    this.trackEvent(started ? 'cast_start' : 'cast_end', {
      deviceName,
      deviceType,
    });
  }

  /**
   * Track fullscreen events
   */
  trackFullscreen(entered: boolean): void {
    this.trackEvent(entered ? 'fullscreen_enter' : 'fullscreen_exit', {});
  }

  /**
   * Track subtitle changes
   */
  trackSubtitleChange(language: string | null, enabled: boolean): void {
    this.trackEvent('subtitle_change', { language, enabled });
  }

  /**
   * Update playback progress
   */
  updateProgress(currentTime: number, duration: number): void {
    if (!this.currentSession || duration <= 0) return;

    this.currentSession.completionPercentage = Math.min(100, (currentTime / duration) * 100);
  }

  /**
   * Get current session metrics
   */
  getCurrentSessionMetrics(): Partial<StreamingSession> {
    return this.currentSession ? { ...this.currentSession } : {};
  }

  /**
   * Get aggregated analytics metrics
   */
  getAnalyticsMetrics(): Partial<AnalyticsMetrics> {
    return { ...this.metrics };
  }

  /**
   * Export session data for debugging
   */
  exportSessionData(): {
    session: StreamingSession | null;
    events: StreamingEvent[];
    metrics: Partial<AnalyticsMetrics>;
  } {
    return {
      session: this.currentSession,
      events: [...this.events],
      metrics: { ...this.metrics },
    };
  }

  // Private methods

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private detectDevice(): DeviceInfo {
    const ua = navigator.userAgent;
    const screen = window.screen;

    return {
      type: this.getDeviceType(),
      os: this.getOS(),
      browser: this.getBrowser(),
      version: this.getBrowserVersion(),
      screenResolution: `${screen.width}x${screen.height}`,
      isSmartTV: this.isSmartTV(),
      isLowEnd: this.isLowEndDevice(),
    };
  }

  private detectNetwork(): NetworkInfo {
    const connection = (navigator as any).connection ||
                      (navigator as any).mozConnection ||
                      (navigator as any).webkitConnection;

    if (!connection) {
      return {};
    }

    return {
      connectionType: connection.type,
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData,
    };
  }

  private getDeviceType(): string {
    const ua = navigator.userAgent.toLowerCase();

    if (this.isSmartTV()) return 'tv';
    if (/tablet|ipad/i.test(ua)) return 'tablet';
    if (/mobile|iphone|android/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  private getOS(): string {
    const ua = navigator.userAgent;

    if (/Windows NT/i.test(ua)) return 'Windows';
    if (/Mac OS X/i.test(ua)) return 'macOS';
    if (/Android/i.test(ua)) return 'Android';
    if (/iPhone|iPad/i.test(ua)) return 'iOS';
    if (/Linux/i.test(ua)) return 'Linux';
    if (/Tizen/i.test(ua)) return 'Tizen';
    if (/webOS/i.test(ua)) return 'webOS';

    return 'Unknown';
  }

  private getBrowser(): string {
    const ua = navigator.userAgent;

    if (/Chrome/i.test(ua) && !/Edge|OPR/i.test(ua)) return 'Chrome';
    if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
    if (/Firefox/i.test(ua)) return 'Firefox';
    if (/Edge/i.test(ua)) return 'Edge';
    if (/OPR|Opera/i.test(ua)) return 'Opera';

    return 'Unknown';
  }

  private getBrowserVersion(): string {
    const ua = navigator.userAgent;
    const match = ua.match(/(chrome|safari|firefox|edge|opera)\/(\d+)/i);
    return match ? match[2] : 'Unknown';
  }

  private isSmartTV(): boolean {
    const ua = navigator.userAgent.toLowerCase();
    return /smart-?tv|tizen|webos|hbbtv/i.test(ua);
  }

  private isLowEndDevice(): boolean {
    // Simple heuristic based on available information
    const memory = (navigator as any).deviceMemory;
    if (memory && memory <= 2) return true;

    const cores = navigator.hardwareConcurrency;
    if (cores && cores <= 2) return true;

    return false;
  }

  private updateSessionMetrics(event: StreamingEvent): void {
    if (!this.currentSession) return;

    switch (event.type) {
      case 'play':
        // Start tracking play time
        break;

      case 'pause':
        // Update total play time
        break;

      case 'buffer_start':
        // Start tracking buffering time
        break;

      case 'buffer_end':
        // End tracking buffering time
        break;
    }
  }

  private startUploadTimer(): void {
    this.uploadTimer = setInterval(() => {
      this.uploadQueuedEvents();
    }, this.UPLOAD_INTERVAL);
  }

  private startHeartbeat(): void {
    setInterval(() => {
      if (this.currentSession) {
        this.trackEvent('heartbeat', {
          sessionDuration: Date.now() - this.currentSession.startTime,
        });
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  private async uploadQueuedEvents(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analytics/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events }),
      });
    } catch (error) {
      console.error('Failed to upload analytics events:', error);
      // Re-queue events for retry
      this.eventQueue.unshift(...events);
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.currentSession) {
      this.endSession('user_exit');
    }

    if (this.uploadTimer) {
      clearInterval(this.uploadTimer);
    }

    // Final upload
    this.uploadQueuedEvents();
  }
}

// Export singleton instance
export const streamingAnalytics = new StreamingAnalytics();