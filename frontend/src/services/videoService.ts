import { StreamingData, VideoContent, ProcessingStatusResponse } from '@/types/video';

export class VideoService {
  private baseUrl: string;
  private accessToken: string | null = null;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
    this.loadAccessToken();
  }

  private loadAccessToken(): void {
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('access_token');
    }
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', token);
    }
  }

  clearAccessToken(): void {
    this.accessToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
    }
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      if (response.status === 401) {
        this.clearAccessToken();
        throw new Error('Authentication required');
      } else if (response.status === 403) {
        throw new Error('Access denied - purchase required');
      } else if (response.status === 404) {
        throw new Error('Content not found');
      } else if (response.status === 429) {
        throw new Error('Too many requests - please try again later');
      }

      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get streaming URLs for content
   */
  async getStreamingData(
    contentId: string,
    quality?: string,
    expiresIn?: number
  ): Promise<StreamingData> {
    const params = new URLSearchParams();
    if (quality) params.append('quality', quality);
    if (expiresIn) params.append('expires_in', expiresIn.toString());

    const url = `${this.baseUrl}/content/${contentId}/stream?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
      credentials: 'include',
    });

    return this.handleResponse<StreamingData>(response);
  }

  /**
   * Get content details
   */
  async getContent(contentId: string): Promise<VideoContent> {
    const response = await fetch(`${this.baseUrl}/content/movies/${contentId}`, {
      method: 'GET',
      headers: this.getHeaders(),
      credentials: 'include',
    });

    return this.handleResponse<VideoContent>(response);
  }

  /**
   * Get processing status for content
   */
  async getProcessingStatus(contentId: string): Promise<ProcessingStatusResponse> {
    const response = await fetch(`${this.baseUrl}/content/${contentId}/processing-status`, {
      method: 'GET',
      headers: this.getHeaders(),
      credentials: 'include',
    });

    return this.handleResponse<ProcessingStatusResponse>(response);
  }

  /**
   * Get signed URL for specific HLS segment
   */
  async getSegmentUrl(contentId: string, segmentPath: string): Promise<{ segmentUrl: string }> {
    const response = await fetch(`${this.baseUrl}/content/${contentId}/stream/segment/${encodeURIComponent(segmentPath)}`, {
      method: 'GET',
      headers: this.getHeaders(),
      credentials: 'include',
    });

    return this.handleResponse<{ segmentUrl: string }>(response);
  }

  /**
   * Verify content access with token (legacy endpoint)
   */
  async verifyContentAccess(contentId: string, token: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/content/stream/${contentId}?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: this.getHeaders(),
      credentials: 'include',
    });

    return this.handleResponse<any>(response);
  }

  /**
   * Submit playback analytics
   */
  async submitAnalytics(data: {
    contentId: string;
    sessionId: string;
    events: Array<{
      type: string;
      timestamp: string;
      data?: Record<string, any>;
    }>;
    metrics: {
      totalPlayTime: number;
      bufferingTime: number;
      qualityChanges: number;
      errors: number;
    };
  }): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/analytics/playback`, {
        method: 'POST',
        headers: this.getHeaders(),
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok && response.status !== 404) {
        // Analytics are not critical, so we don't throw on 404 (endpoint not implemented)
        console.warn('Failed to submit analytics:', response.statusText);
      }
    } catch (error) {
      console.warn('Failed to submit analytics:', error);
    }
  }

  /**
   * Save playback position for resume functionality
   */
  async savePlaybackPosition(contentId: string, position: number): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/user/playback-position`, {
        method: 'POST',
        headers: this.getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          contentId,
          position,
        }),
      });

      if (!response.ok && response.status !== 404) {
        console.warn('Failed to save playback position:', response.statusText);
      }
    } catch (error) {
      console.warn('Failed to save playback position:', error);
    }
  }

  /**
   * Get saved playback position
   */
  async getPlaybackPosition(contentId: string): Promise<number> {
    try {
      const response = await fetch(`${this.baseUrl}/user/playback-position/${contentId}`, {
        method: 'GET',
        headers: this.getHeaders(),
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        return data.position || 0;
      }
    } catch (error) {
      console.warn('Failed to get playback position:', error);
    }

    return 0;
  }

  /**
   * Get content recommendations
   */
  async getRecommendations(contentId: string, limit: number = 10): Promise<VideoContent[]> {
    try {
      const response = await fetch(`${this.baseUrl}/content/${contentId}/recommendations?limit=${limit}`, {
        method: 'GET',
        headers: this.getHeaders(),
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        return data.recommendations || [];
      }
    } catch (error) {
      console.warn('Failed to get recommendations:', error);
    }

    return [];
  }

  /**
   * Report playback error for debugging
   */
  async reportError(data: {
    contentId: string;
    sessionId: string;
    error: {
      code: string;
      message: string;
      stack?: string;
    };
    context: {
      userAgent: string;
      url: string;
      timestamp: string;
      playerVersion?: string;
      browserSupport?: Record<string, boolean>;
    };
  }): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/error-reports`, {
        method: 'POST',
        headers: this.getHeaders(),
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok && response.status !== 404) {
        console.warn('Failed to report error:', response.statusText);
      }
    } catch (error) {
      console.warn('Failed to report error:', error);
    }
  }

  /**
   * Check browser compatibility
   */
  static checkBrowserSupport(): {
    shakaSupported: boolean;
    hlsSupported: boolean;
    webrtcSupported: boolean;
    fullscreenSupported: boolean;
    castSupported: boolean;
    airplaySupported: boolean;
    details: Record<string, boolean>;
  } {
    const details = {
      mse: !!(window.MediaSource || (window as any).WebKitMediaSource),
      eme: !!(window.navigator && window.navigator.requestMediaKeySystemAccess),
      webassembly: !!(window as any).WebAssembly,
      promiseSupported: typeof Promise !== 'undefined',
      uint8ArraySupported: !!(window as any).Uint8Array,
      webgl: (() => {
        try {
          const canvas = document.createElement('canvas');
          return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch {
          return false;
        }
      })(),
    };

    const shakaSupported = details.mse && details.promiseSupported && details.uint8ArraySupported;
    const hlsSupported = shakaSupported || !!(document.createElement('video') as any).canPlayType('application/vnd.apple.mpegurl');
    const webrtcSupported = !!(window as any).RTCPeerConnection;
    const fullscreenSupported = !!(document.documentElement.requestFullscreen ||
                                  (document.documentElement as any).webkitRequestFullscreen ||
                                  (document.documentElement as any).mozRequestFullScreen);

    const castSupported = !!(window as any).chrome?.cast;
    const airplaySupported = !!(window as any).WebKitPlaybackTargetAvailabilityEvent;

    return {
      shakaSupported,
      hlsSupported,
      webrtcSupported,
      fullscreenSupported,
      castSupported,
      airplaySupported,
      details,
    };
  }
}

// Export singleton instance
export const videoService = new VideoService();