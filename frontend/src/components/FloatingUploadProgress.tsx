'use client';

import React, { useEffect } from 'react';
import { useUpload } from '@/contexts/UploadContext';

export function FloatingUploadProgress() {
  const { tasks } = useUpload();

  // Debug: Log tasks to console
  useEffect(() => {
    console.log('[FloatingUploadProgress] All tasks:', tasks);
    const episodeTasks = tasks.filter(t => t.type === 'episode');
    console.log('[FloatingUploadProgress] Episode tasks:', episodeTasks);
  }, [tasks]);

  // Filtrar apenas uploads de episódios
  const episodeTasks = tasks.filter(t => t.type === 'episode');

  // Não mostrar se não há uploads de episódios
  if (episodeTasks.length === 0) {
    console.log('[FloatingUploadProgress] No episode tasks, hiding component');
    return null;
  }

  console.log('[FloatingUploadProgress] Rendering with', episodeTasks.length, 'episode tasks');

  // Calcular estatísticas
  const uploading = episodeTasks.filter(t => t.status === 'uploading');
  const completed = episodeTasks.filter(t => t.status === 'completed' || t.status === 'ready');
  const failed = episodeTasks.filter(t => t.status === 'error' || t.status === 'cancelled');
  const total = episodeTasks.length;

  // Calcular progresso total
  const totalProgress = total > 0 ? ((completed.length / total) * 100) : 0;

  return (
    <div className="fixed bottom-6 right-6 w-96 bg-gray-900/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-700 z-50 animate-in slide-in-from-bottom-5 duration-300">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 bg-gradient-to-r from-purple-600 to-purple-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center">
            <svg className="w-5 h-5 mr-2 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload de Episódios
          </h3>
          <div className="text-sm text-purple-200">
            {uploading.length > 0 ? (
              <span className="animate-pulse">⚡ Em andamento</span>
            ) : failed.length > 0 ? (
              <span>❌ Com erros</span>
            ) : (
              <span>✓ Concluído</span>
            )}
          </div>
        </div>
      </div>

      {/* Overall Progress */}
      <div className="p-4 border-b border-gray-700/50">
        <div className="flex justify-between text-sm text-gray-300 mb-2">
          <span className="font-semibold">Progresso Geral</span>
          <span className="font-bold text-white">{totalProgress.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-500 ease-out relative overflow-hidden"
            style={{ width: `${totalProgress}%` }}
          >
            {/* Animated shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          </div>
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-2">
          <span>{completed.length} de {total} concluídos</span>
          {failed.length > 0 && (
            <span className="text-red-400 font-semibold">❌ {failed.length} falharam</span>
          )}
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="p-4 border-b border-gray-700/50">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-400">{uploading.length}</div>
            <div className="text-xs text-gray-400 mt-1">Em Progresso</div>
          </div>
          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-yellow-400">{Math.max(0, total - completed.length - uploading.length - failed.length)}</div>
            <div className="text-xs text-gray-400 mt-1">Na Fila</div>
          </div>
          <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-400">{completed.length}</div>
            <div className="text-xs text-gray-400 mt-1">Completos</div>
          </div>
        </div>
      </div>

      {/* Currently Uploading Episodes */}
      {uploading.length > 0 && (
        <div className="p-4 max-h-60 overflow-y-auto">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Enviando Agora ({uploading.length})
          </h4>
          <div className="space-y-3">
            {uploading.map((task) => (
              <div
                key={task.id}
                className="bg-gray-800/50 rounded-lg p-3 border border-gray-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">
                    S{task.seasonNumber}E{task.episodeNumber}
                  </span>
                  <span className="text-xs text-blue-400 font-semibold">
                    {task.progress.toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs text-gray-400 mb-2 truncate" title={task.contentTitle}>
                  {task.contentTitle}
                </p>
                <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success message when all done */}
      {total > 0 && completed.length === total && failed.length === 0 && (
        <div className="p-4 bg-green-900/20 border-t border-green-500/30">
          <div className="flex items-center space-x-2 text-green-400">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-semibold">Todos os episódios foram enviados!</span>
          </div>
        </div>
      )}
    </div>
  );
}
