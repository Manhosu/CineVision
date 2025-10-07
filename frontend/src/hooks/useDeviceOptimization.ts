'use client';

import { useState, useEffect, useCallback } from 'react';
import { DeviceCapabilities } from '@/utils/deviceDetection';
import { OptimizationSettings, PerformanceMetrics, performanceOptimizer } from '@/utils/performanceOptimizer';

export interface UseDeviceOptimizationReturn {
  // Device info
  capabilities: DeviceCapabilities;
  settings: OptimizationSettings;
  isLowEnd: boolean;
  isSmartTV: boolean;
  isMobile: boolean;

  // Performance monitoring
  metrics: PerformanceMetrics | null;
  isMonitoring: boolean;

  // Optimization methods
  getShakaConfig: () => any;
  getCSSClasses: () => string[];
  getImageSettings: () => any;
  updateSettings: (newSettings: Partial<OptimizationSettings>) => void;
  startMonitoring: () => void;
  stopMonitoring: () => void;

  // Adaptive quality management
  recommendQuality: (bandwidth?: number) => string;
  shouldEnableFeature: (feature: string) => boolean;
}

export const useDeviceOptimization = (): UseDeviceOptimizationReturn => {
  const [capabilities] = useState<DeviceCapabilities>(() =>
    performanceOptimizer.getCapabilities()
  );

  const [settings, setSettings] = useState<OptimizationSettings>(() =>
    performanceOptimizer.getSettings()
  );

  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  // Derived state
  const isLowEnd = capabilities.isLowEnd;
  const isSmartTV = capabilities.isSmartTV;
  const isMobile = capabilities.type === 'mobile';

  // Performance monitoring
  const startMonitoring = useCallback(() => {
    if (isMonitoring || typeof window === 'undefined') return;

    setIsMonitoring(true);

    performanceOptimizer.startPerformanceMonitoring((newMetrics) => {
      setMetrics(newMetrics);

      // Auto-adapt settings based on performance
      if (newMetrics.memoryPressure) {
        setSettings(prev => ({
          ...prev,
          maxQuality: prev.maxQuality === '1080p' ? '720p' :
                     prev.maxQuality === '720p' ? '480p' : prev.maxQuality,
          animationsEnabled: false,
          blurEffectsEnabled: false,
        }));
      }

      // Recommendations handling
      if (newMetrics.recommendations.length > 0) {
        console.log('Performance recommendations:', newMetrics.recommendations);
      }
    });
  }, [isMonitoring]);

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
    // Note: PerformanceObserver cleanup would be handled in the optimizer
  }, []);

  // Auto-start monitoring on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      startMonitoring();
    }, 1000); // Delay to avoid interfering with initial load

    return () => {
      clearTimeout(timer);
      stopMonitoring();
    };
  }, [startMonitoring, stopMonitoring]);

  // Configuration getters
  const getShakaConfig = useCallback(() => {
    return performanceOptimizer.getShakaConfig();
  }, []);

  const getCSSClasses = useCallback(() => {
    return performanceOptimizer.getCSSOptimizationClasses();
  }, []);

  const getImageSettings = useCallback(() => {
    return performanceOptimizer.getImageOptimizationSettings();
  }, []);

  // Settings management
  const updateSettings = useCallback((newSettings: Partial<OptimizationSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  // Adaptive quality recommendation
  const recommendQuality = useCallback((bandwidth?: number): string => {
    if (bandwidth) {
      // Bandwidth-based recommendation
      if (bandwidth < 500000) return '240p';   // < 500 kbps
      if (bandwidth < 1000000) return '360p';  // < 1 Mbps
      if (bandwidth < 2000000) return '480p';  // < 2 Mbps
      if (bandwidth < 4000000) return '720p';  // < 4 Mbps
      if (bandwidth < 8000000) return '1080p'; // < 8 Mbps
      return '1440p'; // >= 8 Mbps
    }

    // Device-based recommendation
    if (isLowEnd) return capabilities.ram <= 1 ? '360p' : '480p';
    if (isMobile) return capabilities.connectionType === '3g' ? '480p' : '720p';
    if (isSmartTV) return capabilities.maxResolution;

    return settings.maxQuality;
  }, [isLowEnd, isMobile, isSmartTV, capabilities, settings.maxQuality]);

  // Feature enablement based on device capabilities
  const shouldEnableFeature = useCallback((feature: string): boolean => {
    switch (feature) {
      case 'animations':
        return settings.animationsEnabled && !isLowEnd;

      case 'transitions':
        return settings.transitionsEnabled;

      case 'shadows':
        return settings.shadowsEnabled && capabilities.ram > 2;

      case 'blur-effects':
        return settings.blurEffectsEnabled && capabilities.supportsWebGL;

      case 'prefetch':
        return settings.prefetchEnabled && capabilities.connectionType !== '2g';

      case 'lazy-loading':
        return settings.lazyLoadingEnabled;

      case 'webgl':
        return capabilities.supportsWebGL;

      case 'webassembly':
        return capabilities.supportsWebAssembly;

      case 'picture-in-picture':
        return !isSmartTV && capabilities.type !== 'mobile';

      case 'cast':
        return capabilities.type !== 'tv'; // TVs don't need casting

      case 'airplay':
        return capabilities.browser === 'Safari' && capabilities.os.includes('iOS');

      case 'fullscreen':
        return true; // Generally supported

      case 'keyboard-shortcuts':
        return capabilities.inputMethods.includes('keyboard');

      case 'touch-gestures':
        return capabilities.inputMethods.includes('touch');

      case 'remote-control':
        return capabilities.inputMethods.includes('remote');

      default:
        return true;
    }
  }, [settings, isLowEnd, capabilities, isSmartTV]);

  return {
    // Device info
    capabilities,
    settings,
    isLowEnd,
    isSmartTV,
    isMobile,

    // Performance monitoring
    metrics,
    isMonitoring,

    // Optimization methods
    getShakaConfig,
    getCSSClasses,
    getImageSettings,
    updateSettings,
    startMonitoring,
    stopMonitoring,

    // Adaptive features
    recommendQuality,
    shouldEnableFeature,
  };
};