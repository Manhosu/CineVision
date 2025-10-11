'use client';

import React, { useState, useRef } from 'react';
import { io } from 'socket.io-client';

interface VideoFile {
  file: File | null;
  languageType: 'DUBLADO' | 'LEGENDADO';
  progress: number;
  status: 'idle' | 'uploading' | 'completed' | 'error';
  error?: string;
  uploadedSize: number;
  totalSize: number;
  speed: number;
}

interface Props {
  contentId: string;
  onUploadComplete?: () => void;
}

export function SimultaneousVideoUpload({ contentId, onUploadComplete }: Props) {
  const [videos, setVideos] = useState<{
    DUBLADO: VideoFile;
    LEGENDADO: VideoFile;
  }>({
    DUBLADO: {
      file: null,
      languageType: 'DUBLADO',
      progress: 0,
      status: 'idle',
      uploadedSize: 0,
      totalSize: 0,
      speed: 0,
    },
    LEGENDADO: {
      file: null,
      languageType: 'LEGENDADO',
      progress: 0,
      status: 'idle',
      uploadedSize: 0,
      totalSize: 0,
      speed: 0,
    },
  });

  const socketRef = useRef<any>(null);

  const handleFileSelect = (type: 'DUBLADO' | 'LEGENDADO', file: File) => {
    setVideos((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        file,
        totalSize: file.size,
        status: 'idle',
        progress: 0,
        error: undefined,
      },
    }));
  };

  const startSimultaneousUpload = async () => {
    if (!videos.DUBLADO.file && !videos.LEGENDADO.file) {
      alert('Selecione pelo menos um arquivo para upload');
      return;
    }

    // Connect to WebSocket
    if (!socketRef.current) {
      socketRef.current = io('http://localhost:3001/upload-progress');

      socketRef.current.on('upload-progress', (progress: any) => {
        setVideos((prev) => ({
          ...prev,
          [progress.languageType]: {
            ...prev[progress.languageType as 'DUBLADO' | 'LEGENDADO'],
            progress: progress.percentage,
            status: progress.status,
            uploadedSize: progress.uploadedSize,
            speed: progress.speed,
            error: progress.error,
          },
        }));
      });
    }

    // Upload both files simultaneously
    const uploads = [];

    if (videos.DUBLADO.file) {
      uploads.push(uploadFile(videos.DUBLADO.file, 'DUBLADO'));
    }

    if (videos.LEGENDADO.file) {
      uploads.push(uploadFile(videos.LEGENDADO.file, 'LEGENDADO'));
    }

    try {
      await Promise.all(uploads);
      onUploadComplete?.();
    } catch (error) {
      console.error('Upload error:', error);
    }
  };

  const uploadFile = async (file: File, type: 'DUBLADO' | 'LEGENDADO') => {
    // Implementation will call the backend multipart upload API
    console.log(`Uploading ${type}:`, file.name);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-gray-800 via-gray-900 to-black rounded-2xl p-6 border border-gray-700 shadow-2xl">
        <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
          <svg className="w-7 h-7 mr-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Upload de Vídeos
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* DUBLADO */}
          <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/10 rounded-xl p-5 border-2 border-blue-500/30 hover:border-blue-500/50 transition-all">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              </div>
              <div>
                <h4 className="text-lg font-bold text-blue-300">Versão Dublada</h4>
                <p className="text-xs text-gray-400">Áudio em Português (BR)</p>
              </div>
            </div>

            <input
              type="file"
              accept="video/mp4,video/x-matroska"
              onChange={(e) => e.target.files?.[0] && handleFileSelect('DUBLADO', e.target.files[0])}
              className="hidden"
              id="dublado-file"
            />
            <label
              htmlFor="dublado-file"
              className="block w-full text-center px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-all font-medium"
            >
              {videos.DUBLADO.file ? videos.DUBLADO.file.name : 'Selecionar Arquivo'}
            </label>

            {videos.DUBLADO.file && (
              <div className="mt-4">
                <div className="flex justify-between text-sm text-gray-300 mb-2">
                  <span>{videos.DUBLADO.progress.toFixed(1)}%</span>
                  <span>{formatBytes(videos.DUBLADO.totalSize)}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
                    style={{ width: `${videos.DUBLADO.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* LEGENDADO */}
          <div className="bg-gradient-to-br from-purple-900/20 to-purple-800/10 rounded-xl p-5 border-2 border-purple-500/30 hover:border-purple-500/50 transition-all">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
              <div>
                <h4 className="text-lg font-bold text-purple-300">Versão Legendada</h4>
                <p className="text-xs text-gray-400">Áudio Original + Legendas (PT-BR)</p>
              </div>
            </div>

            <input
              type="file"
              accept="video/mp4,video/x-matroska"
              onChange={(e) => e.target.files?.[0] && handleFileSelect('LEGENDADO', e.target.files[0])}
              className="hidden"
              id="legendado-file"
            />
            <label
              htmlFor="legendado-file"
              className="block w-full text-center px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg cursor-pointer transition-all font-medium"
            >
              {videos.LEGENDADO.file ? videos.LEGENDADO.file.name : 'Selecionar Arquivo'}
            </label>

            {videos.LEGENDADO.file && (
              <div className="mt-4">
                <div className="flex justify-between text-sm text-gray-300 mb-2">
                  <span>{videos.LEGENDADO.progress.toFixed(1)}%</span>
                  <span>{formatBytes(videos.LEGENDADO.totalSize)}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-300"
                    style={{ width: `${videos.LEGENDADO.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Upload Button */}
        <button
          onClick={startSimultaneousUpload}
          disabled={!videos.DUBLADO.file && !videos.LEGENDADO.file}
          className="mt-6 w-full py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-700 disabled:to-gray-800 text-white font-bold rounded-xl transition-all duration-200 disabled:cursor-not-allowed shadow-lg hover:shadow-xl flex items-center justify-center text-lg"
        >
          <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Iniciar Upload Simultâneo
        </button>
      </div>
    </div>
  );
}
