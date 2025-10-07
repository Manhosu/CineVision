'use client';

import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import Image from 'next/image';

interface LazyImageProps {
  src?: string | null;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  placeholder?: string;
  priority?: boolean;
  fill?: boolean;
  sizes?: string;
  quality?: number;
  onLoad?: () => void;
  onError?: () => void;
  fallbackSrc?: string;
  blurDataURL?: string;
}

const LazyImage = memo(function LazyImage({
  src,
  alt,
  width,
  height,
  className = '',
  placeholder,
  priority = false,
  fill = false,
  sizes,
  quality = 75,
  onLoad,
  onError,
  fallbackSrc = '/images/placeholder-poster.svg', // Aceita SVG, PNG, WEBP
  blurDataURL,
}: LazyImageProps) {
  // Proteção contra src null/undefined/empty
  const safeSrc = src && src.trim() !== '' ? src : fallbackSrc;
  
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(safeSrc);
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || isInView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px', // Start loading 50px before the image enters the viewport
        threshold: 0.1,
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [priority, isInView]);

  const handleLoad = useCallback(() => {
    console.log('Image loaded successfully:', currentSrc);
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  }, [onLoad, currentSrc]);

  const handleError = useCallback(() => {
    console.log('Image failed to load:', currentSrc);
    setIsLoading(false);
    setHasError(true);
    onError?.();
  }, [onError, currentSrc]);

  // Handle fallback when error occurs
  useEffect(() => {
    console.log('LazyImage src changed:', { src, fallbackSrc, alt });
    
    if (hasError && currentSrc !== fallbackSrc) {
      console.log('Using fallback src:', fallbackSrc);
      // Use setTimeout to prevent setState during render
      setTimeout(() => {
        setCurrentSrc(fallbackSrc);
        setHasError(false); // Reset error state to try fallback
      }, 0);
    }
  }, [hasError, currentSrc, fallbackSrc, src, alt]);

  // Generate blur data URL if not provided
  const defaultBlurDataURL = blurDataURL ||
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q==';

  return (
    <div
      ref={imgRef}
      className={`relative overflow-hidden ${className}`}
      style={fill ? { minHeight: '200px', width: '100%', height: '100%' } : { width, height }}
    >
      {/* Loading placeholder */}
      {isLoading && (
        <div className="absolute inset-0 bg-dark-800 animate-pulse flex items-center justify-center">
          {placeholder && (
            <div className="text-gray-400 text-xs text-center px-2">
              {placeholder}
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {hasError && currentSrc === fallbackSrc && (
        <div className="absolute inset-0 bg-dark-800 flex items-center justify-center">
          <div className="text-gray-500 text-xs text-center px-2">
            Imagem não disponível
          </div>
        </div>
      )}

      {/* Image */}
      {(isInView || priority) && (
        <Image
          src={currentSrc}
          alt={alt}
          width={fill ? undefined : width}
          height={fill ? undefined : height}
          fill={fill}
          sizes={sizes || (fill ? "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" : undefined)}
          quality={quality}
          priority={priority}
          placeholder={blurDataURL || defaultBlurDataURL ? 'blur' : 'empty'}
          blurDataURL={blurDataURL || defaultBlurDataURL}
          className={`transition-opacity duration-300 ${
            isLoading ? 'opacity-0' : 'opacity-100'
          } ${fill ? 'object-cover' : ''}`}
          onLoad={handleLoad}
          onError={handleError}
          style={fill ? undefined : { width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
    </div>
  );
});

export default LazyImage;