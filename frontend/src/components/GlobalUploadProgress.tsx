'use client';

import React from 'react';
import { useUpload } from '@/contexts/UploadContext';
import { toast } from 'react-hot-toast';

export function GlobalUploadProgress() {
  const { tasks, cancelTask, clearStuckTasks } = useUpload();

  // Show all active tasks (not completed or ready yet)
  // Keep completed/ready tasks visible for 3 seconds after completion
  const visibleTasks = tasks.filter(t => {
    // Always show if uploading, converting, or error
    if (t.status === 'uploading' || t.status === 'converting' || t.status === 'error') {
      return true;
    }

    // Show completed/ready tasks for 3 seconds after completion
    if ((t.status === 'completed' || t.status === 'ready') && t.completedAt) {
      return Date.now() - t.completedAt < 3000;
    }

    // Show any task that doesn't have completedAt set yet (still in progress)
    if (!t.completedAt) {
      return true;
    }

    return false;
  });

  // Don't show if no tasks at all
  if (visibleTasks.length === 0) return null;

  // Show all active tasks (including completed/error states)
  const uploadingTasks = visibleTasks;

  // Calculate overall progress
  const overallProgress = uploadingTasks.length > 0
    ? uploadingTasks.reduce((acc, task) => acc + task.progress, 0) / uploadingTasks.length
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

  const handleCancelTask = async (taskId: string, fileName: string) => {
    try {
      await cancelTask(taskId);
      toast.success(`Upload de "${fileName}" cancelado`);
    } catch (error) {
      console.error('Error canceling task:', error);
      toast.error('Erro ao cancelar upload');
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-2xl p-6 border-2 border-blue-500/50 shadow-2xl backdrop-blur-xl animate-slide-in">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-lg font-bold text-white flex items-center">
          <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></div>
          Uploads ({uploadingTasks.length} em andamento)
        </h4>
        <button
          onClick={handleClearStuckTasks}
          className="text-xs px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-1"
          title="Limpar todos os uploads travados"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Limpar Todos
        </button>
      </div>

      {/* Overall Progress */}
      <div className="w-full bg-gray-700 rounded-full h-2 mb-4 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-600 transition-all duration-300"
          style={{
            width: `${overallProgress}%`,
            backgroundSize: '200% 100%',
            animation: 'shimmer 2s linear infinite'
          }}
        />
      </div>

      {/* Individual Progress */}
      <div className="space-y-3 max-h-60 overflow-y-auto">
        {uploadingTasks.map((task) => {
          const isDublado = task.fileName.includes('DUBLADO') || task.fileName.toLowerCase().includes('dub');
          const color = isDublado ? 'blue' : 'purple';

          return (
            <div key={task.id} className="flex items-center space-x-2">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-${color}-500/20 flex items-center justify-center`}>
                {task.status === 'completed' ? (
                  <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : task.status === 'error' ? (
                  <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <div className={`w-4 h-4 border-2 border-${color}-400 border-t-transparent rounded-full animate-spin`}></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-xs text-gray-300 mb-1">
                  <span className="font-medium truncate max-w-[160px]" title={task.fileName}>
                    {task.fileName}
                  </span>
                  <span className="ml-2">{task.progress.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r from-${color}-500 to-${color}-600 transition-all duration-300`}
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
                {task.error && (
                  <p className="text-xs text-red-400 mt-1">{task.error}</p>
                )}
              </div>
              <button
                onClick={() => handleCancelTask(task.id, task.fileName)}
                className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Cancelar upload"
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
        Não feche esta janela até o upload concluir
      </p>
    </div>
  );
}
