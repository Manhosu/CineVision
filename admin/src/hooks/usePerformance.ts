'use client';

import { useEffect, useCallback, useRef } from 'react';

interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  memoryUsage?: number;
  networkRequests: number;
}

interface UsePerformanceOptions {
  trackMemory?: boolean;
  trackNetwork?: boolean;
  onMetrics?: (metrics: PerformanceMetrics) => void;
}

export function usePerformance(options: UsePerformanceOptions = {}) {
  const {
    trackMemory = false,
    trackNetwork = false,
    onMetrics
  } = options;

  const startTime = useRef<number>(Date.now());
  const renderStartTime = useRef<number>(Date.now());
  const networkRequestCount = useRef<number>(0);

  // Track network requests
  useEffect(() => {
    if (!trackNetwork) return;

    const originalFetch = window.fetch;
    window.fetch = (...args) => {
      networkRequestCount.current++;
      return originalFetch(...args);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [trackNetwork]);

  // Measure render time
  const measureRenderTime = useCallback(() => {
    renderStartTime.current = Date.now();
  }, []);

  // Get performance metrics
  const getMetrics = useCallback((): PerformanceMetrics => {
    const loadTime = Date.now() - startTime.current;
    const renderTime = Date.now() - renderStartTime.current;
    
    let memoryUsage: number | undefined;
    if (trackMemory && 'memory' in performance) {
      const memory = (performance as any).memory;
      memoryUsage = memory.usedJSHeapSize / 1024 / 1024; // MB
    }

    return {
      loadTime,
      renderTime,
      memoryUsage,
      networkRequests: networkRequestCount.current
    };
  }, [trackMemory]);

  // Report metrics
  const reportMetrics = useCallback(() => {
    const metrics = getMetrics();
    onMetrics?.(metrics);
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚀 Performance Metrics');
      console.log('Load Time:', `${metrics.loadTime}ms`);
      console.log('Render Time:', `${metrics.renderTime}ms`);
      if (metrics.memoryUsage) {
        console.log('Memory Usage:', `${metrics.memoryUsage.toFixed(2)}MB`);
      }
      console.log('Network Requests:', metrics.networkRequests);
      console.groupEnd();
    }
  }, [getMetrics, onMetrics]);

  // Debounced performance observer
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const observer = new PerformanceObserver((list) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        reportMetrics();
      }, 1000); // Debounce by 1 second
    });

    try {
      observer.observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint'] });
    } catch (error) {
      console.warn('Performance Observer not supported:', error);
    }

    return () => {
      observer.disconnect();
      clearTimeout(timeoutId);
    };
  }, [reportMetrics]);

  return {
    measureRenderTime,
    getMetrics,
    reportMetrics
  };
}

// Hook for monitoring component render performance
export function useRenderPerformance(componentName: string) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());

  useEffect(() => {
    renderCount.current++;
    const currentTime = Date.now();
    const timeSinceLastRender = currentTime - lastRenderTime.current;
    lastRenderTime.current = currentTime;

    if (process.env.NODE_ENV === 'development') {
      console.log(
        `🔄 ${componentName} rendered ${renderCount.current} times. ` +
        `Time since last render: ${timeSinceLastRender}ms`
      );
    }
  });

  return {
    renderCount: renderCount.current
  };
}

// Hook for debouncing expensive operations
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Hook for throttling function calls
export function useThrottle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T {
  const lastCall = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      
      if (now - lastCall.current >= delay) {
        lastCall.current = now;
        return func(...args);
      } else {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          lastCall.current = Date.now();
          func(...args);
        }, delay - (now - lastCall.current));
      }
    }) as T,
    [func, delay]
  );
}

// Import useState for useDebounce
import { useState } from 'react';