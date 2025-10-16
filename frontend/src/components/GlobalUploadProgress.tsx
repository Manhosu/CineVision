'use client';

import React from 'react';
import { useUpload } from '@/contexts/UploadContext';

export function GlobalUploadProgress() {
  const { tasks } = useUpload();

  // Filter only uploading tasks
  const uploadingTasks = tasks.filter(t => t.status === 'uploading');

  if (uploadingTasks.length === 0) return null;

  // Calculate overall progress
  const overallProgress = uploadingTasks.length > 0
    ? uploadingTasks.reduce((acc, task) => acc + task.progress, 0) / uploadingTasks.length
    : 0;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-2xl p-6 border-2 border-blue-500/50 shadow-2xl backdrop-blur-xl animate-slide-in">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-lg font-bold text-white flex items-center">
          <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></div>
          Upload em Andamento
        </h4>
        <span className="text-sm text-gray-400">
          {overallProgress.toFixed(0)}%
        </span>
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
            <div key={task.id} className="flex items-center space-x-3">
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
              <div className="flex-1">
                <div className="flex justify-between text-xs text-gray-300 mb-1">
                  <span className="font-medium truncate max-w-[200px]">{task.contentTitle || task.fileName}</span>
                  <span>{task.progress.toFixed(0)}%</span>
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
