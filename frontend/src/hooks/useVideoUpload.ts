import { useState, useCallback, useRef } from 'react';
import { api } from '../services/api';

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

interface UploadOptions {
  onProgress?: (progress: UploadProgress) => void;
  chunkSize?: number;
  customEndpoints?: {
    initiate?: string;
    complete?: string;
    presignedUrl?: string;
  };
  customPayload?: Record<string, any>;
}

interface MultipartUploadResponse {
  uploadId: string;
  key: string;
  presignedUrls: string[];
}

interface UploadResult {
  videoKey: string;
  metadata: any;
}

interface UploadPart {
  ETag: string;
  PartNumber: number;
}

export const useVideoUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentUploadRef = useRef<{
    uploadId: string;
    key: string;
    parts: UploadPart[];
    currentPartIndex: number;
    file: File;
    presignedUrls: string[];
    onProgress?: (progress: UploadProgress) => void;
  } | null>(null);

  const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB chunks - otimizado para uploads de arquivos grandes (até 3GB+)
  const MAX_RETRIES = 3;

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const uploadChunk = async (
    chunk: Blob,
    presignedUrl: string,
    partNumber: number,
    retryCount = 0
  ): Promise<string> => {
    try {
      const response = await fetch(presignedUrl, {
        method: 'PUT',
        body: chunk,
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        signal: abortControllerRef.current?.signal,
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }

      const etag = response.headers.get('ETag');
      if (!etag) {
        throw new Error('No ETag received from S3');
      }

      return etag;
    } catch (error) {
      if (retryCount < MAX_RETRIES && !abortControllerRef.current?.signal.aborted) {
        console.warn(`Retrying chunk ${partNumber}, attempt ${retryCount + 1}`);
        await sleep(1000 * Math.pow(2, retryCount)); // Exponential backoff
        return uploadChunk(chunk, presignedUrl, partNumber, retryCount + 1);
      }
      throw error;
    }
  };

  const initiateMultipartUpload = async (
    file: File,
    chunkSize: number = CHUNK_SIZE,
    customEndpoint?: string,
    customPayload?: Record<string, any>
  ): Promise<MultipartUploadResponse> => {
    const endpoint = customEndpoint || '/api/video-upload/initiate-multipart';
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('admin_token') || localStorage.getItem('auth_token') || localStorage.getItem('sb-szghyvnbmjlquznxhqum-auth-token'))
      : null;

    const payload = {
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size,
      chunkSize,
      ...customPayload,
    };

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  };

  const completeMultipartUpload = async (
    uploadId: string,
    key: string,
    parts: UploadPart[],
    customEndpoint?: string,
    customPayload?: Record<string, any>
  ): Promise<string> => {
    const endpoint = customEndpoint || '/api/video-upload/complete-multipart';
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('admin_token') || localStorage.getItem('auth_token') || localStorage.getItem('sb-szghyvnbmjlquznxhqum-auth-token'))
      : null;

    const payload = {
      uploadId,
      key,
      parts,
      ...customPayload,
    };

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.location || data.data?.video_url || data.video_url;
  };

  const abortMultipartUpload = async (uploadId: string, key: string): Promise<void> => {
    await api.abortMultipartUpload({
      uploadId,
      key,
    });
  };

  const uploadVideo = useCallback(async (
    file: File,
    options: UploadOptions = {}
  ): Promise<UploadResult> => {
    if (isUploading) {
      throw new Error('Upload already in progress');
    }

    setIsUploading(true);
    setIsPaused(false);
    abortControllerRef.current = new AbortController();

    try {
      const chunkSize = options.chunkSize || CHUNK_SIZE;
      const totalChunks = Math.ceil(file.size / chunkSize);

      // For small files OR when presignedUrl endpoint is provided, use direct upload
      const useDirectUpload = file.size < chunkSize || options.customEndpoints?.presignedUrl;

      if (useDirectUpload) {
        const endpoint = options.customEndpoints?.presignedUrl || '/api/video-upload/presigned-url';
        const token = typeof window !== 'undefined'
          ? (localStorage.getItem('admin_token') || localStorage.getItem('auth_token') || localStorage.getItem('sb-szghyvnbmjlquznxhqum-auth-token'))
          : null;

        const payload = {
          filename: file.name,
          contentType: file.type,
          ...options.customPayload,
        };

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.message || `HTTP error! status: ${response.status}`);
        }

        const { uploadUrl, fileUrl, key } = await response.json();

        // Upload directly to S3 using presigned URL
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
          signal: abortControllerRef.current.signal,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed with status: ${uploadResponse.status}`);
        }

        options.onProgress?.({
          loaded: file.size,
          total: file.size,
          percentage: 100,
        });

        return {
          videoKey: key || file.name,
          metadata: {
            size: file.size,
            type: file.type,
            uploadMethod: 'direct',
            fileUrl,
          },
        };
      }

      // Multipart upload for large files
      const { uploadId, key, presignedUrls } = await initiateMultipartUpload(
        file,
        chunkSize,
        options.customEndpoints?.initiate,
        options.customPayload
      );

      currentUploadRef.current = {
        uploadId,
        key,
        parts: [],
        currentPartIndex: 0,
        file,
        presignedUrls,
        onProgress: options.onProgress,
      };

      let uploadedBytes = 0;

      for (let i = 0; i < totalChunks; i++) {
        // Check if upload was paused or cancelled
        while (isPaused && !abortControllerRef.current.signal.aborted) {
          await sleep(100);
        }

        if (abortControllerRef.current.signal.aborted) {
          throw new Error('Upload cancelled');
        }

        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        const etag = await uploadChunk(chunk, presignedUrls[i], i + 1);

        currentUploadRef.current.parts.push({
          ETag: etag,
          PartNumber: i + 1,
        });

        uploadedBytes += chunk.size;
        currentUploadRef.current.currentPartIndex = i + 1;

        const progress = {
          loaded: uploadedBytes,
          total: file.size,
          percentage: Math.round((uploadedBytes / file.size) * 100),
        };

        setUploadProgress(progress);
        options.onProgress?.(progress);
      }

      // Complete multipart upload
      const location = await completeMultipartUpload(
        uploadId,
        key,
        currentUploadRef.current.parts,
        options.customEndpoints?.complete,
        options.customPayload
      );

      return {
        videoKey: key,
        metadata: {
          size: file.size,
          type: file.type,
          uploadMethod: 'multipart',
          location,
          parts: currentUploadRef.current.parts.length,
        },
      };
    } catch (error) {
      // Cleanup on error
      if (currentUploadRef.current && !abortControllerRef.current.signal.aborted) {
        try {
          await abortMultipartUpload(currentUploadRef.current.uploadId, currentUploadRef.current.key);
        } catch (cleanupError) {
          console.warn('Failed to cleanup multipart upload:', cleanupError);
        }
      }
      throw error;
    } finally {
      setIsUploading(false);
      setIsPaused(false);
      currentUploadRef.current = null;
      abortControllerRef.current = null;
    }
  }, [isUploading, isPaused]);

  const pauseUpload = useCallback(() => {
    if (isUploading && !isPaused) {
      setIsPaused(true);
    }
  }, [isUploading, isPaused]);

  const resumeUpload = useCallback(() => {
    if (isUploading && isPaused) {
      setIsPaused(false);
    }
  }, [isUploading, isPaused]);

  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsUploading(false);
    setIsPaused(false);
    setUploadProgress(null);
  }, []);

  const generateSignedUrl = useCallback(async (
    videoKey: string,
    expiresInMinutes: number = 60
  ): Promise<string> => {
    const response = await api.get(`/api/video-upload/signed-url/${videoKey}`, {
      params: { expiresInMinutes },
    });

    return response.data.streamingUrl;
  }, []);

  const getVideoStreamingInfo = useCallback(async (videoKey: string) => {
    const response = await api.get(`/api/video-upload/streaming-info/${videoKey}`);
    return response.data;
  }, []);

  return {
    uploadVideo,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    generateSignedUrl,
    getVideoStreamingInfo,
    isUploading,
    isPaused,
    uploadProgress,
  };
};