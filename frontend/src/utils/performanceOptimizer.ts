import { DeviceCapabilities, deviceDetector } from './deviceDetection';

export interface OptimizationSettings {
  // Video settings
  maxQuality: string;
  bufferSize: number;
  maxBitrate: number;
  adaptiveBitrate: boolean;

  // UI settings
  animationsEnabled: boolean;
  transitionsEnabled: boolean;
  shadowsEnabled: boolean;
  blurEffectsEnabled: boolean;

  // Performance settings
  prefetchEnabled: boolean;
  lazyLoadingEnabled: boolean;
  imageOptimization: boolean;
  cacheSize: number; // MB

  // Network settings
  retryAttempts: number;
  timeoutDuration: number;
  parallelRequests: number;
}

export class PerformanceOptimizer {
  private capabilities: DeviceCapabilities;
  private settings: OptimizationSettings;

  constructor() {
    this.capabilities = deviceDetector.detectCapabilities();
    this.settings = this.calculateOptimalSettings();
  }

  getSettings(): OptimizationSettings {
    return { ...this.settings };
  }

  getCapabilities(): DeviceCapabilities {
    return { ...this.capabilities };
  }

  /**
   * Calculate optimal settings based on device capabilities
   */
  private calculateOptimalSettings(): OptimizationSettings {
    const baseSettings: OptimizationSettings = {
      maxQuality: this.capabilities.preferredQuality,
      bufferSize: this.capabilities.bufferSize,
      maxBitrate: this.capabilities.maxBitrate,
      adaptiveBitrate: true,
      animationsEnabled: true,
      transitionsEnabled: true,
      shadowsEnabled: true,
      blurEffectsEnabled: true,
      prefetchEnabled: true,
      lazyLoadingEnabled: true,
      imageOptimization: true,
      cacheSize: 50, // 50MB default
      retryAttempts: 3,
      timeoutDuration: 30000, // 30 seconds
      parallelRequests: 4,
    };

    // Apply optimizations based on device type and capabilities
    if (this.capabilities.isLowEnd) {
      return this.applyLowEndOptimizations(baseSettings);
    }

    if (this.capabilities.isSmartTV) {
      return this.applySmartTVOptimizations(baseSettings);
    }

    if (this.capabilities.type === 'mobile') {
      return this.applyMobileOptimizations(baseSettings);
    }

    return baseSettings;
  }

  /**
   * Apply optimizations for low-end devices
   */
  private applyLowEndOptimizations(settings: OptimizationSettings): OptimizationSettings {
    return {
      ...settings,
      // Reduce video quality
      maxQuality: this.capabilities.ram <= 1 ? '360p' : '480p',
      bufferSize: Math.max(settings.bufferSize, 15), // Larger buffer for stability
      maxBitrate: Math.min(settings.maxBitrate, 1000), // Cap bitrate

      // Disable expensive visual effects
      animationsEnabled: false,
      transitionsEnabled: false,
      shadowsEnabled: false,
      blurEffectsEnabled: false,

      // Conservative performance settings
      prefetchEnabled: false,
      imageOptimization: true,
      cacheSize: 20, // Smaller cache

      // More conservative network settings
      retryAttempts: 5,
      timeoutDuration: 45000, // Longer timeout
      parallelRequests: 2, // Fewer parallel requests
    };
  }

  /**
   * Apply optimizations for Smart TVs
   */
  private applySmartTVOptimizations(settings: OptimizationSettings): OptimizationSettings {
    return {
      ...settings,
      // Optimize for TV viewing
      maxQuality: this.capabilities.maxResolution,
      bufferSize: Math.min(settings.bufferSize, 8), // Smaller buffer, better connection

      // Enable all visual effects for better experience
      animationsEnabled: true,
      transitionsEnabled: true,
      shadowsEnabled: true,
      blurEffectsEnabled: true,

      // Aggressive prefetching for smooth experience
      prefetchEnabled: true,
      cacheSize: 100, // Larger cache

      // TV-optimized network settings
      retryAttempts: 4,
      timeoutDuration: 25000,
      parallelRequests: 6, // More parallel requests
    };
  }

  /**
   * Apply optimizations for mobile devices
   */
  private applyMobileOptimizations(settings: OptimizationSettings): OptimizationSettings {
    const isLowRAM = this.capabilities.ram <= 2;
    const isSlowConnection = ['slow-2g', '2g', '3g'].includes(this.capabilities.connectionType || '');

    return {
      ...settings,
      // Mobile-appropriate quality
      maxQuality: isSlowConnection ? '480p' : settings.maxQuality,
      bufferSize: isSlowConnection ? 20 : 12, // Adjust for connection
      maxBitrate: isSlowConnection ? 800 : settings.maxBitrate,

      // Conditional effects based on device power
      animationsEnabled: !isLowRAM,
      transitionsEnabled: true, // Keep for better UX
      shadowsEnabled: !isLowRAM,
      blurEffectsEnabled: !isLowRAM,

      // Mobile-optimized performance
      prefetchEnabled: !isSlowConnection,
      lazyLoadingEnabled: true, // Always enable on mobile
      imageOptimization: true,
      cacheSize: isLowRAM ? 20 : 40,

      // Mobile network considerations
      retryAttempts: isSlowConnection ? 6 : 3,
      timeoutDuration: isSlowConnection ? 60000 : 25000,
      parallelRequests: isSlowConnection ? 2 : 4,
    };
  }

  /**
   * Get optimized Shaka Player configuration
   */
  getShakaConfig(): any {
    const config = {
      streaming: {
        rebufferingGoal: this.settings.bufferSize,
        bufferingGoal: this.settings.bufferSize * 2,
        bufferBehind: Math.min(30, this.settings.bufferSize * 3),
        maxBufferBehind: Math.min(60, this.settings.bufferSize * 6),
        retryParameters: {
          timeout: this.settings.timeoutDuration,
          maxAttempts: this.settings.retryAttempts,
          baseDelay: 1000,
          backoffFactor: 2,
        },
        stallEnabled: true,
        stallThreshold: 1, // 1 second
        stallSkip: 0.1, // Skip 100ms on stall
        useNativeHlsOnSafari: true,
      },

      abr: {
        enabled: this.settings.adaptiveBitrate,
        useNetworkInformation: true,
        defaultBandwidthEstimate: this.getInitialBandwidthEstimate(),
        switchInterval: this.getABRSwitchInterval(),
        bandwidthUpgradeTarget: this.getBandwidthUpgradeTarget(),
        bandwidthDowngradeTarget: 0.9,
        restrictions: {
          maxBandwidth: this.settings.maxBitrate * 1000, // Convert to bps
          maxHeight: this.getMaxHeight(),
          maxWidth: this.getMaxWidth(),
        },
      },

      manifest: {
        retryParameters: {
          timeout: this.settings.timeoutDuration,
          maxAttempts: this.settings.retryAttempts,
          baseDelay: 1000,
          backoffFactor: 2,
        },
        availabilityWindowOverride: this.capabilities.isLowEnd ? 30 : 60,
      },

      drm: {
        retryParameters: {
          timeout: this.settings.timeoutDuration,
          maxAttempts: this.settings.retryAttempts,
          baseDelay: 1000,
          backoffFactor: 2,
        },
      },
    };

    // Low-end device specific optimizations
    if (this.capabilities.isLowEnd) {
      config.streaming.bufferBehind = 15;
      config.streaming.maxBufferBehind = 30;
      config.abr.switchInterval = 15; // Slower switching
    }

    return config;
  }

  /**
   * Get CSS optimization classes
   */
  getCSSOptimizationClasses(): string[] {
    const classes: string[] = [];

    if (!this.settings.animationsEnabled) {
      classes.push('no-animations');
    }

    if (!this.settings.transitionsEnabled) {
      classes.push('no-transitions');
    }

    if (!this.settings.shadowsEnabled) {
      classes.push('no-shadows');
    }

    if (!this.settings.blurEffectsEnabled) {
      classes.push('no-blur-effects');
    }

    if (this.capabilities.isLowEnd) {
      classes.push('low-end-device');
    }

    if (this.capabilities.isSmartTV) {
      classes.push('tv-device');
    }

    return classes;
  }

  /**
   * Get image optimization settings
   */
  getImageOptimizationSettings(): {
    quality: number;
    format: 'webp' | 'jpeg' | 'auto';
    sizes: string[];
    lazy: boolean;
  } {
    return {
      quality: this.capabilities.isLowEnd ? 70 : 85,
      format: this.capabilities.supportsWebGL ? 'webp' : 'jpeg',
      sizes: this.getImageSizes(),
      lazy: this.settings.lazyLoadingEnabled,
    };
  }

  private getInitialBandwidthEstimate(): number {
    const connectionType = this.capabilities.connectionType;

    switch (connectionType) {
      case 'slow-2g': return 100000; // 100 kbps
      case '2g': return 300000; // 300 kbps
      case '3g': return 1000000; // 1 Mbps
      case '4g': return 5000000; // 5 Mbps
      case 'wifi': return 10000000; // 10 Mbps
      default: return 1000000; // Conservative 1 Mbps
    }
  }

  private getABRSwitchInterval(): number {
    if (this.capabilities.isLowEnd) return 15;
    if (this.capabilities.connectionType === 'wifi') return 6;
    return 8;
  }

  private getBandwidthUpgradeTarget(): number {
    if (this.capabilities.isLowEnd) return 0.95; // Very conservative
    if (this.capabilities.connectionType === 'wifi') return 0.75; // Aggressive
    return 0.85; // Default
  }

  private getMaxHeight(): number {
    const qualityMap = {
      '240p': 240,
      '360p': 360,
      '480p': 480,
      '720p': 720,
      '1080p': 1080,
      '1440p': 1440,
      '2160p': 2160,
    };

    return qualityMap[this.settings.maxQuality as keyof typeof qualityMap] || 720;
  }

  private getMaxWidth(): number {
    const qualityMap = {
      '240p': 426,
      '360p': 640,
      '480p': 854,
      '720p': 1280,
      '1080p': 1920,
      '1440p': 2560,
      '2160p': 3840,
    };

    return qualityMap[this.settings.maxQuality as keyof typeof qualityMap] || 1280;
  }

  private getImageSizes(): string[] {
    const { width } = this.capabilities.screenSize;

    if (width >= 3840) return ['400w', '600w', '800w', '1200w', '1600w'];
    if (width >= 1920) return ['300w', '500w', '700w', '1000w'];
    if (width >= 1280) return ['200w', '400w', '600w', '800w'];
    if (width >= 768) return ['150w', '300w', '450w', '600w'];

    return ['100w', '200w', '300w', '400w'];
  }

  /**
   * Monitor performance and adjust settings dynamically
   */
  startPerformanceMonitoring(callback: (metrics: PerformanceMetrics) => void): void {
    if (typeof window === 'undefined') return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const metrics = this.calculatePerformanceMetrics(entries);
      callback(metrics);
    });

    observer.observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint'] });

    // Memory monitoring if available
    if ('memory' in performance) {
      setInterval(() => {
        const memInfo = (performance as any).memory;
        if (memInfo.usedJSHeapSize > memInfo.jsHeapSizeLimit * 0.9) {
          // High memory usage detected
          callback({
            memoryPressure: true,
            recommendation: 'reduce_quality',
          } as any);
        }
      }, 30000); // Check every 30 seconds
    }
  }

  private calculatePerformanceMetrics(entries: PerformanceEntry[]): PerformanceMetrics {
    const metrics: PerformanceMetrics = {
      loadTime: 0,
      renderTime: 0,
      memoryUsage: 0,
      frameRate: 60, // Assume 60fps initially
      recommendations: [],
    };

    entries.forEach(entry => {
      if (entry.entryType === 'navigation') {
        const navEntry = entry as PerformanceNavigationTiming;
        metrics.loadTime = navEntry.loadEventEnd - navEntry.navigationStart;
      }

      if (entry.entryType === 'largest-contentful-paint') {
        metrics.renderTime = entry.startTime;
      }
    });

    // Generate recommendations based on metrics
    if (metrics.loadTime > 5000) {
      metrics.recommendations.push('Consider reducing initial quality');
    }

    if (metrics.renderTime > 2500) {
      metrics.recommendations.push('Consider disabling visual effects');
    }

    return metrics;
  }
}

export interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  memoryUsage: number;
  frameRate: number;
  memoryPressure?: boolean;
  recommendation?: string;
  recommendations: string[];
}

// Export singleton instance
export const performanceOptimizer = new PerformanceOptimizer();