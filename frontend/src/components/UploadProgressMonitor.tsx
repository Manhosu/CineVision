'use client';

import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UploadProgress {
  contentId: string;
  languageId: string;
  languageType: 'DUBLADO' | 'LEGENDADO';
  fileName: string;
  totalSize: number;
  uploadedSize: number;
  percentage: number;
  currentPart: number;
  totalParts: number;
  speed: number;
  status: 'uploading' | 'completed' | 'error' | 'cancelled';
  error?: string;
}

export function UploadProgressMonitor() {
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io('http://localhost:3001/upload-progress', {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('Connected to upload progress WebSocket');
    });

    newSocket.on('upload-progress', (progress: UploadProgress) => {
      setUploads((prev) => {
        const index = prev.findIndex((u) => u.languageId === progress.languageId);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = progress;
          return updated;
        }
        return [...prev, progress];
      });
    });

    newSocket.on('upload-cleared', ({ languageId }: { languageId: string }) => {
      setUploads((prev) => prev.filter((u) => u.languageId !== languageId));
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number) => {
    return formatBytes(bytesPerSecond) + '/s';
  };

  if (uploads.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 max-h-[80vh] overflow-y-auto bg-gray-900/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-700 z-50">
      <div className="p-4 border-b border-gray-700 bg-gradient-to-r from-red-600 to-red-700">
        <h3 className="text-lg font-bold text-white flex items-center">
          <svg className="w-5 h-5 mr-2 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Uploads em Andamento
        </h3>
      </div>

      <div className="p-4 space-y-4">
        {uploads.map((upload) => (
          <div
            key={upload.languageId}
            className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition-all"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                    upload.languageType === 'DUBLADO'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  }`}>
                    {upload.languageType}
                  </span>
                  {upload.status === 'completed' && (
                    <span className="flex items-center text-green-400 text-xs">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Concluído
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-300 truncate" title={upload.fileName}>
                  {upload.fileName}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{upload.percentage.toFixed(1)}%</span>
                <span>
                  {upload.currentPart} / {upload.totalParts} partes
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    upload.status === 'completed'
                      ? 'bg-green-500'
                      : upload.status === 'error'
                      ? 'bg-red-500'
                      : 'bg-gradient-to-r from-blue-500 to-purple-500'
                  }`}
                  style={{ width: `${upload.percentage}%` }}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="flex justify-between text-xs text-gray-400">
              <span>{formatBytes(upload.uploadedSize)} / {formatBytes(upload.totalSize)}</span>
              {upload.speed > 0 && upload.status === 'uploading' && (
                <span className="text-blue-400 font-medium">
                  {formatSpeed(upload.speed)}
                </span>
              )}
            </div>

            {/* Error Message */}
            {upload.error && (
              <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
                {upload.error}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
