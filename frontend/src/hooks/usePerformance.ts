'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';

/**
 * Hook para otimização de performance com debounce
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    }) as T,
    [callback, delay]
  );
}

/**
 * Hook para throttle de funções
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastCallRef = useRef<number>(0);

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCallRef.current >= delay) {
        lastCallRef.current = now;
        callback(...args);
      }
    }) as T,
    [callback, delay]
  );
}

/**
 * Hook para memoização de cálculos pesados
 */
export function useMemoizedCalculation<T>(
  calculation: () => T,
  dependencies: React.DependencyList
): T {
  return useMemo(calculation, dependencies);
}

/**
 * Hook para lazy loading de dados
 */
export function useLazyData<T>(
  fetchData: () => Promise<T>,
  dependencies: React.DependencyList = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchCallback = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchData();
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, dependencies);

  return {
    data,
    loading,
    error,
    refetch: fetchCallback
  };
}

/**
 * Hook para intersection observer otimizado
 */
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
) {
  const [isInView, setIsInView] = useState(false);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);

  useCallback((node: HTMLElement | null) => {
    if (elementRef.current) {
      elementRef.current = null;
    }

    if (node) {
      elementRef.current = node;

      const observer = new IntersectionObserver(
        ([entry]) => {
          setIsInView(entry.isIntersecting);
          setEntry(entry);
        },
        {
          threshold: 0.1,
          rootMargin: '50px',
          ...options
        }
      );

      observer.observe(node);

      return () => {
        observer.disconnect();
      };
    }
  }, [options]);

  return {
    isInView,
    entry,
    elementRef: useCallback((node: HTMLElement | null) => {
      elementRef.current = node;
    }, [])
  };
}

/**
 * Utilitário para criar componentes memoizados
 */
export function createMemoComponent<T extends React.ComponentType<any>>(
  Component: T,
  areEqual?: (prevProps: Readonly<React.ComponentProps<T>>, nextProps: Readonly<React.ComponentProps<T>>) => boolean
): T {
  return React.memo(Component, areEqual) as any as T;
}

/**
 * Hook para otimizar re-renders de listas
 */
export function useOptimizedList<T>(
  items: T[],
  keyExtractor: (item: T, index: number) => string | number,
  renderItem: (item: T, index: number) => React.ReactNode
) {
  const memoizedItems = useMemo(
    () => items.map((item, index) => ({
      key: keyExtractor(item, index),
      element: renderItem(item, index)
    })),
    [items, keyExtractor, renderItem]
  );

  return memoizedItems;
}

/**
 * Hook para cache simples de dados
 */
export function useCache<T>(key: string, initialValue?: T) {
  const cacheRef = useRef(new Map<string, T>());

  const get = useCallback((cacheKey?: string): T | undefined => {
    return cacheRef.current.get(cacheKey || key);
  }, [key]);

  const set = useCallback((value: T, cacheKey?: string) => {
    cacheRef.current.set(cacheKey || key, value);
  }, [key]);

  const clear = useCallback((cacheKey?: string) => {
    if (cacheKey) {
      cacheRef.current.delete(cacheKey);
    } else {
      cacheRef.current.clear();
    }
  }, []);

  // Initialize with default value if provided
  useMemo(() => {
    if (initialValue !== undefined && !cacheRef.current.has(key)) {
      cacheRef.current.set(key, initialValue);
    }
  }, [key, initialValue]);

  return {
    get,
    set,
    clear,
    has: useCallback((cacheKey?: string) => cacheRef.current.has(cacheKey || key), [key])
  };
}