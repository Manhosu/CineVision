import React, { useState, useCallback } from 'react';
import { Upload, X, Play, Pause, CheckCircle, AlertCircle } from 'lucide-react';
import { useVideoUpload } from '../../hooks/useVideoUpload';

interface VideoUploadProps {
  onUploadComplete?: (videoKey: string, metadata: any) => void;
  onUploadError?: (error: string) => void;
  onProgress?: (fileName: string, loaded: number, total: number) => void;
  maxFileSize?: number; // in MB
  acceptedFormats?: string[];
  customEndpoints?: {
    initiate?: string;
    complete?: string;
    presignedUrl?: string;
  };
  customPayload?: Record<string, any>;
}

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export const VideoUpload: React.FC<VideoUploadProps> = ({
  onUploadComplete,
  onUploadError,
  onProgress,
  maxFileSize = 500, // 500MB default
  acceptedFormats = ['video/mp4', 'video/x-matroska', 'video/webm', 'video/ogg', 'video/avi', 'video/mov'],
  customEndpoints,
  customPayload
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'paused' | 'completed' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const {
    uploadVideo,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    isUploading,
    isPaused
  } = useVideoUpload();

  const validateFile = (file: File): string | null => {
    if (!acceptedFormats.includes(file.type)) {
      return `Formato não suportado. Formatos aceitos: ${acceptedFormats.join(', ')}`;
    }

    if (file.size > maxFileSize * 1024 * 1024) {
      return `Arquivo muito grande. Tamanho máximo: ${maxFileSize}MB`;
    }

    return null;
  };

  const handleFileSelect = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setErrorMessage(validationError);
      setUploadStatus('error');
      onUploadError?.(validationError);
      return;
    }

    setSelectedFile(file);
    setErrorMessage('');
    setUploadStatus('idle');

    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [maxFileSize, acceptedFormats, onUploadError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const startUpload = async () => {
    if (!selectedFile) return;

    setUploadStatus('uploading');
    setUploadProgress({ loaded: 0, total: selectedFile.size, percentage: 0 });

    try {
      const result = await uploadVideo(selectedFile, {
        onProgress: (progress) => {
          setUploadProgress({
            loaded: progress.loaded,
            total: progress.total,
            percentage: Math.round((progress.loaded / progress.total) * 100)
          });
          // Call external progress callback
          onProgress?.(selectedFile.name, progress.loaded, progress.total);
        },
        customEndpoints,
        customPayload
      });

      setUploadStatus('completed');
      setUploadProgress({ loaded: selectedFile.size, total: selectedFile.size, percentage: 100 });
      onUploadComplete?.(result.videoKey, result.metadata);
    } catch (error) {
      setUploadStatus('error');
      const errorMsg = error instanceof Error ? error.message : 'Erro no upload';
      setErrorMessage(errorMsg);
      onUploadError?.(errorMsg);
    }
  };

  const handlePauseResume = () => {
    if (isPaused) {
      resumeUpload();
      setUploadStatus('uploading');
    } else {
      pauseUpload();
      setUploadStatus('paused');
    }
  };

  const handleCancel = () => {
    cancelUpload();
    setUploadStatus('idle');
    setUploadProgress(null);
    setSelectedFile(null);
    setPreviewUrl('');
    setErrorMessage('');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Upload de Vídeo</h2>

      {!selectedFile ? (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragOver
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-lg text-gray-600 mb-2">
            Arraste e solte seu vídeo aqui ou
          </p>
          <label className="inline-block bg-blue-500 text-white px-6 py-2 rounded-lg cursor-pointer hover:bg-blue-600 transition-colors">
            Selecionar Arquivo
            <input
              type="file"
              className="hidden"
              accept={acceptedFormats.join(',')}
              onChange={handleFileInputChange}
            />
          </label>
          <p className="text-sm text-gray-500 mt-4">
            Formatos suportados: {acceptedFormats.join(', ')}
            <br />
            Tamanho máximo: {maxFileSize}MB
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* File Info */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Play className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-800">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">
                  {formatFileSize(selectedFile.size)} • {selectedFile.type}
                </p>
              </div>
            </div>
            <button
              onClick={handleCancel}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Preview */}
          {previewUrl && (
            <div className="relative">
              <video
                src={previewUrl}
                controls
                className="w-full max-h-64 rounded-lg"
                preload="metadata"
              />
            </div>
          )}

          {/* Upload Progress */}
          {uploadProgress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Progresso do Upload</span>
                <span>{uploadProgress.percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress.percentage}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>{formatFileSize(uploadProgress.loaded)} de {formatFileSize(uploadProgress.total)}</span>
                <span>
                  {uploadStatus === 'uploading' && 'Enviando...'}
                  {uploadStatus === 'paused' && 'Pausado'}
                  {uploadStatus === 'completed' && 'Concluído'}
                </span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {uploadStatus === 'error' && errorMessage && (
            <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <p className="text-red-700">{errorMessage}</p>
            </div>
          )}

          {/* Success Message */}
          {uploadStatus === 'completed' && (
            <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <p className="text-green-700">Upload concluído com sucesso!</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3">
            {uploadStatus === 'idle' && (
              <button
                onClick={startUpload}
                className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
              >
                Iniciar Upload
              </button>
            )}

            {(uploadStatus === 'uploading' || uploadStatus === 'paused') && (
              <>
                <button
                  onClick={handlePauseResume}
                  className="flex items-center space-x-2 bg-yellow-500 text-white py-2 px-4 rounded-lg hover:bg-yellow-600 transition-colors"
                >
                  {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  <span>{isPaused ? 'Retomar' : 'Pausar'}</span>
                </button>
                <button
                  onClick={handleCancel}
                  className="bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors"
                >
                  Cancelar
                </button>
              </>
            )}

            {uploadStatus === 'completed' && (
              <button
                onClick={handleCancel}
                className="bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors"
              >
                Novo Upload
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};