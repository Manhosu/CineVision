import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis | null = null;
  private enabled: boolean;

  constructor(private configService: ConfigService) {
    this.enabled = this.configService.get<string>('REDIS_ENABLED') === 'true';
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.warn('Redis cache is disabled. Set REDIS_ENABLED=true to enable caching.');
      return;
    }

    try {
      this.redis = new Redis({
        host: this.configService.get<string>('REDIS_HOST', 'localhost'),
        port: this.configService.get<number>('REDIS_PORT', 6379),
        password: this.configService.get<string>('REDIS_PASSWORD'),
        db: this.configService.get<number>('REDIS_DB', 0),
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.error('Redis connection failed after 3 retries. Disabling cache.');
            this.enabled = false;
            return null;
          }
          return Math.min(times * 100, 2000);
        },
      });

      this.redis.on('connect', () => {
        this.logger.log('✅ Redis connected successfully');
      });

      this.redis.on('error', (err) => {
        this.logger.error('Redis error:', err);
        this.enabled = false;
      });

      this.redis.on('close', () => {
        this.logger.warn('Redis connection closed');
      });

      // Test connection
      await this.redis.ping();
      this.logger.log('Redis cache initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Redis:', error.message);
      this.enabled = false;
      this.redis = null;
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
      this.logger.log('Redis connection closed');
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled || !this.redis) return null;

    try {
      const value = await this.redis.get(key);
      if (!value) return null;

      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Set value in cache with TTL (in seconds)
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.enabled || !this.redis) return;

    try {
      const serialized = JSON.stringify(value);

      if (ttl) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error.message);
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<void> {
    if (!this.enabled || !this.redis) return;

    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}:`, error.message);
    }
  }

  /**
   * Delete all keys matching a pattern
   */
  async delPattern(pattern: string): Promise<void> {
    if (!this.enabled || !this.redis) return;

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.log(`Deleted ${keys.length} keys matching pattern: ${pattern}`);
      }
    } catch (error) {
      this.logger.error(`Cache delete pattern error for ${pattern}:`, error.message);
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    if (!this.enabled || !this.redis) return false;

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Cache exists error for key ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Get or set pattern - fetch from cache or execute function and cache result
   */
  async getOrSet<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // If not in cache, execute function
    const result = await fetchFunction();

    // Cache the result
    await this.set(key, result, ttl);

    return result;
  }

  /**
   * Increment counter
   */
  async increment(key: string, ttl?: number): Promise<number> {
    if (!this.enabled || !this.redis) return 0;

    try {
      const value = await this.redis.incr(key);

      if (ttl && value === 1) {
        await this.redis.expire(key, ttl);
      }

      return value;
    } catch (error) {
      this.logger.error(`Cache increment error for key ${key}:`, error.message);
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    if (!this.enabled || !this.redis) return;

    try {
      await this.redis.flushdb();
      this.logger.log('Cache cleared');
    } catch (error) {
      this.logger.error('Cache clear error:', error.message);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    if (!this.enabled || !this.redis) {
      return {
        enabled: false,
        message: 'Cache is disabled',
      };
    }

    try {
      const info = await this.redis.info('stats');
      const keyspace = await this.redis.info('keyspace');

      return {
        enabled: true,
        connected: this.redis.status === 'ready',
        stats: info,
        keyspace: keyspace,
      };
    } catch (error) {
      return {
        enabled: true,
        error: error.message,
      };
    }
  }
}
