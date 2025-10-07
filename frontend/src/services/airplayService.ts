'use client';

import { CastDevice } from '@/types/video';

declare global {
  interface HTMLVideoElement {
    webkitShowPlaybackTargetPicker?: () => void;
    webkitCurrentPlaybackTargetIsWireless?: boolean;
    webkitPlaybackTargetAvailabilityChanged?: (event: Event) => void;
  }

  interface Window {
    WebKitPlaybackTargetAvailabilityEvent?: any;
  }
}

export interface AirPlayServiceConfig {
  enableAutoDetection?: boolean;
  showNativeButton?: boolean;
}

export class AirPlayService {
  private static instance: AirPlayService;
  private isAvailable = false;
  private isConnected = false;
  private currentVideoElement: HTMLVideoElement | null = null;
  private eventListeners: Map<string, Set<Function>> = new Map();
  private config: AirPlayServiceConfig;

  private constructor(config: AirPlayServiceConfig = {}) {
    this.config = {
      enableAutoDetection: true,
      showNativeButton: false,
      ...config,
    };

    this.initializeAirPlay();
  }

  static getInstance(config?: AirPlayServiceConfig): AirPlayService {
    if (!AirPlayService.instance) {
      AirPlayService.instance = new AirPlayService(config);
    }
    return AirPlayService.instance;
  }

  private initializeAirPlay(): void {
    // Check if running on Safari with AirPlay support
    this.isAvailable = this.checkAirPlaySupport();

    if (this.isAvailable) {
      this.emit('initialized', { success: true });
      console.log('AirPlay service initialized successfully');
    } else {
      console.log('AirPlay not available on this device/browser');
    }
  }

  private checkAirPlaySupport(): boolean {
    // Check for Safari and AirPlay APIs
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const hasAirPlayAPI = !!(window as any).WebKitPlaybackTargetAvailabilityEvent;
    const hasVideoAirPlay = 'webkitShowPlaybackTargetPicker' in document.createElement('video');

    return isSafari && (hasAirPlayAPI || hasVideoAirPlay);
  }

  /**
   * Setup AirPlay for a video element
   */
  setupVideoElement(videoElement: HTMLVideoElement): void {
    if (!this.isAvailable || !videoElement) {
      return;
    }

    this.currentVideoElement = videoElement;

    // Enable AirPlay on the video element
    videoElement.setAttribute('x-webkit-airplay', 'allow');

    // Listen for AirPlay availability changes
    if (videoElement.webkitPlaybackTargetAvailabilityChanged) {
      const handleAvailabilityChange = (event: any) => {
        const availability = event.availability;
        const hasTargets = availability === 'available';

        this.emit('availabilityChanged', { available: hasTargets });
      };

      videoElement.addEventListener('webkitplaybacktargetavailabilitychanged', handleAvailabilityChange);
    }

    // Listen for current playback target changes
    const handleCurrentTargetChange = () => {
      const isWireless = videoElement.webkitCurrentPlaybackTargetIsWireless || false;

      if (isWireless !== this.isConnected) {
        this.isConnected = isWireless;

        if (isWireless) {
          this.emit('connectionStart', {
            device: {
              id: 'airplay-device',
              name: 'AirPlay Device',
              type: 'airplay' as const,
              status: 'connected' as const,
              capabilities: ['video_out', 'audio_out', 'media_control'],
            },
          });
        } else {
          this.emit('connectionEnd', {});
        }
      }
    };

    videoElement.addEventListener('webkitcurrentplaybacktargetiswirelesschanged', handleCurrentTargetChange);

    // Show native AirPlay button if configured
    if (this.config.showNativeButton) {
      videoElement.setAttribute('controls', 'true');
      (videoElement as any).disableRemotePlayback = false;
    }

    this.emit('videoElementSetup', { element: videoElement });
  }

  /**
   * Show AirPlay device picker
   */
  showDevicePicker(): void {
    if (!this.isAvailable || !this.currentVideoElement) {
      this.emit('error', {
        code: 'AIRPLAY_NOT_AVAILABLE',
        message: 'AirPlay not available or no video element setup',
      });
      return;
    }

    try {
      if (this.currentVideoElement.webkitShowPlaybackTargetPicker) {
        this.currentVideoElement.webkitShowPlaybackTargetPicker();
        this.emit('devicePickerShown', {});
      } else {
        throw new Error('webkitShowPlaybackTargetPicker not available');
      }
    } catch (error) {
      this.emit('error', {
        code: 'PICKER_FAILED',
        message: `Failed to show AirPlay picker: ${error}`,
      });
    }
  }

  /**
   * Check if AirPlay is available
   */
  checkAvailability(): boolean {
    return this.isAvailable;
  }

  /**
   * Check if currently connected to AirPlay
   */
  isCurrentlyConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get current AirPlay device info (limited in Safari)
   */
  getCurrentDevice(): CastDevice | null {
    if (!this.isConnected) {
      return null;
    }

    return {
      id: 'airplay-device',
      name: 'AirPlay Device',
      type: 'airplay',
      status: 'connected',
      capabilities: ['video_out', 'audio_out', 'media_control'],
    };
  }

  /**
   * Enable picture-in-picture (related to AirPlay UX)
   */
  async enablePictureInPicture(): Promise<void> {
    if (!this.currentVideoElement) {
      throw new Error('No video element available');
    }

    try {
      if (this.currentVideoElement.requestPictureInPicture) {
        await this.currentVideoElement.requestPictureInPicture();
        this.emit('pipEntered', {});
      } else {
        throw new Error('Picture-in-Picture not supported');
      }
    } catch (error) {
      this.emit('error', {
        code: 'PIP_FAILED',
        message: `Failed to enter Picture-in-Picture: ${error}`,
      });
    }
  }

  /**
   * Disable picture-in-picture
   */
  async disablePictureInPicture(): Promise<void> {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        this.emit('pipExited', {});
      }
    } catch (error) {
      this.emit('error', {
        code: 'PIP_EXIT_FAILED',
        message: `Failed to exit Picture-in-Picture: ${error}`,
      });
    }
  }

  /**
   * Add custom AirPlay button to controls
   */
  createAirPlayButton(container: HTMLElement): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'airplay-button btn-icon';
    button.title = 'AirPlay';
    button.setAttribute('aria-label', 'Connect to AirPlay device');

    // AirPlay icon SVG
    button.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
        <path d="M6,22 L18,22 C19.1045695,22 20,21.1045695 20,20 L20,16 L18,16 L18,20 L6,20 L6,16 L4,16 L4,20 C4,21.1045695 4.8954305,22 6,22 Z M12,2 L12,2 C7.02943725,2 3,6.02943725 3,11 L5,11 C5,7.13400675 8.13400675,4 12,4 L12,4 C15.8659932,4 19,7.13400675 19,11 L21,11 C21,6.02943725 16.9705627,2 12,2 Z M16,11 L14,11 C14,12.1045695 13.1045695,13 12,13 C10.8954305,13 10,12.1045695 10,11 L8,11 C8,13.209139 9.790861,15 12,15 C14.209139,15 16,13.209139 16,11 Z M7.5,15 L16.5,15 L12,18.5 L7.5,15 Z"/>
      </svg>
    `;

    button.onclick = () => this.showDevicePicker();

    // Update button state based on connection
    const updateButtonState = () => {
      if (this.isConnected) {
        button.classList.add('connected');
        button.style.color = '#007AFF'; // iOS blue
        button.title = 'Connected to AirPlay';
      } else {
        button.classList.remove('connected');
        button.style.color = '';
        button.title = 'Connect to AirPlay device';
      }
    };

    this.on('connectionStart', updateButtonState);
    this.on('connectionEnd', updateButtonState);

    updateButtonState(); // Initial state
    container.appendChild(button);

    return button;
  }

  /**
   * Get device capabilities for AirPlay
   */
  getDeviceCapabilities(): string[] {
    return ['video_out', 'audio_out', 'media_control'];
  }

  /**
   * Handle video quality changes for AirPlay optimization
   */
  optimizeForAirPlay(videoElement: HTMLVideoElement): void {
    if (!this.isConnected || !videoElement) return;

    // AirPlay typically handles quality selection automatically
    // But we can optimize by removing very high bitrates that might cause issues
    console.log('Optimizing video stream for AirPlay');

    // This would be implemented based on your HLS setup
    // You might want to exclude 4K streams when casting to older Apple TVs
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
          console.error('Error in AirPlay event listener:', error);
        }
      });
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.currentVideoElement = null;
    this.eventListeners.clear();
  }

  /**
   * Get debug information about AirPlay availability
   */
  getDebugInfo(): {
    isAvailable: boolean;
    isConnected: boolean;
    userAgent: string;
    hasWebKitAPI: boolean;
    hasVideoMethods: boolean;
    currentElement: boolean;
  } {
    return {
      isAvailable: this.isAvailable,
      isConnected: this.isConnected,
      userAgent: navigator.userAgent,
      hasWebKitAPI: !!(window as any).WebKitPlaybackTargetAvailabilityEvent,
      hasVideoMethods: 'webkitShowPlaybackTargetPicker' in document.createElement('video'),
      currentElement: !!this.currentVideoElement,
    };
  }
}

// Export singleton instance
export const airplayService = AirPlayService.getInstance();