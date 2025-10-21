'use client';

import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { useUpload } from '@/contexts/UploadContext';

interface VideoFile {
  file: File | null;
  languageType: 'DUBLADO' | 'LEGENDADO';
  progress: number;
  status: 'idle' | 'uploading' | 'completed' | 'error';
  error?: string;
  uploadedSize: number;
  totalSize: number;
  speed: number;
}

interface Props {
  contentId: string;
  onUploadComplete?: () => void;
}

export interface SimultaneousVideoUploadRef {
  startUpload: () => Promise<void>;
  hasFiles: () => boolean;
}

export const SimultaneousVideoUpload = forwardRef<SimultaneousVideoUploadRef, Props>(
  ({ contentId, onUploadComplete }, ref) => {
  const { addTask, updateTask, tasks } = useUpload();
  const [videos, setVideos] = useState<{
    DUBLADO: VideoFile;
    LEGENDADO: VideoFile;
  }>({
    DUBLADO: {
      file: null,
      languageType: 'DUBLADO',
      progress: 0,
      status: 'idle',
      uploadedSize: 0,
      totalSize: 0,
      speed: 0,
    },
    LEGENDADO: {
      file: null,
      languageType: 'LEGENDADO',
      progress: 0,
      status: 'idle',
      uploadedSize: 0,
      totalSize: 0,
      speed: 0,
    },
  });

  const taskIdsRef = useRef<{ DUBLADO?: string; LEGENDADO?: string }>({});

  const handleFileSelect = (type: 'DUBLADO' | 'LEGENDADO', file: File) => {
    setVideos((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        file,
        totalSize: file.size,
        status: 'idle',
        progress: 0,
        error: undefined,
      },
    }));
  };

  const startSimultaneousUpload = async () => {
    console.log('[SimultaneousVideoUpload] startSimultaneousUpload called');
    console.log('[SimultaneousVideoUpload] Videos state:', {
      dublado: videos.DUBLADO.file?.name,
      legendado: videos.LEGENDADO.file?.name
    });

    if (!videos.DUBLADO.file && !videos.LEGENDADO.file) {
      console.error('[SimultaneousVideoUpload] Nenhum arquivo selecionado');
      alert('Selecione pelo menos um arquivo para upload');
      return;
    }

    // Upload both files simultaneously
    const uploads = [];

    if (videos.DUBLADO.file) {
      uploads.push(uploadFile(videos.DUBLADO.file, 'DUBLADO'));
    }

    if (videos.LEGENDADO.file) {
      uploads.push(uploadFile(videos.LEGENDADO.file, 'LEGENDADO'));
    }

    try {
      await Promise.all(uploads);
      onUploadComplete?.();
    } catch (error) {
      console.error('Upload error:', error);
    }
  };

  const uploadFile = async (file: File, type: 'DUBLADO' | 'LEGENDADO') => {

    // Create task ID and add to UploadContext
    const taskId = `upload-${Date.now()}-${type}`;
    taskIdsRef.current[type] = taskId;

    // Variable to track abort controller
    let abortController = new AbortController();

    // Check if file needs conversion (MKV files)
    const needsConversion = file.name.toLowerCase().endsWith('.mkv');

    addTask({
      id: taskId,
      fileName: file.name,
      contentTitle: `Vídeo ${type === 'DUBLADO' ? 'Dublado' : 'Legendado'}`,
      progress: 0,
      status: 'uploading',
      cancelRequested: false,
      needsConversion,
      conversionProgress: 0,
    });

    try {
      // Marcar como uploading
      setVideos((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          status: 'uploading',
          progress: 0,
        },
      }));

      // Get auth token with automatic refresh
      const { getValidAccessToken } = await import('../lib/authTokens');
      const token = await getValidAccessToken();

      if (!token) {
        throw new Error('Não foi possível obter token de autenticação. Faça login novamente.');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };

      // Detect content type from file
      const getContentType = (file: File): string => {
        // Try to get from file.type first
        if (file.type && file.type.startsWith('video/')) {
          return file.type;
        }

        // Fallback based on file extension
        const extension = file.name.split('.').pop()?.toLowerCase();
        switch (extension) {
          case 'mp4':
            return 'video/mp4';
          case 'mkv':
            return 'video/x-matroska';
          case 'mov':
            return 'video/quicktime';
          default:
            return 'video/mp4'; // Default fallback
        }
      };

      const contentType = getContentType(file);

      // 1. Iniciar upload multipart
      const initResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/uploads/init`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          contentId: contentId,
          filename: file.name,
          contentType: contentType,
          size: file.size,
          audioType: type.toLowerCase(), // 'dublado' or 'legendado'
        }),
      });

      if (!initResponse.ok) {
        if (initResponse.status === 401) {
          throw new Error('Autenticação falhou. Faça logout e login novamente no painel admin.');
        }
        const errorData = await initResponse.json().catch(() => ({ message: 'Erro desconhecido' }));
        throw new Error(errorData.message || 'Erro ao iniciar upload');
      }

      const initData = await initResponse.json();
      const { uploadId, key, partSize, partsCount, presignedUrls, languageId: initialLanguageId } = initData;
      const uploadedParts: { ETag: string; PartNumber: number }[] = [];

      // Store uploadId and languageId in task for cancellation
      updateTask(taskId, {
        uploadId,
        languageId: initialLanguageId
      });

      // 2. Upload dos chunks usando presigned URLs
      for (let i = 0; i < presignedUrls.length; i++) {
        // Check if cancellation was requested
        const currentTask = tasks.find(t => t.id === taskId);
        if (currentTask?.cancelRequested) {
          console.log(`[SimultaneousVideoUpload] Upload cancelado para ${type}`);
          updateTask(taskId, { status: 'cancelled' });
          throw new Error('Upload cancelado pelo usuário');
        }

        const { partNumber, url: presignedUrl } = presignedUrls[i];
        const start = (partNumber - 1) * partSize;
        const end = Math.min(start + partSize, file.size);
        const chunk = file.slice(start, end);

        // Upload diretamente para S3 usando presigned URL
        // IMPORTANTE: Não adicionar headers customizados em presigned URLs
        // pois eles precisam estar incluídos na assinatura da URL
        const partResponse = await fetch(presignedUrl, {
          method: 'PUT',
          body: chunk,
          signal: abortController.signal,
        });

        if (!partResponse.ok) {
          throw new Error(`Erro ao fazer upload da parte ${partNumber + 1}`);
        }

        const etag = partResponse.headers.get('ETag');
        if (!etag) {
          throw new Error(`ETag não retornado para parte ${partNumber + 1}`);
        }

        uploadedParts.push({ ETag: etag.replace(/"/g, ''), PartNumber: partNumber });

        // Atualizar progresso (arredondar para 2 casas decimais)
        const progress = Math.round(((i + 1) / partsCount) * 100 * 100) / 100;

        // Update local state
        setVideos((prev) => ({
          ...prev,
          [type]: {
            ...prev[type],
            progress,
            uploadedSize: end,
            speed: 0,
          },
        }));

        // Update UploadContext
        updateTask(taskId, { progress });
      }

      // 3. Completar upload
      const completeResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/uploads/complete`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            uploadId,
            key,
            parts: uploadedParts,
            contentId: contentId,
          }),
        }
      );

      if (!completeResponse.ok) {
        const errorData = await completeResponse.json();
        throw new Error(errorData.message || 'Erro ao finalizar upload');
      }

      // Marcar como completo
      setVideos((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          status: 'completed',
          progress: 100,
        },
      }));

      // Get languageId from complete response
      const completeData = await completeResponse.json();
      const languageId = completeData.languageId;

      // Update UploadContext - marca como completed se não precisa conversão, ou converting se precisa
      const finalStatus = needsConversion ? 'converting' : 'ready';
      updateTask(taskId, {
        status: finalStatus,
        progress: 100,
        languageId,
        conversionProgress: needsConversion ? 0 : undefined,
        completedAt: finalStatus === 'ready' ? Date.now() : undefined,
      });

      // Se precisa de conversão, iniciar polling
      if (needsConversion && languageId) {
        startConversionPolling(taskId, languageId, token);
      }
    } catch (error: any) {
      console.error(`Upload error for ${type}:`, error);

      // Update local state
      setVideos((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          status: 'error',
          error: error.message || 'Erro no upload',
        },
      }));

      // Update UploadContext
      updateTask(taskId, { status: 'error', error: error.message || 'Erro no upload' });
      throw error;
    }
  };

  // Função para fazer polling do status de conversão
  const startConversionPolling = async (taskId: string, languageId: string, token: string | null) => {
    const pollInterval = 3000; // 3 segundos
    const maxAttempts = 600; // 30 minutos máximo (600 * 3s)
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/content-language-upload/processing-status/${languageId}`,
          {
            headers: {
              'Authorization': token ? `Bearer ${token}` : '',
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const { processing_status, processing_progress } = data;

          console.log(`[Conversion Poll] Status: ${processing_status}, Progress: ${processing_progress}%`);

          // Atualizar progresso de conversão
          if (processing_status === 'processing' || processing_status === 'converting') {
            updateTask(taskId, {
              status: 'converting',
              conversionProgress: processing_progress || 0,
            });
          } else if (processing_status === 'completed' || processing_status === 'ready') {
            // Conversão concluída!
            updateTask(taskId, {
              status: 'ready',
              conversionProgress: 100,
              completedAt: Date.now(),
            });
            console.log(`[Conversion Poll] ✅ Conversão concluída para task ${taskId}`);
            return; // Para o polling
          } else if (processing_status === 'error' || processing_status === 'failed') {
            updateTask(taskId, {
              status: 'error',
              error: 'Erro na conversão do vídeo',
            });
            console.error(`[Conversion Poll] ❌ Erro na conversão para task ${taskId}`);
            return; // Para o polling
          }
        }

        // Continuar polling se não atingiu o máximo de tentativas
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, pollInterval);
        } else {
          console.warn(`[Conversion Poll] ⚠️ Timeout após ${maxAttempts} tentativas`);
          updateTask(taskId, {
            status: 'error',
            error: 'Timeout aguardando conversão',
          });
        }
      } catch (error) {
        console.error('[Conversion Poll] Erro ao verificar status:', error);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, pollInterval);
        }
      }
    };

    // Iniciar polling após 5 segundos (dar tempo para o backend iniciar a conversão)
    setTimeout(poll, 5000);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    startUpload: startSimultaneousUpload,
    hasFiles: () => Boolean(videos.DUBLADO.file || videos.LEGENDADO.file),
  }));

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-gray-800 via-gray-900 to-black rounded-2xl p-6 border border-gray-700 shadow-2xl">
        <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
          <svg className="w-7 h-7 mr-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Upload de Vídeos
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* DUBLADO */}
          <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/10 rounded-xl p-5 border-2 border-blue-500/30 hover:border-blue-500/50 transition-all">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              </div>
              <div>
                <h4 className="text-lg font-bold text-blue-300">Versão Dublada</h4>
                <p className="text-xs text-gray-400">Áudio em Português (BR)</p>
              </div>
            </div>

            <input
              type="file"
              accept="video/mp4,video/x-matroska"
              onChange={(e) => e.target.files?.[0] && handleFileSelect('DUBLADO', e.target.files[0])}
              className="hidden"
              id="dublado-file"
            />
            <label
              htmlFor="dublado-file"
              className="block w-full text-center px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-all font-medium"
            >
              {videos.DUBLADO.file ? (
                <div className="flex items-center justify-center space-x-2">
                  <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>{videos.DUBLADO.file.name}</span>
                </div>
              ) : (
                'Selecionar Arquivo'
              )}
            </label>

            {videos.DUBLADO.file && (
              <p className="mt-2 text-xs text-gray-400 text-center">
                {formatBytes(videos.DUBLADO.totalSize)}
              </p>
            )}
          </div>

          {/* LEGENDADO */}
          <div className="bg-gradient-to-br from-purple-900/20 to-purple-800/10 rounded-xl p-5 border-2 border-purple-500/30 hover:border-purple-500/50 transition-all">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
              <div>
                <h4 className="text-lg font-bold text-purple-300">Versão Legendada</h4>
                <p className="text-xs text-gray-400">Áudio Original + Legendas (PT-BR)</p>
              </div>
            </div>

            <input
              type="file"
              accept="video/mp4,video/x-matroska"
              onChange={(e) => e.target.files?.[0] && handleFileSelect('LEGENDADO', e.target.files[0])}
              className="hidden"
              id="legendado-file"
            />
            <label
              htmlFor="legendado-file"
              className="block w-full text-center px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg cursor-pointer transition-all font-medium"
            >
              {videos.LEGENDADO.file ? (
                <div className="flex items-center justify-center space-x-2">
                  <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>{videos.LEGENDADO.file.name}</span>
                </div>
              ) : (
                'Selecionar Arquivo'
              )}
            </label>

            {videos.LEGENDADO.file && (
              <p className="mt-2 text-xs text-gray-400 text-center">
                {formatBytes(videos.LEGENDADO.totalSize)}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

SimultaneousVideoUpload.displayName = 'SimultaneousVideoUpload';
