'use client';

import React, { useState, useRef } from 'react';
// import { useVideoUpload } from '@/hooks/useVideoUpload';
import { toast } from 'react-hot-toast';

interface VideoUploadProps {
  onUploadComplete?: (videoId: string) => void;
}

export default function VideoUpload({ onUploadComplete }: VideoUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [year, setYear] = useState('');
  const [duration, setDuration] = useState('');
  const [poster, setPoster] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);

  // Temporarily disable hook for testing
  const isUploading = false;
  const [uploadProgress] = useState<{ loaded: number; total: number; percentage: number } | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('video/')) {
        toast.error('Por favor, selecione um arquivo de vídeo válido');
        return;
      }
      
      // Validate file size (max 5GB)
      const maxSize = 5 * 1024 * 1024 * 1024; // 5GB
      if (file.size > maxSize) {
        toast.error('O arquivo deve ter no máximo 5GB');
        return;
      }

      setSelectedFile(file);
      toast.success('Arquivo selecionado com sucesso');
    }
  };

  const handlePosterSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Por favor, selecione uma imagem válida');
        return;
      }
      
      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast.error('A imagem deve ter no máximo 10MB');
        return;
      }

      setPoster(file);
      toast.success('Poster selecionado com sucesso');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedFile) {
      toast.error('Por favor, selecione um arquivo de vídeo');
      return;
    }

    if (!title.trim()) {
      toast.error('Por favor, insira o título do filme');
      return;
    }

    // Temporarily disabled for testing
    toast('Upload temporariamente desabilitado para teste');
    return;

    /*
    try {
      const videoData = {
        title: title.trim(),
        description: description.trim(),
        genre: genre.trim(),
        year: year ? parseInt(year) : undefined,
        duration: duration ? parseInt(duration) : undefined,
      };

      const result = await uploadVideo(selectedFile, videoData, poster);
      
      if (result.success) {
        toast.success('Vídeo enviado com sucesso!');
        
        // Reset form
        setSelectedFile(null);
        setTitle('');
        setDescription('');
        setGenre('');
        setYear('');
        setDuration('');
        setPoster(null);
        
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (posterInputRef.current) posterInputRef.current.value = '';
        
        onUploadComplete?.(result.videoId);
      } else {
        toast.error(result.error || 'Erro ao enviar vídeo');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erro inesperado ao enviar vídeo');
    }
    */
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-dark-800 rounded-lg border border-dark-700 p-8">
        <h1 className="text-3xl font-bold text-white mb-8">Upload de Vídeo</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Video File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Arquivo de Vídeo *
            </label>
            <div className="border-2 border-dashed border-dark-600 rounded-lg p-6 text-center hover:border-primary-500 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
                id="video-upload"
              />
              <label
                htmlFor="video-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-lg font-medium text-gray-300">
                  {selectedFile ? selectedFile.name : 'Clique para selecionar um vídeo'}
                </span>
                {selectedFile && (
                  <span className="text-sm text-gray-400 mt-2">
                    {formatFileSize(selectedFile.size)}
                  </span>
                )}
                <span className="text-sm text-gray-500 mt-2">
                  Formatos suportados: MP4, AVI, MOV, MKV (máx. 5GB)
                </span>
              </label>
            </div>
          </div>

          {/* Movie Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Título *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Digite o título do filme"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Gênero
              </label>
              <input
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Ex: Ação, Drama, Comédia"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Ano
              </label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="2024"
                min="1900"
                max="2030"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Duração (minutos)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="120"
                min="1"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Descrição
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Digite uma descrição do filme..."
            />
          </div>

          {/* Poster Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Poster (Opcional)
            </label>
            <div className="border-2 border-dashed border-dark-600 rounded-lg p-4 text-center hover:border-primary-500 transition-colors">
              <input
                ref={posterInputRef}
                type="file"
                accept="image/*"
                onChange={handlePosterSelect}
                className="hidden"
                id="poster-upload"
              />
              <label
                htmlFor="poster-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium text-gray-300">
                  {poster ? poster.name : 'Clique para selecionar um poster'}
                </span>
                {poster && (
                  <span className="text-xs text-gray-400 mt-1">
                    {formatFileSize(poster.size)}
                  </span>
                )}
                <span className="text-xs text-gray-500 mt-1">
                  JPG, PNG (máx. 10MB)
                </span>
              </label>
            </div>
          </div>

          {/* Upload Progress */}
          {isUploading && uploadProgress && (
            <div className="bg-dark-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-300">Enviando...</span>
                <span className="text-sm text-gray-400">{Math.round(uploadProgress?.percentage || 0)}%</span>
              </div>
              <div className="w-full bg-dark-600 rounded-full h-2">
                <div
                  className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress?.percentage || 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isUploading || !selectedFile}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isUploading ? 'Enviando...' : 'Enviar Vídeo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}