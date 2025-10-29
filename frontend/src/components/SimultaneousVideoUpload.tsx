'use client';

import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { useUpload } from '@/contexts/UploadContext';
import { supabase } from '@/lib/supabase';

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
      console.log('[SimultaneousVideoUpload] Adding DUBLADO to upload queue');
      uploads.push(uploadFile(videos.DUBLADO.file, 'DUBLADO'));
    }

    if (videos.LEGENDADO.file) {
      console.log('[SimultaneousVideoUpload] Adding LEGENDADO to upload queue');
      uploads.push(uploadFile(videos.LEGENDADO.file, 'LEGENDADO'));
    }

    console.log(`[SimultaneousVideoUpload] Starting ${uploads.length} uploads in parallel`);

    try {
      // Use Promise.allSettled para que um upload falhado não cancele o outro
      const results = await Promise.allSettled(uploads);

      console.log('[SimultaneousVideoUpload] All uploads finished:', {
        total: results.length,
        fulfilled: results.filter(r => r.status === 'fulfilled').length,
        rejected: results.filter(r => r.status === 'rejected').length
      });

      // Log erros de uploads que falharam
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`[SimultaneousVideoUpload] Upload ${index} failed:`, result.reason);
        }
      });

      onUploadComplete?.();
    } catch (error) {
      console.error('[SimultaneousVideoUpload] Unexpected error:', error);
    }
  };

  const uploadFile = async (file: File, type: 'DUBLADO' | 'LEGENDADO') => {

    // Create task ID and add to UploadContext
    // Use crypto.randomUUID() para garantir IDs únicos, ou fallback para Date.now() + random
    const uniqueId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const taskId = `upload-${type}-${uniqueId}`;
    taskIdsRef.current[type] = taskId;

    console.log(`[SimultaneousVideoUpload] Creating upload task for ${type}:`, {
      taskId,
      fileName: file.name,
      fileSize: file.size
    });

    // Variable to track abort controller
    let abortController = new AbortController();

    // Validate file format - only MP4 allowed
    if (!file.name.toLowerCase().endsWith('.mp4')) {
      toast.error('Apenas arquivos MP4 são aceitos');
      setVideos((prev) => ({
        ...prev,
        [type]: { status: 'idle', file: null, progress: 0 },
      }));
      return;
    }

    addTask({
      id: taskId,
      fileName: file.name,
      contentTitle: `Vídeo ${type === 'DUBLADO' ? 'Dublado' : 'Legendado'}`,
      progress: 0,
      status: 'uploading',
      cancelRequested: false,
      needsConversion: false,
      conversionProgress: 0,
      type: 'movie', // Define tipo como filme para exibir no modal correto
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

      // Get fresh auth token from Supabase session (handles token refresh automatically)
      let token: string | null = null;

      if (typeof window !== 'undefined') {
        // First try to get backend JWT token
        const backendToken = localStorage.getItem('access_token');
        if (backendToken) {
          token = backendToken;
        } else {
          // Fallback to Supabase session token (auto-refreshed)
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) {
            console.error('[SimultaneousVideoUpload] Error getting session:', error);
          }

          if (session?.access_token) {
            token = session.access_token;
            // Update localStorage for consistency
            localStorage.setItem('auth_token', token);
          } else {
            // Last fallback: try localStorage (but this might be stale)
            token = localStorage.getItem('token') || localStorage.getItem('auth_token');
          }
        }
      }

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
          case 'mov':
            return 'video/quicktime';
          default:
            return 'video/mp4'; // Default fallback
        }
      };

      const contentType = getContentType(file);

      // Log details before making the fetch call
      console.log('[SimultaneousVideoUpload] ========== UPLOAD INIT DEBUG ==========');
      console.log('[SimultaneousVideoUpload] File:', {
        name: file.name,
        size: file.size,
        type: file.type,
        contentType
      });
      console.log('[SimultaneousVideoUpload] API URL:', process.env.NEXT_PUBLIC_API_URL);
      console.log('[SimultaneousVideoUpload] Token:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
      console.log('[SimultaneousVideoUpload] Request payload:', {
        contentId,
        filename: file.name,
        contentType,
        size: file.size,
        audioType: type.toLowerCase()
      });
      console.log('[SimultaneousVideoUpload] Headers:', headers);

      // 1. Iniciar upload multipart
      console.log('[SimultaneousVideoUpload] Making fetch call to /api/v1/admin/uploads/init...');
      let initResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/uploads/init`, {
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

      console.log('[SimultaneousVideoUpload] Response received:', {
        ok: initResponse.ok,
        status: initResponse.status,
        statusText: initResponse.statusText
      });

      // Handle 401 by refreshing token and retrying
      if (!initResponse.ok && initResponse.status === 401) {
        console.log('[SimultaneousVideoUpload] Got 401, attempting to refresh token...');

        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          try {
            const refreshResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/refresh`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ refresh_token: refreshToken }),
            });

            if (refreshResponse.ok) {
              const { access_token, refresh_token: newRefreshToken } = await refreshResponse.json();

              // Update tokens in localStorage
              localStorage.setItem('access_token', access_token);
              if (newRefreshToken) {
                localStorage.setItem('refresh_token', newRefreshToken);
              }

              console.log('[SimultaneousVideoUpload] Token refreshed successfully, retrying upload...');

              // Update headers with new token
              headers['Authorization'] = `Bearer ${access_token}`;

              // Retry the init request with new token
              initResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/uploads/init`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  contentId: contentId,
                  filename: file.name,
                  contentType: contentType,
                  size: file.size,
                  audioType: type.toLowerCase(),
                }),
              });

              console.log('[SimultaneousVideoUpload] Retry response:', {
                ok: initResponse.ok,
                status: initResponse.status
              });
            } else {
              throw new Error('Não foi possível renovar o token. Faça logout e login novamente.');
            }
          } catch (refreshError) {
            console.error('[SimultaneousVideoUpload] Token refresh failed:', refreshError);
            throw new Error('Autenticação falhou. Faça logout e login novamente no painel admin.');
          }
        } else {
          throw new Error('Autenticação falhou. Faça logout e login novamente no painel admin.');
        }
      }

      // Now check if the request (original or retry) was successful
      if (!initResponse.ok) {
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

      // Conversion is no longer needed - only MP4 files are accepted
      const needsConversion = false;

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
      } else {
        // Se NÃO precisa conversão (upload direto), verificar se pode publicar
        checkAndPublishIfComplete();
      }
    } catch (error: any) {
      console.error('[SimultaneousVideoUpload] ========== UPLOAD ERROR ==========');
      console.error(`[SimultaneousVideoUpload] Upload error for ${type}:`, error);
      console.error('[SimultaneousVideoUpload] Error message:', error?.message);
      console.error('[SimultaneousVideoUpload] Error stack:', error?.stack);

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

  // Função para verificar se todos os uploads estão completos e publicar automaticamente
  const checkAndPublishIfComplete = async () => {
    // Aguardar um pequeno delay para garantir que o estado foi atualizado
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Pegar todas as tasks deste contentId
    const contentTasks = tasks.filter(t => t.id.includes('upload-'));

    // Verificar se TODAS as tasks estão ready ou error
    const allCompleted = contentTasks.every(t => t.status === 'ready' || t.status === 'error');
    const hasAtLeastOneReady = contentTasks.some(t => t.status === 'ready');

    console.log('[Auto-Publish] Verificando se pode publicar:', {
      allCompleted,
      hasAtLeastOneReady,
      tasks: contentTasks.map(t => ({ id: t.id, status: t.status }))
    });

    if (allCompleted && hasAtLeastOneReady && contentId) {
      console.log('[Auto-Publish] ✅ Todos os uploads concluídos! Publicando conteúdo...');

      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/content/${contentId}/publish`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          console.log('[Auto-Publish] ✅ Conteúdo publicado e notificações enviadas automaticamente!');
        } else {
          console.error('[Auto-Publish] ❌ Erro ao publicar conteúdo');
        }
      } catch (error) {
        console.error('[Auto-Publish] ❌ Erro ao publicar:', error);
      }
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

            // Verificar se todos os uploads estão completos e publicar
            checkAndPublishIfComplete();

            return; // Para o polling
          } else if (processing_status === 'error' || processing_status === 'failed') {
            updateTask(taskId, {
              status: 'error',
              error: 'Erro na conversão do vídeo',
            });
            console.error(`[Conversion Poll] ❌ Erro na conversão para task ${taskId}`);

            // Verificar se todos os uploads estão completos (mesmo com erro)
            checkAndPublishIfComplete();

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
