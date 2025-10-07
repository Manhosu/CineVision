'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  accept?: Record<string, string[]>;
  maxSize?: number;
  maxFiles?: number;
  disabled?: boolean;
  title?: string;
  description?: string;
}

export default function FileUpload({
  onFilesSelected,
  accept = {
    'video/mp4': ['.mp4'],
    'video/avi': ['.avi'],
    'video/mov': ['.mov'],
    'video/mkv': ['.mkv'],
    'video/webm': ['.webm'],
  },
  maxSize = 10 * 1024 * 1024 * 1024, // 10GB
  maxFiles = 10,
  disabled = false,
  title = 'Upload de Vídeos',
  description = 'Arraste e solte arquivos aqui ou clique para selecionar',
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      onFilesSelected(acceptedFiles);
      setDragActive(false);
    },
    [onFilesSelected]
  );

  const onDragEnter = useCallback(() => {
    setDragActive(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setDragActive(false);
  }, []);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    onDragEnter,
    onDragLeave,
    accept,
    maxSize,
    maxFiles,
    disabled,
  });

  const getAcceptedFormats = () => {
    return Object.values(accept)
      .flat()
      .map((ext) => ext.toUpperCase())
      .join(', ');
  };

  const formatFileSize = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`relative group border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer ${
          isDragActive || dragActive
            ? 'border-primary-500 bg-primary-500/5 scale-105'
            : 'border-dark-600 hover:border-dark-500 hover:bg-dark-800/30'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />

        <div className="space-y-4">
          {/* Upload Icon */}
          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
            isDragActive || dragActive
              ? 'bg-primary-500/20 text-primary-400'
              : 'bg-dark-700 text-gray-400 group-hover:text-gray-300'
          }`}>
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>

          {/* Upload Text */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
            <p className="text-gray-400 mb-2">
              {isDragActive ? 'Solte os arquivos aqui...' : description}
            </p>
            <p className="text-sm text-gray-500">
              Formatos suportados: {getAcceptedFormats()} • Máx: {formatFileSize(maxSize)}
            </p>
          </div>

          {/* Browse Button */}
          {!isDragActive && (
            <button
              type="button"
              className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Selecionar Arquivos
            </button>
          )}
        </div>

        {/* Drag Overlay */}
        {(isDragActive || dragActive) && (
          <div className="absolute inset-0 bg-primary-500/10 rounded-xl border-2 border-primary-500 border-dashed flex items-center justify-center">
            <div className="text-primary-400 font-medium">
              Solte os arquivos para fazer upload
            </div>
          </div>
        )}
      </div>

      {/* File Rejection Errors */}
      {fileRejections.length > 0 && (
        <div className="mt-4 space-y-2">
          {fileRejections.map(({ file, errors }) => (
            <div key={file.name} className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-300 font-medium">{file.name}</p>
              {errors.map((error) => (
                <p key={error.code} className="text-red-400 text-sm">
                  {error.message}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}