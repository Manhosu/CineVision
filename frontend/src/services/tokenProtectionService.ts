'use client';

export interface StreamingToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  contentId: string;
  userId?: string;
  purchaseId?: string;
  permissions: StreamingPermission[];
  metadata?: {
    maxBitrate?: number;
    allowedQualities?: string[];
    allowDownload?: boolean;
    allowCast?: boolean;
    allowScreenshot?: boolean;
    expiresAfterStart?: number; // seconds
    maxWatchTime?: number; // seconds
  };
}

export interface StreamingPermission {
  action: 'view' | 'download' | 'cast' | 'screenshot' | 'fullscreen';
  allowed: boolean;
  restrictions?: Record<string, any>;
}

export interface TokenValidationResult {
  valid: boolean;
  token?: StreamingToken;
  error?: string;
  needsRefresh?: boolean;
}

export interface DRMInfo {
  system: 'widevine' | 'playready' | 'fairplay';
  licenseUrl: string;
  headers?: Record<string, string>;
  certificateUrl?: string;
}

export class TokenProtectionService {
  private tokens: Map<string, StreamingToken> = new Map();
  private validationCache: Map<string, { result: TokenValidationResult; timestamp: number }> = new Map();
  private watchStartTimes: Map<string, number> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();

  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly HEARTBEAT_INTERVAL = 30 * 1000; // 30 seconds

  /**
   * Set access token for content
   */
  setAccessToken(contentId: string, token: StreamingToken): void {
    this.tokens.set(contentId, token);
    this.clearValidationCache(contentId);

    // Start heartbeat for token validation
    this.startHeartbeat(contentId);
  }

  /**
   * Get access token for content
   */
  getAccessToken(contentId: string): StreamingToken | null {
    return this.tokens.get(contentId) || null;
  }

  /**
   * Remove access token
   */
  removeAccessToken(contentId: string): void {
    this.tokens.delete(contentId);
    this.clearValidationCache(contentId);
    this.stopHeartbeat(contentId);
    this.watchStartTimes.delete(contentId);
  }

  /**
   * Validate token for streaming access
   */
  async validateToken(contentId: string, action: StreamingPermission['action'] = 'view'): Promise<TokenValidationResult> {
    const cacheKey = `${contentId}-${action}`;
    const cached = this.validationCache.get(cacheKey);

    // Return cached result if still valid
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.result;
    }

    const token = this.tokens.get(contentId);
    if (!token) {
      const result: TokenValidationResult = {
        valid: false,
        error: 'No access token found',
      };
      this.cacheValidationResult(cacheKey, result);
      return result;
    }

    // Check token expiration
    if (Date.now() >= token.expiresAt) {
      const result: TokenValidationResult = {
        valid: false,
        error: 'Token expired',
        needsRefresh: true,
      };
      this.cacheValidationResult(cacheKey, result);
      return result;
    }

    // Check content-specific permissions
    const permission = token.permissions.find(p => p.action === action);
    if (!permission || !permission.allowed) {
      const result: TokenValidationResult = {
        valid: false,
        error: `Action '${action}' not permitted`,
      };
      this.cacheValidationResult(cacheKey, result);
      return result;
    }

    // Check time-based restrictions
    const timeValidation = this.validateTimeRestrictions(contentId, token);
    if (!timeValidation.valid) {
      this.cacheValidationResult(cacheKey, timeValidation);
      return timeValidation;
    }

    // Additional backend validation for critical actions
    if (action === 'view' || action === 'download') {
      try {
        const backendValidation = await this.validateWithBackend(contentId, token);
        this.cacheValidationResult(cacheKey, backendValidation);
        return backendValidation;
      } catch (error) {
        const result: TokenValidationResult = {
          valid: false,
          error: 'Backend validation failed',
        };
        this.cacheValidationResult(cacheKey, result);
        return result;
      }
    }

    const result: TokenValidationResult = {
      valid: true,
      token,
    };
    this.cacheValidationResult(cacheKey, result);
    return result;
  }

  /**
   * Start streaming session (begins time tracking)
   */
  startStreamingSession(contentId: string): void {
    this.watchStartTimes.set(contentId, Date.now());
  }

  /**
   * Get streaming session info
   */
  getStreamingSession(contentId: string): {
    startTime: number | null;
    watchTime: number;
    remainingTime: number | null;
  } {
    const startTime = this.watchStartTimes.get(contentId) || null;
    const watchTime = startTime ? Date.now() - startTime : 0;

    const token = this.tokens.get(contentId);
    const maxWatchTime = token?.metadata?.maxWatchTime;
    const remainingTime = maxWatchTime ? Math.max(0, maxWatchTime * 1000 - watchTime) : null;

    return {
      startTime,
      watchTime,
      remainingTime,
    };
  }

  /**
   * Generate request headers with authentication
   */
  getAuthHeaders(contentId: string): Record<string, string> {
    const token = this.tokens.get(contentId);
    if (!token) {
      return {};
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token.accessToken}`,
      'X-Content-ID': contentId,
    };

    if (token.userId) {
      headers['X-User-ID'] = token.userId;
    }

    if (token.purchaseId) {
      headers['X-Purchase-ID'] = token.purchaseId;
    }

    return headers;
  }

  /**
   * Get DRM information for protected content
   */
  async getDRMInfo(contentId: string): Promise<DRMInfo | null> {
    const validation = await this.validateToken(contentId, 'view');
    if (!validation.valid || !validation.token) {
      return null;
    }

    // For now, return Widevine configuration
    // This would be configured based on your DRM provider
    return {
      system: 'widevine',
      licenseUrl: `${process.env.NEXT_PUBLIC_API_URL}/drm/widevine/license`,
      headers: {
        ...this.getAuthHeaders(contentId),
        'Content-Type': 'application/octet-stream',
      },
    };
  }

  /**
   * Handle token refresh
   */
  async refreshToken(contentId: string): Promise<boolean> {
    const token = this.tokens.get(contentId);
    if (!token || !token.refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token.refreshToken}`,
        },
        body: JSON.stringify({
          contentId,
          refreshToken: token.refreshToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`Refresh failed: ${response.statusText}`);
      }

      const newTokenData = await response.json();
      const newToken: StreamingToken = {
        ...token,
        accessToken: newTokenData.accessToken,
        expiresAt: newTokenData.expiresAt,
        refreshToken: newTokenData.refreshToken,
      };

      this.setAccessToken(contentId, newToken);
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }

  /**
   * Check if action is allowed
   */
  async isActionAllowed(contentId: string, action: StreamingPermission['action']): Promise<boolean> {
    const validation = await this.validateToken(contentId, action);
    return validation.valid;
  }

  /**
   * Get quality restrictions
   */
  getQualityRestrictions(contentId: string): string[] | null {
    const token = this.tokens.get(contentId);
    return token?.metadata?.allowedQualities || null;
  }

  /**
   * Get bitrate limit
   */
  getBitrateLimit(contentId: string): number | null {
    const token = this.tokens.get(contentId);
    return token?.metadata?.maxBitrate || null;
  }

  /**
   * Validate time-based restrictions
   */
  private validateTimeRestrictions(contentId: string, token: StreamingToken): TokenValidationResult {
    const { watchTime, remainingTime } = this.getStreamingSession(contentId);

    // Check if content has expired after first play
    if (token.metadata?.expiresAfterStart) {
      const startTime = this.watchStartTimes.get(contentId);
      if (startTime) {
        const elapsed = Date.now() - startTime;
        const maxTime = token.metadata.expiresAfterStart * 1000;

        if (elapsed > maxTime) {
          return {
            valid: false,
            error: 'Content access expired after playback started',
          };
        }
      }
    }

    // Check maximum watch time
    if (remainingTime !== null && remainingTime <= 0) {
      return {
        valid: false,
        error: 'Maximum watch time exceeded',
      };
    }

    return { valid: true, token };
  }

  /**
   * Validate with backend
   */
  private async validateWithBackend(contentId: string, token: StreamingToken): Promise<TokenValidationResult> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/content/${contentId}/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(contentId),
      },
      body: JSON.stringify({
        action: 'view',
        timestamp: Date.now(),
      }),
    });

    if (!response.ok) {
      return {
        valid: false,
        error: `Backend validation failed: ${response.statusText}`,
        needsRefresh: response.status === 401,
      };
    }

    const result = await response.json();
    return {
      valid: result.valid,
      token: result.valid ? token : undefined,
      error: result.error,
    };
  }

  /**
   * Cache validation result
   */
  private cacheValidationResult(key: string, result: TokenValidationResult): void {
    this.validationCache.set(key, {
      result,
      timestamp: Date.now(),
    });

    // Clean old cache entries
    if (this.validationCache.size > 100) {
      const now = Date.now();
      for (const [cacheKey, cached] of this.validationCache.entries()) {
        if (now - cached.timestamp > this.CACHE_TTL) {
          this.validationCache.delete(cacheKey);
        }
      }
    }
  }

  /**
   * Clear validation cache for content
   */
  private clearValidationCache(contentId: string): void {
    const keysToDelete = Array.from(this.validationCache.keys()).filter(key =>
      key.startsWith(contentId)
    );
    keysToDelete.forEach(key => this.validationCache.delete(key));
  }

  /**
   * Start heartbeat for token validation
   */
  private startHeartbeat(contentId: string): void {
    this.stopHeartbeat(contentId);

    const interval = setInterval(async () => {
      const validation = await this.validateToken(contentId, 'view');
      if (!validation.valid) {
        if (validation.needsRefresh) {
          const refreshed = await this.refreshToken(contentId);
          if (!refreshed) {
            this.removeAccessToken(contentId);
          }
        } else {
          this.removeAccessToken(contentId);
        }
      }
    }, this.HEARTBEAT_INTERVAL);

    this.heartbeatIntervals.set(contentId, interval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(contentId: string): void {
    const interval = this.heartbeatIntervals.get(contentId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(contentId);
    }
  }

  /**
   * Cleanup all resources
   */
  cleanup(): void {
    this.tokens.clear();
    this.validationCache.clear();
    this.watchStartTimes.clear();

    // Clear all heartbeat intervals
    for (const interval of this.heartbeatIntervals.values()) {
      clearInterval(interval);
    }
    this.heartbeatIntervals.clear();
  }

  /**
   * Get protection status for debugging
   */
  getProtectionStatus(contentId: string): {
    hasToken: boolean;
    tokenValid: boolean;
    permissions: StreamingPermission[];
    sessionInfo: any;
    restrictions: any;
  } {
    const token = this.tokens.get(contentId);
    const sessionInfo = this.getStreamingSession(contentId);

    return {
      hasToken: !!token,
      tokenValid: token ? Date.now() < token.expiresAt : false,
      permissions: token?.permissions || [],
      sessionInfo,
      restrictions: token?.metadata || {},
    };
  }
}

// Export singleton instance
export const tokenProtectionService = new TokenProtectionService();