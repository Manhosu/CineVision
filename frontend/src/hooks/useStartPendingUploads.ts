import { useEffect, useRef } from 'react';
import { useUpload } from '@/contexts/UploadContext';
import { supabase } from '@/lib/supabase';

export function useStartPendingUploads() {
  const { pendingUploads, addTask, updateTask, removePendingUpload } = useUpload();
  const isProcessing = useRef(false);

  useEffect(() => {
    console.log('[useStartPendingUploads] Effect triggered:', {
      pendingUploadsLength: pendingUploads.length,
      isProcessing: isProcessing.current,
      pendingUploads: pendingUploads.map(p => ({
        id: p.id,
        type: p.type,
        hasFile: !!p.file,
        fileName: p.file?.name
      }))
    });

    // Only start if there are pending uploads and not already processing
    if (pendingUploads.length > 0 && !isProcessing.current) {
      isProcessing.current = true;
      startAllUploads();
    }
  }, [pendingUploads.length]); // Trigger when pending uploads change

  const startAllUploads = async () => {
    console.log(`[useStartPendingUploads] Starting ${pendingUploads.length} pending upload(s) with concurrency limit of 2`);

    const MAX_CONCURRENT_UPLOADS = 2;
    const queue = [...pendingUploads];
    let activeCount = 0;

    // Helper to process one upload
    const processUpload = async (pendingUpload: any) => {
      activeCount++;
      console.log(`[useStartPendingUploads] ⬆️ Starting upload (${activeCount}/${MAX_CONCURRENT_UPLOADS}):`, pendingUpload.file?.name);

      try {
        if (pendingUpload.type === 'episode') {
          await uploadEpisodeFile(pendingUpload);
        } else if (pendingUpload.type === 'language') {
          await uploadLanguageFile(pendingUpload);
        } else {
          console.error('[useStartPendingUploads] Unknown upload type:', pendingUpload);
        }
      } finally {
        activeCount--;
        console.log(`[useStartPendingUploads] ⬇️ Upload completed. Active: ${activeCount}, Remaining: ${queue.length}`);

        // Start next upload if available
        if (queue.length > 0) {
          const nextUpload = queue.shift()!;
          processUpload(nextUpload); // Fire and forget
        }
      }
    };

    // Start initial batch (up to MAX_CONCURRENT_UPLOADS)
    const initialBatch = queue.splice(0, MAX_CONCURRENT_UPLOADS);
    const uploadPromises = initialBatch.map(upload => processUpload(upload));

    // Wait for all uploads to complete
    await Promise.allSettled(uploadPromises);

    // Wait for any remaining uploads from the queue to finish
    while (activeCount > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    isProcessing.current = false;
    console.log('[useStartPendingUploads] ✅ All uploads completed');
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
        const errorData = await completeResponse.json().catch(() => ({ message: 'Erro desconhecido' }));
        console.error('[useStartPendingUploads] Erro ao completar upload:', errorData);
        throw new Error(errorData.message || 'Erro ao finalizar upload');
      }

      const completeData = await completeResponse.json();
      console.log('[useStartPendingUploads] Upload concluído com sucesso! Resposta:', completeData);

      // Mark as ready immediately (no video processing needed)
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

  const uploadLanguageFile = async (pendingUpload: any) => {
    const { id, file, languageId, languageName, contentTitle, contentId } = pendingUpload;

    // Create unique task ID
    const taskId = `language-${languageId}-${Date.now()}`;

    try {
      // Add task to upload context
      addTask({
        id: taskId,
        fileName: file.name,
        contentTitle: contentTitle || `${languageName}`,
        progress: 0,
        status: 'uploading',
        type: 'movie',
        languageId,
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

      console.log('[useStartPendingUploads] Iniciando upload de linguagem:', {
        languageId,
        fileName: file.name,
        size: file.size,
        contentType
      });

      // 1. Initialize multipart upload for language
      const initResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/content-language-upload/initiate-multipart`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content_language_id: languageId,
          filename: file.name,
          content_type: contentType,
          file_size: file.size,
        }),
      });

      if (!initResponse.ok) {
        const errorData = await initResponse.json().catch(() => ({ message: 'Erro desconhecido' }));
        throw new Error(errorData.message || 'Erro ao iniciar upload');
      }

      const { upload_id, presigned_urls } = await initResponse.json();
      const uploadedParts: { ETag: string; PartNumber: number }[] = [];

      console.log('[useStartPendingUploads] Upload de linguagem iniciado:', { upload_id, partsCount: presigned_urls.length });

      // Update task with uploadId
      updateTask(taskId, { uploadId: upload_id });

      // 2. Upload chunks
      const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
      for (let i = 0; i < presigned_urls.length; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const partResponse = await fetch(presigned_urls[i], {
          method: 'PUT',
          body: chunk,
          headers: {
            'Content-Type': contentType,
          },
        });

        if (!partResponse.ok) {
          throw new Error(`Erro ao fazer upload da parte ${i + 1}`);
        }

        const etag = partResponse.headers.get('ETag');
        if (!etag) {
          throw new Error(`ETag não retornado para parte ${i + 1}`);
        }

        uploadedParts.push({
          ETag: etag.replace(/"/g, ''),
          PartNumber: i + 1
        });

        // Update progress
        const progress = Math.round(((i + 1) / presigned_urls.length) * 100);
        updateTask(taskId, { progress });
      }

      console.log('[useStartPendingUploads] Upload de partes de linguagem concluído');

      // 3. Complete upload
      const completeResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/content-language-upload/complete-multipart`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            content_language_id: languageId,
            upload_id: upload_id,
            parts: uploadedParts,
          }),
        }
      );

      if (!completeResponse.ok) {
        const errorData = await completeResponse.json();
        throw new Error(errorData.message || 'Erro ao finalizar upload');
      }

      console.log('[useStartPendingUploads] Upload de linguagem concluído com sucesso!');

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
      console.error('[useStartPendingUploads] Erro no upload de linguagem:', error);

      updateTask(taskId, {
        status: 'error',
        error: error.message || 'Erro no upload',
      });

      // Don't remove from pending if it failed - user might retry
    }
  };

  return { uploadsInProgress: isProcessing.current };
}
