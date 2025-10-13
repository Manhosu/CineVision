'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface UploadTask {
  id: string;
  fileName: string;
  contentTitle: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error' | 'cancelled';
  error?: string;
  cancelRequested?: boolean;
  uploadId?: string;
  languageId?: string;
}

interface UploadContextType {
  tasks: UploadTask[];
  addTask: (task: UploadTask) => void;
  updateTask: (id: string, updates: Partial<UploadTask>) => void;
  removeTask: (id: string) => void;
  cancelTask: (id: string) => void;
  clearAllTasks: () => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

const STORAGE_KEY = 'cinevision_upload_tasks';

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [mounted, setMounted] = useState(false);

  // Load tasks from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setTasks(parsed);
      } catch (error) {
        console.error('Error loading upload tasks:', error);
      }
    }
  }, []);

  // Save tasks to localStorage whenever they change
  useEffect(() => {
    if (mounted) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
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

  const cancelTask = useCallback((id: string) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === id ? { ...task, cancelRequested: true } : task
      )
    );
  }, []);

  const clearAllTasks = useCallback(() => {
    setTasks([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

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
    <UploadContext.Provider value={{ tasks, addTask, updateTask, removeTask, cancelTask, clearAllTasks }}>
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
