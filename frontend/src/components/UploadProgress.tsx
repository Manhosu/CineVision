'use client';

import { useState } from 'react';
import { Upload, CheckCircle, XCircle, Minimize2, Maximize2, X } from 'lucide-react';
import { useUpload } from '@/contexts/UploadContext';

export default function UploadProgress() {
  const { tasks, removeTask, cancelTask, clearAllTasks, clearStuckTasks } = useUpload();
  const [minimized, setMinimized] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // ONLY show movie uploads (NOT episodes - those have FloatingUploadProgress)
  const movieTasks = tasks.filter(t => t.type !== 'episode');

  if (movieTasks.length === 0) return null;

  const activeTasks = movieTasks.filter(t => t.status === 'uploading' || t.status === 'converting');
  const completedTasks = movieTasks.filter(t => t.status === 'ready');
  const errorTasks = movieTasks.filter(t => t.status === 'error');
  const cancelledTasks = movieTasks.filter(t => t.status === 'cancelled');

  // Check for stuck uploads (0% progress)
  const hasStuckUploads = activeTasks.some(t => t.progress === 0);

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)]">
      <div className="bg-dark-800 rounded-lg shadow-2xl border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-dark-700 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary-500" />
            <span className="font-medium text-white">
              Uploads ({activeTasks.length} em andamento)
            </span>
          </div>
          <div className="flex items-center gap-2">
            {hasStuckUploads && (
              <button
                onClick={async () => {
                  setIsClearing(true);
                  await clearStuckTasks();
                  setIsClearing(false);
                }}
                disabled={isClearing}
                className="px-2 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                title="Cancelar uploads travados"
              >
                {isClearing ? (
                  <>
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Cancelando...
                  </>
                ) : (
                  'Cancelar Travados'
                )}
              </button>
            )}
            {activeTasks.length === 0 && (
              <button
                onClick={clearAllTasks}
                className="p-1 hover:bg-red-500/20 rounded transition-colors"
                title="Limpar tudo"
              >
                <X className="w-4 h-4 text-red-400" />
              </button>
            )}
            <button
              onClick={() => setMinimized(!minimized)}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              title={minimized ? "Expandir" : "Minimizar"}
            >
              {minimized ? (
                <Maximize2 className="w-4 h-4 text-gray-400" />
              ) : (
                <Minimize2 className="w-4 h-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        {/* Task List */}
        {!minimized && (
          <div className="max-h-96 overflow-y-auto">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="px-4 py-3 border-b border-white/5 last:border-b-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {task.status === 'uploading' && (
                        <Upload className="w-4 h-4 text-blue-500 animate-pulse flex-shrink-0" />
                      )}
                      {task.status === 'converting' && (
                        <svg className="w-4 h-4 text-yellow-500 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      {(task.status === 'completed' || task.status === 'ready') && (
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      )}
                      {task.status === 'error' && (
                        <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium text-white truncate">
                        {task.contentTitle}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate mb-2">
                      {task.fileName}
                    </p>

                    {/* Upload Progress Bar */}
                    {task.status === 'uploading' && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>Enviando...</span>
                          <span>{Math.min(100, Math.round(task.progress * 10) / 10).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-dark-600 rounded-full h-1.5">
                          <div
                            className="bg-primary-500 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, task.progress)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Conversion Progress Bar */}
                    {task.status === 'converting' && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Convertendo vídeo...
                          </span>
                          <span>{Math.round(task.conversionProgress || 0)}%</span>
                        </div>
                        <div className="w-full bg-dark-600 rounded-full h-1.5">
                          <div
                            className="bg-yellow-500 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, task.conversionProgress || 0)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Ready Message - 100% concluído */}
                    {task.status === 'ready' && (
                      <p className="text-xs text-green-500 font-semibold flex items-center gap-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        ✨ 100% Pronto! Filme disponível no sistema
                      </p>
                    )}

                    {/* Completed Message (deprecated - for backward compatibility) */}
                    {task.status === 'completed' && (
                      <p className="text-xs text-green-500">
                        Upload concluído com sucesso
                      </p>
                    )}

                    {/* Error Message */}
                    {task.status === 'error' && (
                      <p className="text-xs text-red-500">
                        Erro: {task.error || 'Falha no upload'}
                      </p>
                    )}

                    {/* Cancelled Message */}
                    {task.status === 'cancelled' && (
                      <p className="text-xs text-yellow-500">
                        Upload cancelado
                      </p>
                    )}
                  </div>

                  {/* Cancel Button (for uploading) */}
                  {task.status === 'uploading' && (
                    <button
                      onClick={() => cancelTask(task.id)}
                      className="p-1 hover:bg-red-500/20 rounded transition-colors flex-shrink-0"
                      title="Cancelar upload"
                    >
                      <X className="w-4 h-4 text-red-400" />
                    </button>
                  )}

                  {/* Remove Button (for completed/error/cancelled/ready) */}
                  {(task.status === 'completed' || task.status === 'ready' || task.status === 'error' || task.status === 'cancelled') && (
                    <button
                      onClick={() => removeTask(task.id)}
                      className="p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0"
                      title="Remover da lista"
                    >
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary when minimized */}
        {minimized && (
          <div className="px-4 py-2 text-sm text-gray-400">
            {activeTasks.length > 0 && (
              <span>{activeTasks.length} upload(s) em andamento</span>
            )}
            {completedTasks.length > 0 && (
              <span className="ml-2 text-green-500">
                {completedTasks.length} concluído(s)
              </span>
            )}
            {errorTasks.length > 0 && (
              <span className="ml-2 text-red-500">
                {errorTasks.length} com erro
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
