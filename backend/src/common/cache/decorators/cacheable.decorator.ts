import { SetMetadata } from '@nestjs/common';

export const CACHE_KEY_METADATA = 'cache:key';
export const CACHE_TTL_METADATA = 'cache:ttl';

export interface CacheableOptions {
  /**
   * Cache key prefix. Can include parameters using ${paramName} syntax
   * Example: 'content:${id}' or 'categories:all'
   */
  key: string;

  /**
   * Time to live in seconds
   */
  ttl?: number;
}

/**
 * Decorator to automatically cache method results
 *
 * @example
 * @Cacheable({ key: 'categories:all', ttl: 3600 })
 * async findAllCategories() {
 *   return this.categoryRepository.find();
 * }
 *
 * @example
 * @Cacheable({ key: 'content:${id}', ttl: 1800 })
 * async findMovieById(id: string) {
 *   return this.contentRepository.findOne({ where: { id } });
 * }
 */
export const Cacheable = (options: CacheableOptions) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(CACHE_KEY_METADATA, options.key)(target, propertyKey, descriptor);
    SetMetadata(CACHE_TTL_METADATA, options.ttl)(target, propertyKey, descriptor);

    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Get cache service from the class instance
      const cacheService = (this as any).cacheService;

      if (!cacheService) {
        // If cache service is not injected, just call the original method
        return originalMethod.apply(this, args);
      }

      // Build cache key by replacing parameters
      let cacheKey = options.key;
      const paramNames = originalMethod.toString().match(/\(([^)]*)\)/)?.[1]?.split(',') || [];

      paramNames.forEach((paramName, index) => {
        const cleanParamName = paramName.trim();
        if (args[index] !== undefined) {
          cacheKey = cacheKey.replace(`\${${cleanParamName}}`, String(args[index]));
        }
      });

      // Try to get from cache
      const cached = await cacheService.get(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // Execute original method
      const result = await originalMethod.apply(this, args);

      // Cache the result
      await cacheService.set(cacheKey, result, options.ttl);

      return result;
    };

    return descriptor;
  };
};

/**
 * Decorator to invalidate cache when method is called
 *
 * @example
 * @CacheInvalidate({ pattern: 'categories:*' })
 * async updateCategory(id: string, data: any) {
 *   return this.categoryRepository.update(id, data);
 * }
 */
export const CacheInvalidate = (options: { pattern: string }) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Execute original method first
      const result = await originalMethod.apply(this, args);

      // Invalidate cache after successful execution
      const cacheService = (this as any).cacheService;
      if (cacheService) {
        await cacheService.delPattern(options.pattern);
      }

      return result;
    };

    return descriptor;
  };
};
