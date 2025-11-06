'use client';

import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { useUpload } from '@/contexts/UploadContext';
import { Upload, FileVideo, CheckCircle } from 'lucide-react';

interface Props {
  contentId: string;
  episodeId: string;
  seasonNumber: number;
  episodeNumber: number;
  onUploadComplete?: () => void;
}

export interface EpisodeVideoUploadRef {
  saveFile: () => boolean;
  hasFile: () => boolean;
  getFile: () => File | null;
}

export const EpisodeVideoUpload = forwardRef<EpisodeVideoUploadRef, Props>(
  ({ contentId, episodeId, seasonNumber, episodeNumber, onUploadComplete }, ref) => {
    const { addPendingUpload, getPendingUploadByEpisode } = useUpload();
    const [file, setFile] = useState<File | null>(null);

    // Load pending file if exists
    useEffect(() => {
      const pendingUpload = getPendingUploadByEpisode(episodeId);
      if (pendingUpload) {
        setFile(pendingUpload.file);
      }
    }, [episodeId, getPendingUploadByEpisode]);

    const handleFileSelect = (selectedFile: File) => {
      // Validate MP4 format
      if (!selectedFile.name.toLowerCase().endsWith('.mp4')) {
        alert('Apenas arquivos MP4 são aceitos');
        return;
      }

      setFile(selectedFile);
    };

    const saveFile = () => {
      if (!file) {
        return false;
      }

      // Add to pending uploads
      addPendingUpload({
        id: `pending-${episodeId}`,
        file,
        episodeId,
        episodeTitle: `T${seasonNumber}E${episodeNumber}`,
        seasonNumber,
        episodeNumber,
        contentId,
        type: 'episode',
      });

      console.log('[EpisodeVideoUpload] Arquivo salvo como pendente:', {
        episodeId,
        fileName: file.name,
        size: file.size
      });

      return true;
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
      saveFile,
      hasFile: () => Boolean(file),
      getFile: () => file,
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
          />

          <label
            htmlFor="episode-video-file"
            className="block w-full text-center px-4 py-3 rounded-lg cursor-pointer transition-all font-medium bg-blue-600 hover:bg-blue-700 text-white"
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
                ✓ Arquivo salvo
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
              <p className="font-medium mb-1">Novo Fluxo de Upload:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Selecione o arquivo MP4</li>
                <li>Clique em "Salvar" para guardar o arquivo</li>
                <li>O arquivo fica salvo mesmo ao fechar este modal</li>
                <li>Após adicionar todos os episódios, clique em "Salvar Alterações"</li>
                <li>Os uploads começarão automaticamente</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

EpisodeVideoUpload.displayName = 'EpisodeVideoUpload';
