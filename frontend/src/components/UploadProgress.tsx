'use client';

import { useState } from 'react';
import { Upload, CheckCircle, XCircle, Minimize2, Maximize2, X } from 'lucide-react';
import { useUpload } from '@/contexts/UploadContext';

export default function UploadProgress() {
  const { tasks, removeTask, cancelTask, clearAllTasks } = useUpload();
  const [minimized, setMinimized] = useState(false);

  if (tasks.length === 0) return null;

  const activeTasks = tasks.filter(t => t.status === 'uploading');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const errorTasks = tasks.filter(t => t.status === 'error');
  const cancelledTasks = tasks.filter(t => t.status === 'cancelled');

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
            {(activeTasks.length === 0 || hasStuckUploads) && (
              <button
                onClick={clearAllTasks}
                className="p-1 hover:bg-red-500/20 rounded transition-colors"
                title={hasStuckUploads ? "Limpar uploads travados" : "Limpar tudo"}
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
                      {task.status === 'completed' && (
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

                    {/* Progress Bar */}
                    {task.status === 'uploading' && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>Enviando...</span>
                          <span>{task.progress}%</span>
                        </div>
                        <div className="w-full bg-dark-600 rounded-full h-1.5">
                          <div
                            className="bg-primary-500 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Completed Message */}
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

                  {/* Remove Button (for completed/error/cancelled) */}
                  {(task.status === 'completed' || task.status === 'error' || task.status === 'cancelled') && (
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
