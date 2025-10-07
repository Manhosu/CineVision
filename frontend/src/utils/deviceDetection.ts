export interface DeviceCapabilities {
  type: 'desktop' | 'mobile' | 'tablet' | 'tv' | 'unknown';
  os: string;
  browser: string;
  version: string;
  isSmartTV: boolean;
  isLowEnd: boolean;
  supportsHLS: boolean;
  supportsWebGL: boolean;
  supportsMSE: boolean;
  supportsWebAssembly: boolean;
  maxResolution: string;
  ram: number; // GB estimate
  connectionType?: 'slow-2g' | '2g' | '3g' | '4g' | 'wifi' | 'unknown';
  screenSize: {
    width: number;
    height: number;
    diagonal: number; // inches estimate
  };
  inputMethods: ('touch' | 'mouse' | 'keyboard' | 'remote')[];
  preferredQuality: '240p' | '360p' | '480p' | '720p' | '1080p' | '1440p' | '2160p';
  bufferSize: number; // seconds
  maxBitrate: number; // kbps
}

export class DeviceDetector {
  private userAgent: string;
  private screen: { width: number; height: number };
  private devicePixelRatio: number;

  constructor() {
    this.userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    this.screen = typeof window !== 'undefined'
      ? { width: window.screen.width, height: window.screen.height }
      : { width: 1920, height: 1080 };
    this.devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
  }

  detectCapabilities(): DeviceCapabilities {
    const type = this.detectDeviceType();
    const os = this.detectOS();
    const browser = this.detectBrowser();
    const version = this.detectBrowserVersion();
    const isSmartTV = this.detectSmartTV();
    const isLowEnd = this.detectLowEndDevice();
    const connectionType = this.detectConnectionType();

    return {
      type,
      os,
      browser,
      version,
      isSmartTV,
      isLowEnd,
      supportsHLS: this.checkHLSSupport(),
      supportsWebGL: this.checkWebGLSupport(),
      supportsMSE: this.checkMSESupport(),
      supportsWebAssembly: this.checkWebAssemblySupport(),
      maxResolution: this.determineMaxResolution(),
      ram: this.estimateRAM(),
      connectionType,
      screenSize: this.calculateScreenSize(),
      inputMethods: this.detectInputMethods(),
      preferredQuality: this.recommendQuality(),
      bufferSize: this.recommendBufferSize(),
      maxBitrate: this.recommendMaxBitrate(),
    };
  }

  private detectDeviceType(): DeviceCapabilities['type'] {
    const ua = this.userAgent.toLowerCase();

    // Smart TV detection
    if (this.detectSmartTV()) {
      return 'tv';
    }

    // Tablet detection
    if (/tablet|ipad|playbook|silk/i.test(ua) ||
        (/android/i.test(ua) && !/mobile/i.test(ua))) {
      return 'tablet';
    }

    // Mobile detection
    if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(ua)) {
      return 'mobile';
    }

    // Desktop
    if (/windows|mac|linux/i.test(ua)) {
      return 'desktop';
    }

    return 'unknown';
  }

  private detectOS(): string {
    const ua = this.userAgent;

    if (/Windows NT 10.0/i.test(ua)) return 'Windows 10';
    if (/Windows NT 6.3/i.test(ua)) return 'Windows 8.1';
    if (/Windows NT 6.2/i.test(ua)) return 'Windows 8';
    if (/Windows NT 6.1/i.test(ua)) return 'Windows 7';
    if (/Windows/i.test(ua)) return 'Windows';

    if (/Mac OS X 10[._]\d+/i.test(ua)) {
      const version = ua.match(/Mac OS X 10[._](\d+)/i);
      return `macOS ${version ? version[1] : 'Unknown'}`;
    }
    if (/Mac/i.test(ua)) return 'macOS';

    if (/Android (\d+\.?\d*)/i.test(ua)) {
      const version = ua.match(/Android (\d+\.?\d*)/i);
      return `Android ${version ? version[1] : 'Unknown'}`;
    }

    if (/iPhone OS (\d+_?\d*)/i.test(ua)) {
      const version = ua.match(/iPhone OS (\d+_?\d*)/i);
      return `iOS ${version ? version[1].replace('_', '.') : 'Unknown'}`;
    }
    if (/iPad.*OS (\d+_?\d*)/i.test(ua)) {
      const version = ua.match(/iPad.*OS (\d+_?\d*)/i);
      return `iPadOS ${version ? version[1].replace('_', '.') : 'Unknown'}`;
    }

    if (/Linux/i.test(ua)) return 'Linux';
    if (/CrOS/i.test(ua)) return 'Chrome OS';

    // Smart TV OSes
    if (/Tizen/i.test(ua)) return 'Tizen (Samsung TV)';
    if (/webOS/i.test(ua)) return 'webOS (LG TV)';
    if (/BRAVIA/i.test(ua)) return 'Android TV (Sony)';
    if (/Roku/i.test(ua)) return 'Roku OS';
    if (/AppleTV/i.test(ua)) return 'tvOS';

    return 'Unknown';
  }

  private detectBrowser(): string {
    const ua = this.userAgent;

    if (/Chrome\/(\d+)/i.test(ua) && !/Edge|OPR|Samsung/i.test(ua)) return 'Chrome';
    if (/Safari\/(\d+)/i.test(ua) && !/Chrome|CriOS/i.test(ua)) return 'Safari';
    if (/Firefox\/(\d+)/i.test(ua)) return 'Firefox';
    if (/Edge\/(\d+)/i.test(ua)) return 'Edge Legacy';
    if (/Edg\/(\d+)/i.test(ua)) return 'Edge Chromium';
    if (/OPR\/(\d+)/i.test(ua)) return 'Opera';
    if (/SamsungBrowser\/(\d+)/i.test(ua)) return 'Samsung Internet';
    if (/MSIE|Trident/i.test(ua)) return 'Internet Explorer';

    return 'Unknown';
  }

  private detectBrowserVersion(): string {
    const ua = this.userAgent;

    const patterns = [
      /Chrome\/(\d+)/i,
      /Safari\/(\d+)/i,
      /Firefox\/(\d+)/i,
      /Edge\/(\d+)/i,
      /Edg\/(\d+)/i,
      /OPR\/(\d+)/i,
      /SamsungBrowser\/(\d+)/i,
    ];

    for (const pattern of patterns) {
      const match = ua.match(pattern);
      if (match) return match[1];
    }

    return 'Unknown';
  }

  private detectSmartTV(): boolean {
    const ua = this.userAgent.toLowerCase();

    const tvPatterns = [
      /smart-?tv/i,
      /tizen/i,
      /webos/i,
      /hbbtv/i,
      /roku/i,
      /crkey/i, // Chromecast
      /appletv/i,
      /googletv/i,
      /android.*tv/i,
      /bravia/i,
      /philips/i,
      /samsung.*tv/i,
      /lg.*tv/i,
      /panasonic/i,
      /viera/i,
    ];

    const isTV = tvPatterns.some(pattern => pattern.test(ua));

    // Also check screen size (TVs typically have large screens)
    const isLargeScreen = this.screen.width >= 1920 && this.screen.height >= 1080;

    // Check if it's a desktop with TV-like screen without touch support
    const noTouch = typeof window !== 'undefined' && !('ontouchstart' in window);
    const noMotion = typeof window !== 'undefined' && !window.DeviceMotionEvent;

    return isTV || (isLargeScreen && noTouch && noMotion);
  }

  private detectLowEndDevice(): boolean {
    const ram = this.estimateRAM();
    const isOldBrowser = this.isOldBrowser();
    const hasLimitedFeatures = !this.checkWebGLSupport() || !this.checkMSESupport();

    return ram <= 2 || isOldBrowser || hasLimitedFeatures;
  }

  private isOldBrowser(): boolean {
    const browser = this.detectBrowser();
    const version = parseInt(this.detectBrowserVersion(), 10);

    const minimumVersions = {
      'Chrome': 80,
      'Safari': 13,
      'Firefox': 75,
      'Edge Chromium': 80,
      'Edge Legacy': 18,
      'Samsung Internet': 10,
    };

    return version < (minimumVersions[browser as keyof typeof minimumVersions] || 999);
  }

  private checkHLSSupport(): boolean {
    if (typeof document === 'undefined') return false;

    const video = document.createElement('video');
    const canPlayHLS = video.canPlayType('application/vnd.apple.mpegurl') !== '';

    // Also check for MSE support (needed for HLS.js)
    const hasMSE = this.checkMSESupport();

    return canPlayHLS || hasMSE;
  }

  private checkWebGLSupport(): boolean {
    if (typeof document === 'undefined') return false;

    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!gl;
    } catch {
      return false;
    }
  }

  private checkMSESupport(): boolean {
    return typeof window !== 'undefined' &&
           !!(window.MediaSource || (window as any).WebKitMediaSource);
  }

  private checkWebAssemblySupport(): boolean {
    return typeof WebAssembly !== 'undefined' &&
           typeof WebAssembly.instantiate === 'function';
  }

  private estimateRAM(): number {
    if (typeof navigator === 'undefined') return 4;

    // Use Device Memory API if available
    if ('deviceMemory' in navigator) {
      return (navigator as any).deviceMemory;
    }

    // Estimate based on screen resolution and device type
    const pixelCount = this.screen.width * this.screen.height;

    if (pixelCount >= 3840 * 2160) return 8; // 4K+ likely has 8GB+
    if (pixelCount >= 2560 * 1440) return 6; // 1440p likely has 6GB+
    if (pixelCount >= 1920 * 1080) return 4; // 1080p likely has 4GB+
    if (pixelCount >= 1366 * 768) return 2;  // 720p likely has 2GB+

    return 1; // Very low-end devices
  }

  private detectConnectionType(): DeviceCapabilities['connectionType'] {
    if (typeof navigator === 'undefined') return 'unknown';

    const connection = (navigator as any).connection ||
                      (navigator as any).mozConnection ||
                      (navigator as any).webkitConnection;

    if (!connection) return 'unknown';

    const effectiveType = connection.effectiveType;
    if (effectiveType) return effectiveType;

    // Fallback to connection type
    const type = connection.type;
    if (type === 'wifi' || type === 'ethernet') return 'wifi';
    if (type === 'cellular') return '4g'; // Assume 4G if not specified

    return 'unknown';
  }

  private calculateScreenSize(): DeviceCapabilities['screenSize'] {
    // Estimate diagonal screen size in inches
    const widthInches = this.screen.width / (this.devicePixelRatio * 96); // 96 DPI standard
    const heightInches = this.screen.height / (this.devicePixelRatio * 96);
    const diagonal = Math.sqrt(widthInches ** 2 + heightInches ** 2);

    return {
      width: this.screen.width,
      height: this.screen.height,
      diagonal: Math.round(diagonal * 10) / 10,
    };
  }

  private detectInputMethods(): DeviceCapabilities['inputMethods'] {
    const methods: DeviceCapabilities['inputMethods'] = [];

    if (typeof window === 'undefined') return ['keyboard', 'mouse'];

    // Touch support
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      methods.push('touch');
    }

    // Mouse support (assume if not touch-only mobile)
    if (!methods.includes('touch') || this.detectDeviceType() !== 'mobile') {
      methods.push('mouse');
    }

    // Keyboard (always available on desktop/TV)
    methods.push('keyboard');

    // Remote control (Smart TVs)
    if (this.detectSmartTV()) {
      methods.push('remote');
    }

    return methods;
  }

  private determineMaxResolution(): string {
    const { width, height } = this.screen;
    const ram = this.estimateRAM();
    const isLowEnd = this.detectLowEndDevice();

    // Limit resolution based on device capabilities
    if (isLowEnd || ram <= 1) return '480p';
    if (ram <= 2) return '720p';

    // Base on screen resolution
    if (width >= 3840 && height >= 2160) return '2160p'; // 4K
    if (width >= 2560 && height >= 1440) return '1440p'; // 1440p
    if (width >= 1920 && height >= 1080) return '1080p'; // 1080p
    if (width >= 1280 && height >= 720) return '720p';   // 720p
    if (width >= 854 && height >= 480) return '480p';   // 480p

    return '360p'; // Very low resolution
  }

  private recommendQuality(): DeviceCapabilities['preferredQuality'] {
    const maxRes = this.determineMaxResolution();
    const connectionType = this.detectConnectionType();
    const isLowEnd = this.detectLowEndDevice();

    // Adjust based on connection
    if (connectionType === 'slow-2g' || connectionType === '2g') {
      return '240p';
    }
    if (connectionType === '3g') {
      return isLowEnd ? '360p' : '480p';
    }

    // Use max resolution for good connections
    return maxRes as DeviceCapabilities['preferredQuality'];
  }

  private recommendBufferSize(): number {
    const connectionType = this.detectConnectionType();
    const isLowEnd = this.detectLowEndDevice();
    const ram = this.estimateRAM();

    if (isLowEnd || ram <= 1) return 5;  // Very conservative
    if (ram <= 2) return 10; // Conservative

    // Adjust for connection type
    if (connectionType === 'slow-2g' || connectionType === '2g') return 15;
    if (connectionType === '3g') return 12;
    if (connectionType === '4g' || connectionType === 'wifi') return 8;

    return 10; // Default
  }

  private recommendMaxBitrate(): number {
    const connectionType = this.detectConnectionType();
    const quality = this.recommendQuality();

    const baseRates = {
      '240p': 400,   // 400 kbps
      '360p': 800,   // 800 kbps
      '480p': 1200,  // 1.2 Mbps
      '720p': 2500,  // 2.5 Mbps
      '1080p': 4000, // 4 Mbps
      '1440p': 8000, // 8 Mbps
      '2160p': 15000 // 15 Mbps
    };

    let maxRate = baseRates[quality];

    // Adjust for connection
    if (connectionType === 'slow-2g') maxRate = Math.min(maxRate, 200);
    if (connectionType === '2g') maxRate = Math.min(maxRate, 400);
    if (connectionType === '3g') maxRate = Math.min(maxRate, 1500);

    return maxRate;
  }
}

// Export singleton instance
export const deviceDetector = new DeviceDetector();