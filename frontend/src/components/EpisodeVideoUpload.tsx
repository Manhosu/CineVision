'use client';

import React, { useState, useImperativeHandle, forwardRef } from 'react';
import { useUpload } from '@/contexts/UploadContext';
import { supabase } from '@/lib/supabase';
import { Upload, FileVideo, CheckCircle } from 'lucide-react';

interface Props {
  contentId: string;
  episodeId: string;
  seasonNumber: number;
  episodeNumber: number;
  onUploadComplete?: () => void;
}

export interface EpisodeVideoUploadRef {
  startUpload: () => Promise<void>;
  hasFile: () => boolean;
}

export const EpisodeVideoUpload = forwardRef<EpisodeVideoUploadRef, Props>(
  ({ contentId, episodeId, seasonNumber, episodeNumber, onUploadComplete }, ref) => {
    const { addTask, updateTask } = useUpload();
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    const handleFileSelect = (selectedFile: File) => {
      // Validate MP4 format
      if (!selectedFile.name.toLowerCase().endsWith('.mp4')) {
        alert('Apenas arquivos MP4 são aceitos');
        return;
      }

      setFile(selectedFile);
    };

    const startUpload = async () => {
      if (!file) {
        alert('Selecione um arquivo para upload');
        return;
      }

      setUploading(true);

      // Create unique task ID
      const taskId = `episode-${episodeId}-${Date.now()}`;

      // Add task to upload context
      addTask({
        id: taskId,
        fileName: file.name,
        contentTitle: `T${seasonNumber}E${episodeNumber}`,
        progress: 0,
        status: 'uploading',
        type: 'episode',
        episodeId,
        seasonNumber,
        episodeNumber,
      });

      try {
        // Get auth token
        let token: string | null = null;

        if (typeof window !== 'undefined') {
          const backendToken = localStorage.getItem('access_token');
          if (backendToken) {
            token = backendToken;
          } else {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              token = session.access_token;
              localStorage.setItem('auth_token', token);
            } else {
              token = localStorage.getItem('token') || localStorage.getItem('auth_token');
            }
          }
        }

        if (!token) {
          throw new Error('Não foi possível obter token de autenticação');
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        };

        // Detect content type
        const contentType = file.type || 'video/mp4';

        console.log('[EpisodeVideoUpload] Iniciando upload:', {
          episodeId,
          fileName: file.name,
          size: file.size,
          contentType
        });

        // 1. Initialize multipart upload
        const initResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/uploads/init`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            contentId: episodeId,
            filename: file.name,
            contentType,
            size: file.size,
            audioType: 'original', // Episodes don't have dubbing variants
            isEpisode: true,
          }),
        });

        if (!initResponse.ok) {
          const errorData = await initResponse.json().catch(() => ({ message: 'Erro desconhecido' }));
          throw new Error(errorData.message || 'Erro ao iniciar upload');
        }

        const { uploadId, key, partSize, partsCount, presignedUrls } = await initResponse.json();
        const uploadedParts: { ETag: string; PartNumber: number }[] = [];

        console.log('[EpisodeVideoUpload] Upload iniciado:', { uploadId, partsCount });

        // Update task with uploadId
        updateTask(taskId, { uploadId });

        // 2. Upload chunks
        for (let i = 0; i < presignedUrls.length; i++) {
          const { partNumber, url: presignedUrl } = presignedUrls[i];
          const start = (partNumber - 1) * partSize;
          const end = Math.min(start + partSize, file.size);
          const chunk = file.slice(start, end);

          const partResponse = await fetch(presignedUrl, {
            method: 'PUT',
            body: chunk,
          });

          if (!partResponse.ok) {
            throw new Error(`Erro ao fazer upload da parte ${partNumber}`);
          }

          const etag = partResponse.headers.get('ETag');
          if (!etag) {
            throw new Error(`ETag não retornado para parte ${partNumber}`);
          }

          uploadedParts.push({
            ETag: etag.replace(/"/g, ''),
            PartNumber: partNumber
          });

          // Update progress
          const progress = Math.round(((i + 1) / partsCount) * 100);
          updateTask(taskId, { progress });
        }

        console.log('[EpisodeVideoUpload] Upload de partes concluído');

        // 3. Complete upload
        const completeResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/uploads/complete`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              uploadId,
              key,
              parts: uploadedParts,
              contentId: episodeId,
            }),
          }
        );

        if (!completeResponse.ok) {
          const errorData = await completeResponse.json();
          throw new Error(errorData.message || 'Erro ao finalizar upload');
        }

        console.log('[EpisodeVideoUpload] Upload concluído com sucesso!');

        // Mark as completed
        updateTask(taskId, {
          status: 'ready',
          progress: 100,
          processingStatus: 'ready',
          completedAt: Date.now(),
        });

        // Clear file after successful upload
        setFile(null);
        setUploading(false);

        onUploadComplete?.();
      } catch (error: any) {
        console.error('[EpisodeVideoUpload] Erro no upload:', error);

        updateTask(taskId, {
          status: 'error',
          error: error.message || 'Erro no upload',
        });

        setUploading(false);
        throw error;
      }
    };

    const formatBytes = (bytes: number) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      startUpload,
      hasFile: () => Boolean(file),
    }));

    return (
      <div className="space-y-4">
        <div className="bg-gradient-to-br from-gray-800 via-gray-900 to-black rounded-xl p-6 border border-gray-700">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center mr-3">
              <FileVideo className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-white">Vídeo do Episódio</h4>
              <p className="text-xs text-gray-400">Temporada {seasonNumber}, Episódio {episodeNumber}</p>
            </div>
          </div>

          <input
            type="file"
            accept="video/mp4"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            className="hidden"
            id="episode-video-file"
            disabled={uploading}
          />

          <label
            htmlFor="episode-video-file"
            className={`block w-full text-center px-4 py-3 rounded-lg cursor-pointer transition-all font-medium ${
              uploading
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {file ? (
              <div className="flex items-center justify-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="truncate max-w-md">{file.name}</span>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-2">
                <Upload className="w-5 h-5" />
                <span>Selecionar Arquivo MP4</span>
              </div>
            )}
          </label>

          {file && (
            <div className="mt-3 space-y-1">
              <p className="text-xs text-gray-400 text-center">
                Tamanho: {formatBytes(file.size)}
              </p>
              <p className="text-xs text-green-400 text-center font-medium">
                ✓ Arquivo pronto para upload
              </p>
            </div>
          )}

          {uploading && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-xs text-yellow-400 text-center">
                Upload em andamento... Não feche esta janela!
              </p>
            </div>
          )}
        </div>

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-start space-x-2">
            <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="text-xs text-blue-300">
              <p className="font-medium mb-1">Importante:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Apenas arquivos MP4 são aceitos</li>
                <li>O arquivo ficará salvo mesmo ao fechar este modal</li>
                <li>Clique em "Salvar e Iniciar Upload" para começar</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

EpisodeVideoUpload.displayName = 'EpisodeVideoUpload';
