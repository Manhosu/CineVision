'use client';

import { useEffect, useState, useCallback } from 'react';

interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLowEnd: boolean;
  isTV: boolean;
  connectionType: string;
  effectiveType: string;
  memory: number;
  cores: number;
}

interface PerformanceSettings {
  imageQuality: 'low' | 'medium' | 'high';
  animationsEnabled: boolean;
  preloadEnabled: boolean;
  lazyLoadOffset: number;
  maxConcurrentImages: number;
  cacheSize: number;
}

export function usePerformanceOptimization() {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isLowEnd: false,
    isTV: false,
    connectionType: '4g',
    effectiveType: '4g',
    memory: 4,
    cores: 4
  });

  const [settings, setSettings] = useState<PerformanceSettings>({
    imageQuality: 'high',
    animationsEnabled: true,
    preloadEnabled: true,
    lazyLoadOffset: 100,
    maxConcurrentImages: 6,
    cacheSize: 50
  });

  const [isSlowConnection, setIsSlowConnection] = useState(false);

  // Detect device capabilities
  const detectDevice = useCallback(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const { screen, deviceMemory, hardwareConcurrency } = navigator as any;

    // Device type detection
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(userAgent);
    const isTV = /smart-tv|tizen|webos|hbbtv|roku|crkey/i.test(userAgent) ||
                 (screen && screen.width >= 1920 && screen.height >= 1080 &&
                  !('ontouchstart' in window));

    // Performance indicators
    const memory = deviceMemory || 4; // GB
    const cores = hardwareConcurrency || 4;
    const isLowEnd = memory < 3 || cores < 4 ||
                     /Android.*([2-4]\.|5\.[01])/i.test(userAgent);

    // Connection info
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    const connectionType = connection?.type || '4g';
    const effectiveType = connection?.effectiveType || '4g';

    const newDeviceInfo: DeviceInfo = {
      isMobile,
      isTablet,
      isDesktop: !isMobile && !isTablet && !isTV,
      isLowEnd,
      isTV,
      connectionType,
      effectiveType,
      memory,
      cores
    };

    setDeviceInfo(newDeviceInfo);

    // Adjust settings based on device
    const newSettings: PerformanceSettings = {
      imageQuality: isLowEnd ? 'low' : (isMobile ? 'medium' : 'high'),
      animationsEnabled: !isLowEnd && effectiveType !== '2g' && effectiveType !== 'slow-2g',
      preloadEnabled: !isLowEnd && effectiveType !== '2g' && effectiveType !== 'slow-2g',
      lazyLoadOffset: isLowEnd ? 50 : (isMobile ? 100 : 200),
      maxConcurrentImages: isLowEnd ? 3 : (isMobile ? 4 : 6),
      cacheSize: isLowEnd ? 20 : (isMobile ? 30 : 50)
    };

    setSettings(newSettings);
  }, []);

  // Monitor connection changes
  const handleConnectionChange = useCallback(() => {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

    if (connection) {
      const slowConnection = connection.effectiveType === '2g' ||
                           connection.effectiveType === 'slow-2g' ||
                           (connection.downlink && connection.downlink < 1.5);

      setIsSlowConnection(slowConnection);

      // Adjust settings for slow connections
      if (slowConnection) {
        setSettings(prev => ({
          ...prev,
          imageQuality: 'low',
          preloadEnabled: false,
          maxConcurrentImages: 2,
          lazyLoadOffset: 50
        }));
      }
    }
  }, []);

  // Measure Core Web Vitals
  const measureWebVitals = useCallback(() => {
    if (typeof window === 'undefined') return;

    let cls = 0;
    let fid = 0;
    let lcp = 0;

    // Cumulative Layout Shift
    const clsObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          cls += (entry as any).value;
        }
      }
    });

    // First Input Delay
    const fidObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        fid = (entry as any).processingStart - entry.startTime;
        break;
      }
    });

    // Largest Contentful Paint
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      lcp = lastEntry.startTime;
    });

    try {
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      fidObserver.observe({ entryTypes: ['first-input'] });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (error) {
      console.warn('Performance Observer not supported');
    }

    // Report after page load
    setTimeout(() => {
      const vitals = { cls, fid, lcp };

      // Send to analytics (if needed)
      if (typeof gtag !== 'undefined') {
        gtag('event', 'web_vitals', {
          cls: Math.round(cls * 1000) / 1000,
          fid: Math.round(fid),
          lcp: Math.round(lcp)
        });
      }

      console.log('Core Web Vitals:', vitals);
    }, 5000);
  }, []);

  // Optimize images based on device
  const getOptimizedImageUrl = useCallback((url: string, width?: number, height?: number) => {
    if (!url) return url;

    const quality = settings.imageQuality === 'low' ? 60 :
                   settings.imageQuality === 'medium' ? 80 : 90;

    const format = deviceInfo.isMobile ? 'webp' : 'webp';

    // If using Next.js Image optimization
    const params = new URLSearchParams({
      url: encodeURIComponent(url),
      w: String(width || (deviceInfo.isMobile ? 300 : 400)),
      q: String(quality)
    });

    return `/_next/image?${params.toString()}`;
  }, [settings.imageQuality, deviceInfo.isMobile]);

  // Prefetch critical resources
  const prefetchResource = useCallback((url: string, type: 'image' | 'video' | 'script' = 'image') => {
    if (!settings.preloadEnabled || isSlowConnection) return;

    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    link.as = type;

    if (type === 'image') {
      link.type = 'image/webp';
    }

    document.head.appendChild(link);
  }, [settings.preloadEnabled, isSlowConnection]);

  // Lazy load with intersection observer
  const createLazyLoader = useCallback(() => {
    if (typeof window === 'undefined') return null;

    return new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            const src = img.dataset.src;

            if (src) {
              img.src = getOptimizedImageUrl(src);
              img.removeAttribute('data-src');
            }
          }
        });
      },
      {
        rootMargin: `${settings.lazyLoadOffset}px`,
        threshold: 0.1
      }
    );
  }, [settings.lazyLoadOffset, getOptimizedImageUrl]);

  // Memory cleanup
  const cleanupResources = useCallback(() => {
    // Clear unused image cache
    const images = document.querySelectorAll('img[data-cached="true"]');
    if (images.length > settings.cacheSize) {
      const excess = images.length - settings.cacheSize;
      for (let i = 0; i < excess; i++) {
        const img = images[i] as HTMLImageElement;
        img.src = '';
        img.removeAttribute('data-cached');
      }
    }
  }, [settings.cacheSize]);

  // Initialize optimizations
  useEffect(() => {
    detectDevice();
    handleConnectionChange();
    measureWebVitals();

    // Listen for connection changes
    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
    }

    // Cleanup on unmount
    return () => {
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
    };
  }, [detectDevice, handleConnectionChange, measureWebVitals]);

  // Periodic cleanup
  useEffect(() => {
    const interval = setInterval(cleanupResources, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [cleanupResources]);

  return {
    deviceInfo,
    settings,
    isSlowConnection,
    getOptimizedImageUrl,
    prefetchResource,
    createLazyLoader,
    detectDevice
  };
}