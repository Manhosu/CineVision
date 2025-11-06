'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface PendingUpload {
  id: string;
  file: File;
  contentId: string;

  // Episode-specific fields (for series)
  episodeId?: string;
  episodeTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;

  // Language-specific fields (for movies)
  languageId?: string;
  languageName?: string;
  contentTitle?: string;

  // Upload type
  type: 'episode' | 'language';
}

export interface UploadTask {
  id: string;
  fileName: string;
  contentTitle: string;
  progress: number;
  status: 'uploading' | 'completed' | 'converting' | 'ready' | 'error' | 'cancelled';
  error?: string;
  cancelRequested?: boolean;
  uploadId?: string;
  languageId?: string;
  conversionProgress?: number; // 0-100 para conversão (deprecated)
  needsConversion?: boolean; // deprecated - only MP4 allowed now
  completedAt?: number; // timestamp quando a tarefa foi concluída

  // Episode-specific fields
  type?: 'movie' | 'episode'; // tipo de upload
  episodeId?: string; // ID do episódio
  seasonNumber?: number; // número da temporada
  episodeNumber?: number; // número do episódio
  processingStatus?: 'pending' | 'processing' | 'ready' | 'failed'; // status do processamento no backend
}

interface UploadContextType {
  tasks: UploadTask[];
  pendingUploads: PendingUpload[];
  addTask: (task: UploadTask) => void;
  updateTask: (id: string, updates: Partial<UploadTask>) => void;
  removeTask: (id: string) => void;
  cancelTask: (id: string) => void;
  clearAllTasks: () => void;
  clearStuckTasks: () => void;
  addPendingUpload: (upload: PendingUpload) => void;
  removePendingUpload: (id: string) => void;
  clearPendingUploads: () => void;
  getPendingUploadByEpisode: (episodeId: string) => PendingUpload | undefined;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

const STORAGE_KEY = 'cinevision_upload_tasks';

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [mounted, setMounted] = useState(false);

  // Load tasks from localStorage on mount
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setTasks(parsed);
        }
      } catch (error) {
        console.error('Error loading upload tasks:', error);
      }
    }
  }, []);

  // Save tasks to localStorage whenever they change
  useEffect(() => {
    if (mounted && typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      } catch (error) {
        console.error('Error saving upload tasks:', error);
      }
    }
  }, [tasks, mounted]);

  const addTask = useCallback((task: UploadTask) => {
    console.log('[UploadContext] ✅ ADDING TASK:', {
      id: task.id,
      type: task.type,
      fileName: task.fileName,
      status: task.status,
      progress: task.progress
    });
    setTasks(prev => {
      const newTasks = [...prev, task];
      console.log('[UploadContext] Total tasks after add:', newTasks.length);
      return newTasks;
    });
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<UploadTask>) => {
    console.log('[UploadContext] 🔄 UPDATING TASK:', id, updates);
    setTasks(prev =>
      prev.map(task =>
        task.id === id ? { ...task, ...updates } : task
      )
    );
  }, []);

  const removeTask = useCallback((id: string) => {
    console.log('[UploadContext] ❌ REMOVING TASK:', id);
    setTasks(prev => {
      const task = prev.find(t => t.id === id);
      if (task) {
        console.log('[UploadContext] Task being removed:', {
          id: task.id,
          type: task.type,
          status: task.status,
          progress: task.progress
        });
      }
      return prev.filter(task => task.id !== id);
    });
  }, []);

  const cancelTask = useCallback(async (id: string) => {
    const task = tasks.find(t => t.id === id);

    if (!task) return;

    // Mark as cancel requested first
    setTasks(prev =>
      prev.map(t =>
        t.id === id ? { ...t, cancelRequested: true, status: 'cancelled' as const } : t
      )
    );

    // Abort upload in backend if it's a movie upload (has languageId)
    if (task.uploadId && task.languageId) {
      try {
        const token = typeof window !== 'undefined'
          ? (localStorage.getItem('admin_token') || localStorage.getItem('auth_token') || localStorage.getItem('sb-szghyvnbmjlquznxhqum-auth-token'))
          : null;

        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/content-language-upload/abort-multipart`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify({
            content_language_id: task.languageId,
            upload_id: task.uploadId,
          }),
        });

        console.log(`[UploadContext] ✅ Upload cancelado: ${task.fileName}`);
      } catch (error) {
        console.error(`[UploadContext] Erro ao cancelar upload:`, error);
      }
    } else if (task.type === 'episode') {
      // For episodes, we can't abort multipart uploads yet (no backend endpoint)
      // Just mark as cancelled - the upload will continue in background but be ignored
      console.log(`[UploadContext] ⚠️ Episode upload marked as cancelled (no backend abort): ${task.fileName}`);
    }
  }, [tasks]);

  const clearAllTasks = useCallback(() => {
    setTasks([]);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.error('Error clearing upload tasks:', error);
      }
    }
  }, []);

  const clearStuckTasks = useCallback(async () => {
    const uploadingTasks = tasks.filter(task => task.status === 'uploading');

    // Abortar uploads no backend se tiverem uploadId
    for (const task of uploadingTasks) {
      if (task.uploadId && task.languageId) {
        try {
          const token = typeof window !== 'undefined'
            ? (localStorage.getItem('admin_token') || localStorage.getItem('auth_token') || localStorage.getItem('sb-szghyvnbmjlquznxhqum-auth-token'))
            : null;

          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/content-language-upload/abort-multipart`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token ? `Bearer ${token}` : '',
            },
            body: JSON.stringify({
              content_language_id: task.languageId,
              upload_id: task.uploadId,
            }),
          });

          console.log(`[UploadContext] Aborted upload for task ${task.id}`);
        } catch (error) {
          console.error(`[UploadContext] Error aborting upload for task ${task.id}:`, error);
        }
      }
    }

    // Remover tarefas travadas
    setTasks(prev => prev.filter(task => task.status !== 'uploading'));

    // Limpar localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.error('Error clearing localStorage:', error);
      }
    }

    console.log(`[UploadContext] ✅ Cleared ${uploadingTasks.length} stuck upload(s)`);
  }, [tasks]);

  // Pending upload functions
  const addPendingUpload = useCallback((upload: PendingUpload) => {
    setPendingUploads(prev => {
      // Replace if already exists for this episode
      const filtered = prev.filter(p => p.episodeId !== upload.episodeId);
      return [...filtered, upload];
    });
  }, []);

  const removePendingUpload = useCallback((id: string) => {
    setPendingUploads(prev => prev.filter(p => p.id !== id));
  }, []);

  const clearPendingUploads = useCallback(() => {
    setPendingUploads([]);
  }, []);

  const getPendingUploadByEpisode = useCallback((episodeId: string) => {
    return pendingUploads.find(p => p.episodeId === episodeId);
  }, [pendingUploads]);

  // Auto-remove completed, error, and cancelled tasks after 5 seconds (ONLY for movies, NOT episodes)
  // Episodes persist until manually cleared
  useEffect(() => {
    const timer = setInterval(() => {
      setTasks(prev => {
        const now = Date.now();

        // Log all current tasks for debugging
        const movieTasks = prev.filter(t => t.type === 'movie');
        if (movieTasks.length > 0) {
          console.log('[UploadContext] Auto-removal check - Movie tasks:', movieTasks.map(t => ({
            id: t.id,
            status: t.status,
            progress: t.progress,
            age: now - parseInt(t.id.split('-')[1] || '0')
          })));
        }

        return prev.filter(task => {
          // NEVER auto-remove episode tasks - they persist until manually cleared
          if (task.type === 'episode') {
            return true;
          }

          // TEMPORARILY: NEVER auto-remove movie tasks during upload to debug the issue
          // Once we confirm uploads work, we can re-enable auto-removal for completed tasks
          if (task.type === 'movie') {
            console.log('[UploadContext] Keeping movie task (auto-removal disabled for debugging):', task.id, 'status:', task.status, 'progress:', task.progress);
            return true;
          }

          return true;
        });
      });
    }, 5000); // Check every 5 seconds instead of 1 second to reduce log spam

    return () => clearInterval(timer);
  }, []);

  return (
    <UploadContext.Provider value={{
      tasks,
      pendingUploads,
      addTask,
      updateTask,
      removeTask,
      cancelTask,
      clearAllTasks,
      clearStuckTasks,
      addPendingUpload,
      removePendingUpload,
      clearPendingUploads,
      getPendingUploadByEpisode
    }}>
      {children}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  const context = useContext(UploadContext);
  if (context === undefined) {
    throw new Error('useUpload must be used within an UploadProvider');
  }
  return context;
}
