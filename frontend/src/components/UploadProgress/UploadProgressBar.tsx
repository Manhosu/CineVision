'use client';

import React from 'react';
import { Pause, X, Play } from 'lucide-react';

export interface UploadProgressBarProps {
  progress: number; // 0-100
  fileName: string;
  uploadedBytes: number;
  totalBytes: number;
  uploadSpeed?: number; // bytes per second
  timeRemaining?: number; // seconds
  status?: 'uploading' | 'paused' | 'completed' | 'error';
  errorMessage?: string;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  showControls?: boolean;
}

export function UploadProgressBar({
  progress,
  fileName,
  uploadedBytes,
  totalBytes,
  uploadSpeed,
  timeRemaining,
  status = 'uploading',
  errorMessage,
  onPause,
  onResume,
  onCancel,
  showControls = true,
}: UploadProgressBarProps) {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatSpeed = (bytesPerSecond?: number): string => {
    if (!bytesPerSecond) return '-';
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  const formatTime = (seconds?: number): string => {
    if (!seconds || !isFinite(seconds)) return '-';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'paused':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-500';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'completed':
        return 'Concluído';
      case 'error':
        return 'Erro';
      case 'paused':
        return 'Pausado';
      default:
        return 'Enviando';
    }
  };

  return (
    <div className="w-full space-y-3 p-4 bg-gray-800 rounded-lg border border-gray-700">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{fileName}</p>
          <p className="text-xs text-gray-400 mt-1">
            {formatBytes(uploadedBytes)} / {formatBytes(totalBytes)}
          </p>
        </div>
        <div className="flex items-center space-x-2 ml-4">
          <span className="text-xs font-medium text-gray-300 whitespace-nowrap">
            {getStatusText()}
          </span>
          {showControls && status !== 'completed' && status !== 'error' && (
            <>
              {status === 'paused' ? (
                <button
                  onClick={onResume}
                  className="p-1.5 hover:bg-gray-700 rounded-md transition-colors"
                  title="Retomar"
                >
                  <Play className="w-4 h-4 text-green-400" />
                </button>
              ) : (
                <button
                  onClick={onPause}
                  className="p-1.5 hover:bg-gray-700 rounded-md transition-colors"
                  title="Pausar"
                >
                  <Pause className="w-4 h-4 text-yellow-400" />
                </button>
              )}
              <button
                onClick={onCancel}
                className="p-1.5 hover:bg-gray-700 rounded-md transition-colors"
                title="Cancelar"
              >
                <X className="w-4 h-4 text-red-400" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative">
        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${getStatusColor()} transition-all duration-300 ease-out`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          >
            {status === 'uploading' && (
              <div className="h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
            )}
          </div>
        </div>
        <div className="absolute inset-y-0 right-0 flex items-center pr-2">
          <span className="text-xs font-semibold text-white drop-shadow-lg">
            {Math.round(progress)}%
          </span>
        </div>
      </div>

      {/* Stats */}
      {status !== 'error' && (
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center space-x-4">
            <span>
              Velocidade: <span className="text-white font-medium">{formatSpeed(uploadSpeed)}</span>
            </span>
            <span>
              Restante: <span className="text-white font-medium">{formatTime(timeRemaining)}</span>
            </span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {status === 'error' && errorMessage && (
        <div className="flex items-start space-x-2 p-3 bg-red-900/20 border border-red-500/30 rounded-md">
          <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-red-300">{errorMessage}</p>
        </div>
      )}

      {/* Completion Message */}
      {status === 'completed' && (
        <div className="flex items-center space-x-2 p-3 bg-green-900/20 border border-green-500/30 rounded-md">
          <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <p className="text-xs text-green-300 font-medium">Upload concluído com sucesso!</p>
        </div>
      )}

      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
}
