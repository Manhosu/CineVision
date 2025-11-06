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
    console.log('[UploadContext] addTask called with:', task);
    setTasks(prev => {
      const newTasks = [...prev, task];
      console.log('[UploadContext] New tasks array:', newTasks);
      return newTasks;
    });
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<UploadTask>) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === id ? { ...task, ...updates } : task
      )
    );
  }, []);

  const removeTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(task => task.id !== id));
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
        return prev.filter(task => {
          // NEVER auto-remove episode tasks - they persist until manually cleared
          if (task.type === 'episode') {
            return true;
          }

          const taskTime = parseInt(task.id.split('-')[1] || '0');
          const age = now - taskTime;

          // Remove stuck movie uploads (uploading but 0% progress for more than 30 seconds)
          if (task.status === 'uploading' && task.progress === 0 && age > 30000) {
            console.log('Removing stuck movie upload:', task.id);
            return false;
          }

          // Keep uploading movie tasks that are making progress
          if (task.status === 'uploading') return true;

          // Auto-remove completed, error, or cancelled movie tasks older than 2 minutes
          return age < 120000; // Keep for 2 minutes so user can see upload result
        });
      });
    }, 1000);

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
