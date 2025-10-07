'use client';

import { CastDevice, CastSession } from '@/types/video';

declare global {
  interface Window {
    __onGCastApiAvailable: (isAvailable: boolean) => void;
    chrome: {
      cast: {
        isAvailable: boolean;
        initialize: (apiConfig: any, onInitSuccess: () => void, onInitError: (error: any) => void) => void;
        requestSession: (onRequestSessionSuccess: (session: any) => void, onRequestSessionError: (error: any) => void) => void;
        SessionRequest: new (appId: string, capabilities?: any[], timeout?: number) => any;
        AutoJoinPolicy: {
          TAB_AND_ORIGIN_SCOPED: string;
          ORIGIN_SCOPED: string;
          PAGE_SCOPED: string;
        };
        Capability: {
          VIDEO_OUT: string;
          AUDIO_OUT: string;
        };
        DefaultActionPolicy: {
          CREATE_SESSION: string;
          CAST_THIS_TAB: string;
        };
        ApiConfig: new (sessionRequest: any, sessionListener: (session: any) => void, receiverListener: (availability: string) => void, autoJoinPolicy?: string, defaultActionPolicy?: string) => any;
        media: {
          MediaInfo: new (contentId: string, contentType: string) => any;
          LoadRequest: new (mediaInfo: any) => any;
          GenericMediaMetadata: new () => any;
          MetadataType: {
            GENERIC: number;
            MOVIE: number;
            TV_SHOW: number;
          };
        };
        ReceiverAvailability: {
          AVAILABLE: string;
          UNAVAILABLE: string;
        };
      };
    };
  }
}

export interface ChromecastServiceConfig {
  applicationId?: string;
  autoJoinPolicy?: string;
  defaultActionPolicy?: string;
}

export interface MediaMetadata {
  title: string;
  subtitle?: string;
  description?: string;
  image?: string;
  duration?: number;
}

export class ChromecastService {
  private static instance: ChromecastService;
  private isInitialized = false;
  private currentSession: any = null;
  private currentMedia: any = null;
  private applicationId: string;
  private eventListeners: Map<string, Set<Function>> = new Map();

  private constructor(config: ChromecastServiceConfig = {}) {
    this.applicationId = config.applicationId || 'CC1AD845'; // Default Chromecast receiver
    this.initializeCastSDK();
  }

  static getInstance(config?: ChromecastServiceConfig): ChromecastService {
    if (!ChromecastService.instance) {
      ChromecastService.instance = new ChromecastService(config);
    }
    return ChromecastService.instance;
  }

  private initializeCastSDK(): void {
    // Set up the Cast API initialization callback
    window.__onGCastApiAvailable = (isAvailable: boolean) => {
      if (isAvailable) {
        this.setupCastSDK();
      } else {
        this.emit('error', { code: 'CAST_NOT_AVAILABLE', message: 'Google Cast API not available' });
      }
    };

    // Load Cast SDK if not already loaded
    if (!document.querySelector('script[src*="cast_sender"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
      script.async = true;
      document.head.appendChild(script);
    } else if (window.chrome?.cast?.isAvailable) {
      this.setupCastSDK();
    }
  }

  private setupCastSDK(): void {
    if (this.isInitialized || !window.chrome?.cast) return;

    try {
      const sessionRequest = new window.chrome.cast.SessionRequest(
        this.applicationId,
        [window.chrome.cast.Capability.VIDEO_OUT, window.chrome.cast.Capability.AUDIO_OUT]
      );

      const apiConfig = new window.chrome.cast.ApiConfig(
        sessionRequest,
        (session: any) => this.onSessionCreated(session),
        (availability: string) => this.onReceiverAvailabilityChanged(availability),
        window.chrome.cast.AutoJoinPolicy.TAB_AND_ORIGIN_SCOPED,
        window.chrome.cast.DefaultActionPolicy.CREATE_SESSION
      );

      window.chrome.cast.initialize(
        apiConfig,
        () => {
          this.isInitialized = true;
          this.emit('initialized', { success: true });
          console.log('Chromecast SDK initialized successfully');
        },
        (error: any) => {
          this.emit('error', { code: 'INIT_FAILED', message: 'Failed to initialize Cast SDK', error });
          console.error('Failed to initialize Cast SDK:', error);
        }
      );
    } catch (error) {
      this.emit('error', { code: 'SETUP_FAILED', message: 'Failed to setup Cast SDK', error });
      console.error('Failed to setup Cast SDK:', error);
    }
  }

  private onSessionCreated(session: any): void {
    this.currentSession = session;
    this.setupSessionListeners(session);
    this.emit('sessionCreated', { session: this.serializeSession(session) });
  }

  private onReceiverAvailabilityChanged(availability: string): void {
    const isAvailable = availability === window.chrome.cast.ReceiverAvailability.AVAILABLE;
    this.emit('receiverAvailabilityChanged', { available: isAvailable });
  }

  private setupSessionListeners(session: any): void {
    session.addUpdateListener((isAlive: boolean) => {
      if (!isAlive) {
        this.currentSession = null;
        this.currentMedia = null;
        this.emit('sessionEnded', {});
      }
    });

    session.addMediaListener((media: any) => {
      this.currentMedia = media;
      this.setupMediaListeners(media);
    });
  }

  private setupMediaListeners(media: any): void {
    media.addUpdateListener((isAlive: boolean) => {
      if (isAlive) {
        this.emit('mediaUpdate', {
          currentTime: media.currentTime,
          duration: media.media?.duration || 0,
          playerState: media.playerState,
          volume: media.volume?.level || 1,
          muted: media.volume?.muted || false,
        });
      } else {
        this.currentMedia = null;
        this.emit('mediaEnded', {});
      }
    });
  }

  private serializeSession(session: any): CastSession {
    return {
      id: session.sessionId,
      device: {
        id: session.receiver?.friendlyName || 'Unknown Device',
        name: session.receiver?.friendlyName || 'Chromecast',
        type: 'chromecast',
        status: 'connected',
        capabilities: ['video_out', 'audio_out', 'media_control'],
      },
      contentId: this.currentMedia?.media?.contentId || '',
      startTime: new Date(),
      status: this.currentMedia ? 'playing' : 'connected',
      position: this.currentMedia?.currentTime || 0,
      volume: this.currentMedia?.volume?.level || 1,
      muted: this.currentMedia?.volume?.muted || false,
      quality: 'auto', // Chromecast handles quality selection
    };
  }

  /**
   * Check if Cast SDK is available and initialized
   */
  isAvailable(): boolean {
    return this.isInitialized && !!window.chrome?.cast;
  }

  /**
   * Check if there are available Cast receivers
   */
  hasReceivers(): boolean {
    return this.isInitialized && !!this.currentSession;
  }

  /**
   * Request a Cast session (show Cast dialog)
   */
  async requestSession(): Promise<CastSession> {
    return new Promise((resolve, reject) => {
      if (!this.isInitialized) {
        reject(new Error('Cast SDK not initialized'));
        return;
      }

      window.chrome.cast.requestSession(
        (session: any) => {
          this.currentSession = session;
          this.setupSessionListeners(session);
          resolve(this.serializeSession(session));
        },
        (error: any) => {
          reject(new Error(`Failed to create Cast session: ${error.code}`));
        }
      );
    });
  }

  /**
   * Load media to the Cast receiver
   */
  async loadMedia(
    contentUrl: string,
    contentType: string,
    metadata: MediaMetadata,
    startTime: number = 0
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.currentSession) {
        reject(new Error('No active Cast session'));
        return;
      }

      try {
        // Create media info
        const mediaInfo = new window.chrome.cast.media.MediaInfo(contentUrl, contentType);

        // Set up metadata
        const genericMetadata = new window.chrome.cast.media.GenericMediaMetadata();
        genericMetadata.title = metadata.title;
        genericMetadata.subtitle = metadata.subtitle || '';

        if (metadata.image) {
          genericMetadata.images = [{
            url: metadata.image,
          }];
        }

        mediaInfo.metadata = genericMetadata;
        mediaInfo.duration = metadata.duration;

        // Create load request
        const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
        request.currentTime = startTime;
        request.autoplay = true;

        // Load media
        this.currentSession.loadMedia(
          request,
          (media: any) => {
            this.currentMedia = media;
            this.setupMediaListeners(media);
            this.emit('mediaLoaded', { media: mediaInfo });
            resolve();
          },
          (error: any) => {
            reject(new Error(`Failed to load media: ${error.code}`));
          }
        );
      } catch (error) {
        reject(new Error(`Failed to create media request: ${error}`));
      }
    });
  }

  /**
   * Control media playback
   */
  async play(): Promise<void> {
    return this.sendMediaCommand('play');
  }

  async pause(): Promise<void> {
    return this.sendMediaCommand('pause');
  }

  async stop(): Promise<void> {
    return this.sendMediaCommand('stop');
  }

  async seek(time: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.currentMedia) {
        reject(new Error('No active media'));
        return;
      }

      const request = new (window.chrome.cast.media as any).SeekRequest();
      request.currentTime = time;

      this.currentMedia.seek(request,
        () => resolve(),
        (error: any) => reject(new Error(`Seek failed: ${error.code}`))
      );
    });
  }

  async setVolume(level: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.currentSession) {
        reject(new Error('No active session'));
        return;
      }

      const request = new (window.chrome.cast as any).VolumeRequest(level);

      this.currentSession.setReceiverVolumeLevel(level,
        () => resolve(),
        (error: any) => reject(new Error(`Volume change failed: ${error.code}`))
      );
    });
  }

  async mute(): Promise<void> {
    return this.setMuted(true);
  }

  async unmute(): Promise<void> {
    return this.setMuted(false);
  }

  private async setMuted(muted: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.currentSession) {
        reject(new Error('No active session'));
        return;
      }

      this.currentSession.setReceiverMuted(muted,
        () => resolve(),
        (error: any) => reject(new Error(`Mute change failed: ${error.code}`))
      );
    });
  }

  private async sendMediaCommand(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.currentMedia) {
        reject(new Error('No active media'));
        return;
      }

      const method = this.currentMedia[command];
      if (typeof method !== 'function') {
        reject(new Error(`Media command '${command}' not supported`));
        return;
      }

      method.call(this.currentMedia, null,
        () => resolve(),
        (error: any) => reject(new Error(`${command} failed: ${error.code}`))
      );
    });
  }

  /**
   * End the current Cast session
   */
  async endSession(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.currentSession) {
        resolve();
        return;
      }

      this.currentSession.stop(
        () => {
          this.currentSession = null;
          this.currentMedia = null;
          this.emit('sessionEnded', {});
          resolve();
        },
        (error: any) => {
          reject(new Error(`Failed to end session: ${error.code}`));
        }
      );
    });
  }

  /**
   * Get current session info
   */
  getCurrentSession(): CastSession | null {
    return this.currentSession ? this.serializeSession(this.currentSession) : null;
  }

  /**
   * Get current media status
   */
  getMediaStatus(): {
    currentTime: number;
    duration: number;
    playerState: string;
    volume: number;
    muted: boolean;
  } | null {
    if (!this.currentMedia) return null;

    return {
      currentTime: this.currentMedia.currentTime || 0,
      duration: this.currentMedia.media?.duration || 0,
      playerState: this.currentMedia.playerState || 'IDLE',
      volume: this.currentMedia.volume?.level || 1,
      muted: this.currentMedia.volume?.muted || false,
    };
  }

  // Event system
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in Cast event listener:', error);
        }
      });
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.currentSession) {
      this.endSession().catch(console.error);
    }
    this.eventListeners.clear();
  }
}

// Export singleton instance
export const chromecastService = ChromecastService.getInstance();