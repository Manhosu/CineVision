import { useEffect, useRef } from 'react';
import { useUpload } from '@/contexts/UploadContext';
import { supabase } from '@/lib/supabase';

export function useStartPendingUploads() {
  const { pendingUploads, addTask, updateTask, removePendingUpload } = useUpload();
  const isProcessing = useRef(false);

  useEffect(() => {
    // Only start if there are pending uploads and not already processing
    if (pendingUploads.length > 0 && !isProcessing.current) {
      isProcessing.current = true;
      startAllUploads();
    }
  }, [pendingUploads.length]); // Trigger when pending uploads change

  const startAllUploads = async () => {
    console.log(`[useStartPendingUploads] Starting ${pendingUploads.length} pending upload(s)`);

    // Start all uploads in parallel
    const uploadPromises = pendingUploads.map(pendingUpload =>
      uploadEpisodeFile(pendingUpload)
    );

    await Promise.allSettled(uploadPromises);

    isProcessing.current = false;
    console.log('[useStartPendingUploads] All uploads completed');
  };

  const uploadEpisodeFile = async (pendingUpload: any) => {
    const { id, file, episodeId, episodeTitle, seasonNumber, episodeNumber, contentId } = pendingUpload;

    // Create unique task ID
    const taskId = `episode-${episodeId}-${Date.now()}`;

    try {
      // Add task to upload context
      addTask({
        id: taskId,
        fileName: file.name,
        contentTitle: episodeTitle,
        progress: 0,
        status: 'uploading',
        type: 'episode',
        episodeId,
        seasonNumber,
        episodeNumber,
      });

      // Get auth token
      let token: string | null = null;

      if (typeof window !== 'undefined') {
        const backendToken = localStorage.getItem('access_token');
        if (backendToken) {
          token = backendToken;
        } else {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            token = session.access_token;
            localStorage.setItem('auth_token', token);
          } else {
            token = localStorage.getItem('token') || localStorage.getItem('auth_token');
          }
        }
      }

      if (!token) {
        throw new Error('Não foi possível obter token de autenticação');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };

      // Detect content type
      const contentType = file.type || 'video/mp4';

      console.log('[useStartPendingUploads] Iniciando upload:', {
        episodeId,
        fileName: file.name,
        size: file.size,
        contentType
      });

      // 1. Initialize multipart upload
      const initResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/uploads/init`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          episodeId: episodeId, // For episodes, ONLY send episodeId (not contentId)
          filename: file.name,
          contentType,
          size: file.size,
          audioType: 'original', // Episodes don't have dubbing variants
        }),
      });

      if (!initResponse.ok) {
        const errorData = await initResponse.json().catch(() => ({ message: 'Erro desconhecido' }));
        throw new Error(errorData.message || 'Erro ao iniciar upload');
      }

      const { uploadId, key, partSize, partsCount, presignedUrls } = await initResponse.json();
      const uploadedParts: { ETag: string; PartNumber: number }[] = [];

      console.log('[useStartPendingUploads] Upload iniciado:', { uploadId, partsCount });

      // Update task with uploadId
      updateTask(taskId, { uploadId });

      // 2. Upload chunks
      for (let i = 0; i < presignedUrls.length; i++) {
        const { partNumber, url: presignedUrl } = presignedUrls[i];
        const start = (partNumber - 1) * partSize;
        const end = Math.min(start + partSize, file.size);
        const chunk = file.slice(start, end);

        const partResponse = await fetch(presignedUrl, {
          method: 'PUT',
          body: chunk,
        });

        if (!partResponse.ok) {
          throw new Error(`Erro ao fazer upload da parte ${partNumber}`);
        }

        const etag = partResponse.headers.get('ETag');
        if (!etag) {
          throw new Error(`ETag não retornado para parte ${partNumber}`);
        }

        uploadedParts.push({
          ETag: etag.replace(/"/g, ''),
          PartNumber: partNumber
        });

        // Update progress
        const progress = Math.round(((i + 1) / partsCount) * 100);
        updateTask(taskId, { progress });
      }

      console.log('[useStartPendingUploads] Upload de partes concluído');

      // 3. Complete upload
      const completeResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/uploads/complete`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            uploadId,
            key,
            parts: uploadedParts,
            episodeId: episodeId, // For episodes, ONLY send episodeId (not contentId)
          }),
        }
      );

      if (!completeResponse.ok) {
        const errorData = await completeResponse.json();
        throw new Error(errorData.message || 'Erro ao finalizar upload');
      }

      console.log('[useStartPendingUploads] Upload concluído com sucesso!');

      // Mark as completed
      updateTask(taskId, {
        status: 'ready',
        progress: 100,
        processingStatus: 'ready',
        completedAt: Date.now(),
      });

      // Remove from pending uploads
      removePendingUpload(id);

    } catch (error: any) {
      console.error('[useStartPendingUploads] Erro no upload:', error);

      updateTask(taskId, {
        status: 'error',
        error: error.message || 'Erro no upload',
      });

      // Don't remove from pending if it failed - user might retry
    }
  };

  return { uploadsInProgress: isProcessing.current };
}
