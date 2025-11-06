'use client';

import React, { useEffect } from 'react';
import { useUpload } from '@/contexts/UploadContext';
import { toast } from 'react-hot-toast';

export function FloatingUploadProgress() {
  const { tasks, cancelTask, clearStuckTasks, removeTask } = useUpload();

  // Debug: Log tasks to console
  useEffect(() => {
    console.log('[FloatingUploadProgress] All tasks:', tasks);
    const episodeTasks = tasks.filter(t => t.type === 'episode');
    const movieTasks = tasks.filter(t => t.type === 'movie');
    console.log('[FloatingUploadProgress] Episode tasks:', episodeTasks.length, 'Movie tasks:', movieTasks.length);
  }, [tasks]);

  // Auto-remove FULLY completed tasks after 10 seconds (episodes AND movies)
  // Only remove when processing is complete (status=ready OR processingStatus=ready)
  useEffect(() => {
    const fullyCompletedTasks = tasks.filter(t =>
      (t.status === 'ready' || t.processingStatus === 'ready') && t.completedAt
    );

    if (fullyCompletedTasks.length > 0) {
      const timers = fullyCompletedTasks.map(task => {
        const timeElapsed = Date.now() - (task.completedAt || 0);
        const timeRemaining = Math.max(0, 10000 - timeElapsed);

        return setTimeout(() => {
          console.log('[FloatingUploadProgress] Auto-removing fully completed task:', task.id, 'type:', task.type);
          removeTask(task.id);
        }, timeRemaining);
      });

      return () => timers.forEach(timer => clearTimeout(timer));
    }
  }, [tasks, removeTask]);

  // Filtrar uploads de episódios e filmes
  const episodeTasks = tasks.filter(t => t.type === 'episode');
  const movieTasks = tasks.filter(t => t.type === 'movie');

  // Show all tasks during the entire upload session
  const visibleTasks = [...episodeTasks, ...movieTasks];

  // Não mostrar se não há uploads
  if (visibleTasks.length === 0) {
    console.log('[FloatingUploadProgress] No visible tasks, hiding component');
    return null;
  }

  console.log('[FloatingUploadProgress] Rendering with', visibleTasks.length, 'visible tasks (', episodeTasks.length, 'episodes,', movieTasks.length, 'movies)');

  // Calculate overall progress
  const overallProgress = visibleTasks.length > 0
    ? visibleTasks.reduce((acc, task) => acc + task.progress, 0) / visibleTasks.length
    : 0;

  const handleClearStuckTasks = async () => {
    try {
      await clearStuckTasks();
      toast.success('Uploads travados removidos com sucesso!');
    } catch (error) {
      console.error('Error clearing stuck tasks:', error);
      toast.error('Erro ao limpar uploads travados');
    }
  };

  const handleCancelTask = async (taskId: string, contentTitle: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);

      // For movies with languageId, try to abort the upload in backend
      if (task?.type === 'movie' && task.languageId && task.uploadId) {
        await cancelTask(taskId);
      } else {
        // For episodes or movies without upload started, just remove from list
        removeTask(taskId);
      }

      toast.success(`Upload de "${contentTitle}" cancelado`);
    } catch (error) {
      console.error('Error canceling task:', error);
      toast.error('Erro ao cancelar upload');
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-2xl p-6 border-2 border-purple-500/50 shadow-2xl backdrop-blur-xl animate-slide-in">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-lg font-bold text-white flex items-center">
          <div className="w-2 h-2 bg-purple-500 rounded-full mr-2 animate-pulse"></div>
          Uploads ({visibleTasks.length})
        </h4>
        <button
          onClick={handleClearStuckTasks}
          className="text-xs px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-1"
          title="Cancelar todos os uploads"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Cancelar Todos
        </button>
      </div>

      {/* Overall Progress */}
      <div className="w-full bg-gray-700 rounded-full h-2 mb-4 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-600 transition-all duration-300"
          style={{
            width: `${overallProgress}%`,
            backgroundSize: '200% 100%',
            animation: 'shimmer 2s linear infinite'
          }}
        />
      </div>

      {/* Individual Progress */}
      <div className="space-y-3 max-h-60 overflow-y-auto">
        {visibleTasks.map((task) => {
          return (
            <div key={task.id} className="flex items-center space-x-2">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                {task.status === 'ready' ? (
                  <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : task.status === 'completed' && task.processingStatus === 'ready' ? (
                  <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : task.status === 'completed' && (task.processingStatus === 'processing' || task.processingStatus === 'pending') ? (
                  <svg className="w-5 h-5 text-yellow-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : task.status === 'error' || task.status === 'cancelled' || task.processingStatus === 'failed' ? (
                  <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                ) : task.status === 'converting' ? (
                  <svg className="w-5 h-5 text-yellow-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-xs text-gray-300 mb-1">
                  <span className="font-medium truncate max-w-[160px]" title={task.contentTitle}>
                    {task.type === 'episode'
                      ? `S${task.seasonNumber}E${task.episodeNumber} - ${task.contentTitle}`
                      : task.contentTitle
                    }
                  </span>
                  <span className="ml-2">{task.progress.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-600 transition-all duration-300"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
                {task.status === 'uploading' && (
                  <p className="text-xs text-blue-400 mt-1">Fazendo upload...</p>
                )}
                {task.status === 'completed' && task.processingStatus === 'pending' && (
                  <p className="text-xs text-yellow-400 mt-1">Upload concluído - aguardando processamento...</p>
                )}
                {task.status === 'completed' && task.processingStatus === 'processing' && (
                  <p className="text-xs text-yellow-400 mt-1">Processando vídeo...</p>
                )}
                {task.status === 'completed' && task.processingStatus === 'ready' && (
                  <p className="text-xs text-green-400 mt-1">Pronto para assistir!</p>
                )}
                {task.status === 'ready' && (
                  <p className="text-xs text-green-400 mt-1">Pronto para assistir!</p>
                )}
                {task.status === 'converting' && (
                  <p className="text-xs text-yellow-400 mt-1">Convertendo vídeo...</p>
                )}
                {(task.processingStatus === 'failed' || task.status === 'error') && (
                  <p className="text-xs text-red-400 mt-1">{task.error || 'Erro no processamento'}</p>
                )}
              </div>
              <button
                onClick={() => handleCancelTask(task.id, task.contentTitle)}
                className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title={task.status === 'uploading' ? "Cancelar upload" : "Remover da lista"}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-gray-400 text-center">
        Navegue entre páginas livremente - os uploads continuarão em segundo plano
      </p>
    </div>
  );
}
