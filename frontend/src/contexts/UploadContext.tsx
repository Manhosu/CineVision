'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

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
  conversionProgress?: number; // 0-100 para conversão
  needsConversion?: boolean; // true se é MKV
  completedAt?: number; // timestamp quando a tarefa foi concluída
}

interface UploadContextType {
  tasks: UploadTask[];
  addTask: (task: UploadTask) => void;
  updateTask: (id: string, updates: Partial<UploadTask>) => void;
  removeTask: (id: string) => void;
  cancelTask: (id: string) => void;
  clearAllTasks: () => void;
  clearStuckTasks: () => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

const STORAGE_KEY = 'cinevision_upload_tasks';

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
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
    setTasks(prev => [...prev, task]);
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

    // Abort upload in backend if it has uploadId
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

  // Auto-remove completed, error, and cancelled tasks after 5 seconds
  // Also remove stuck uploads (uploading but 0% for more than 30 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      setTasks(prev => {
        const now = Date.now();
        return prev.filter(task => {
          const taskTime = parseInt(task.id.split('-')[1] || '0');
          const age = now - taskTime;

          // Remove stuck uploads (uploading but 0% progress for more than 30 seconds)
          if (task.status === 'uploading' && task.progress === 0 && age > 30000) {
            console.log('Removing stuck upload:', task.id);
            return false;
          }

          // Keep uploading tasks that are making progress
          if (task.status === 'uploading') return true;

          // Auto-remove completed, error, or cancelled tasks older than 5 seconds
          return age < 5000; // Keep for 5 seconds
        });
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <UploadContext.Provider value={{ tasks, addTask, updateTask, removeTask, cancelTask, clearAllTasks, clearStuckTasks }}>
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
