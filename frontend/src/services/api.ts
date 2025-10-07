const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiService {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('admin_token') || localStorage.getItem('auth_token') || localStorage.getItem('sb-szghyvnbmjlquznxhqum-auth-token'))
      : null;

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Video upload methods
  async initiateMultipartUpload(data: {
    fileName: string;
    contentType: string;
    fileSize: number;
    chunkSize?: number;
  }) {
    return this.request('/api/video/upload/initiate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async completeMultipartUpload(data: {
    uploadId: string;
    key: string;
    parts: Array<{ ETag: string; PartNumber: number }>;
  }) {
    return this.request('/api/video/upload/complete', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async abortMultipartUpload(data: {
    uploadId: string;
    key: string;
  }) {
    return this.request('/api/video/upload/abort', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async generatePresignedUploadUrl(data: {
    fileName: string;
    contentType: string;
  }) {
    return this.request('/api/video/upload/presigned-url', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async generateSignedStreamingUrl(videoKey: string, expiresInMinutes?: number) {
    const params = new URLSearchParams({ videoKey });
    if (expiresInMinutes) {
      params.append('expiresInMinutes', expiresInMinutes.toString());
    }
    
    return this.request(`/api/video/signed-url?${params.toString()}`);
  }

  async getUploadStatistics() {
    return this.request('/api/video/upload/statistics');
  }

  async cleanupIncompleteUploads(olderThanHours?: number) {
    const params = new URLSearchParams();
    if (olderThanHours) {
      params.append('olderThanHours', olderThanHours.toString());
    }
    
    return this.request(`/api/video/upload/cleanup?${params.toString()}`, {
      method: 'POST',
    });
  }

  // Auth methods
  async login(email: string, password: string) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getProfile() {
    return this.request('/api/auth/me');
  }

  async logout() {
    return this.request('/api/auth/logout', {
      method: 'POST',
    });
  }

  // Content management methods
  async getVideos(params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }
    
    return this.request(`/api/content/videos?${searchParams.toString()}`);
  }

  async getVideo(id: string) {
    return this.request(`/api/content/videos/${id}`);
  }

  async createVideo(data: {
    title: string;
    description?: string;
    category?: string;
    tags?: string[];
    thumbnailUrl?: string;
  }) {
    return this.request('/api/content/videos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateVideo(id: string, data: Partial<{
    title: string;
    description: string;
    category: string;
    tags: string[];
    thumbnailUrl: string;
    status: string;
  }>) {
    return this.request(`/api/content/videos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteVideo(id: string) {
    return this.request(`/api/content/videos/${id}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiService(API_BASE_URL);
export default api;