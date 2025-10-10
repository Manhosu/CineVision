'use client';

import React, { useState, useCallback, useEffect } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import FileUpload from '@/components/ui/FileUpload';
import ProgressBar from '@/components/ui/ProgressBar';
import Badge from '@/components/ui/Badge';

interface VideoFile {
  file: File;
  id: string;
  uploadProgress: number;
  transcodingProgress: number;
  status: 'pending' | 'uploading' | 'processing' | 'ready' | 'failed';
  error?: string;
  contentId?: string;
  qualities?: string[];
  thumbnail?: string;
}

interface ContentMetadata {
  title: string;
  description: string;
  synopsis: string;
  type: 'movie' | 'series' | 'documentary';
  releaseYear: number;
  director: string;
  cast: string[];
  genres: string[];
  priceCents: number;
  availability: 'site' | 'telegram' | 'both';
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
}

export default function VideoUploadPage() {
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [thumbnails, setThumbnails] = useState<File[]>([]);
  const [metadata, setMetadata] = useState<ContentMetadata>({
    title: '',
    description: '',
    synopsis: '',
    type: 'movie',
    releaseYear: new Date().getFullYear(),
    director: '',
    cast: [],
    genres: [],
    priceCents: 1999, // R$ 19.99 default
    availability: 'both',
  });
  const [isUploading, setIsUploading] = useState(false);
  const [castInput, setCastInput] = useState('');
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Buscar categorias disponíveis
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/content/categories`);
        if (response.ok) {
          const categories = await response.json();
          setAvailableCategories(categories);
        }
      } catch (error) {
        console.error('Erro ao buscar categorias:', error);
      }
    };

    fetchCategories();
  }, []);

  const handleVideoFiles = useCallback((files: File[]) => {
    const newVideos = files.map((file) => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      uploadProgress: 0,
      transcodingProgress: 0,
      status: 'pending' as const,
    }));

    setVideos((prev) => [...prev, ...newVideos]);
  }, []);

  const handleThumbnailFiles = useCallback((files: File[]) => {
    setThumbnails((prev) => [...prev, ...files]);
  }, []);

  const removeVideo = (id: string) => {
    setVideos((prev) => prev.filter((video) => video.id !== id));
  };

  const removeThumbnail = (index: number) => {
    setThumbnails((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadVideo = async (video: VideoFile) => {
    try {
      setVideos((prev) =>
        prev.map((v) => (v.id === video.id ? { ...v, status: 'uploading' } : v))
      );

      // Simulate upload progress
      const uploadInterval = setInterval(() => {
        setVideos((prev) =>
          prev.map((v) => {
            if (v.id === video.id && v.uploadProgress < 100) {
              const newProgress = Math.min(v.uploadProgress + Math.random() * 15, 100);
              return { ...v, uploadProgress: newProgress };
            }
            return v;
          })
        );
      }, 500);

      // Simulate upload completion after random time
      setTimeout(() => {
        clearInterval(uploadInterval);
        setVideos((prev) =>
          prev.map((v) => {
            if (v.id === video.id) {
              return {
                ...v,
                uploadProgress: 100,
                status: 'processing',
                contentId: `content_${Math.random().toString(36).substr(2, 9)}`,
              };
            }
            return v;
          })
        );

        // Start transcoding simulation
        const transcodingInterval = setInterval(() => {
          setVideos((prev) =>
            prev.map((v) => {
              if (v.id === video.id && v.transcodingProgress < 100) {
                const newProgress = Math.min(v.transcodingProgress + Math.random() * 8, 100);
                return { ...v, transcodingProgress: newProgress };
              }
              return v;
            })
          );
        }, 800);

        setTimeout(() => {
          clearInterval(transcodingInterval);
          setVideos((prev) =>
            prev.map((v) => {
              if (v.id === video.id) {
                return {
                  ...v,
                  transcodingProgress: 100,
                  status: 'ready',
                  qualities: ['720p', '1080p', '4K'],
                };
              }
              return v;
            })
          );
        }, 8000);
      }, 3000 + Math.random() * 2000);

    } catch (error) {
      setVideos((prev) =>
        prev.map((v) =>
          v.id === video.id
            ? {
                ...v,
                status: 'failed',
                error: error instanceof Error ? error.message : 'Erro desconhecido',
              }
            : v
        )
      );
    }
  };

  const uploadAllVideos = async () => {
    if (!metadata.title.trim()) {
      alert('Por favor, preencha o título do conteúdo');
      return;
    }

    setIsUploading(true);

    try {
      for (const video of videos) {
        if (video.status === 'pending') {
          await uploadVideo(video);
        }
      }
    } finally {
      setIsUploading(false);
    }
  };

  const addCastMember = () => {
    if (castInput.trim() && !metadata.cast.includes(castInput.trim())) {
      setMetadata((prev) => ({
        ...prev,
        cast: [...prev.cast, castInput.trim()],
      }));
      setCastInput('');
    }
  };

  const removeCastMember = (member: string) => {
    setMetadata((prev) => ({
      ...prev,
      cast: prev.cast.filter((c) => c !== member),
    }));
  };

  const toggleCategory = (categoryName: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(categoryName)) {
        return prev.filter((c) => c !== categoryName);
      } else {
        return [...prev, categoryName];
      }
    });

    setMetadata((prev) => ({
      ...prev,
      genres: selectedCategories.includes(categoryName)
        ? prev.genres.filter((g) => g !== categoryName)
        : [...prev.genres, categoryName],
    }));
  };

  const removeCategory = (categoryName: string) => {
    setSelectedCategories((prev) => prev.filter((c) => c !== categoryName));
    setMetadata((prev) => ({
      ...prev,
      genres: prev.genres.filter((g) => g !== categoryName),
    }));
  };

  const getStatusIcon = (status: VideoFile['status']) => {
    switch (status) {
      case 'pending':
        return (
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'uploading':
      case 'processing':
        return (
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        );
      case 'ready':
        return (
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getStatusColor = (status: VideoFile['status']) => {
    switch (status) {
      case 'pending':
        return 'default';
      case 'uploading':
      case 'processing':
        return 'warning';
      case 'ready':
        return 'success';
      case 'failed':
        return 'danger';
      default:
        return 'default';
    }
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

  const getStatusText = (status: VideoFile['status']) => {
    const statusTexts = {
      pending: 'Aguardando',
      uploading: 'Enviando',
      processing: 'Processando',
      ready: 'Pronto',
      failed: 'Falhou',
    };
    return statusTexts[status];
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Upload de Conteúdo</h1>
            <p className="text-gray-400 mt-1">
              Adicione novos filmes e séries à plataforma
            </p>
          </div>

          {videos.some((v) => v.status === 'pending') && (
            <button
              onClick={uploadAllVideos}
              disabled={isUploading || !metadata.title.trim()}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? 'Enviando...' : 'Iniciar Upload'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Content Metadata Form */}
          <div className="card space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">Informações do Conteúdo</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Título *
                </label>
                <input
                  type="text"
                  value={metadata.title}
                  onChange={(e) => setMetadata((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Nome do filme ou série"
                  className="input-field w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tipo *
                </label>
                <select
                  value={metadata.type}
                  onChange={(e) => setMetadata((prev) => ({ ...prev, type: e.target.value as ContentMetadata['type'] }))}
                  className="input-field w-full"
                >
                  <option value="movie">Filme</option>
                  <option value="series">Série</option>
                  <option value="documentary">Documentário</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Disponibilidade *
                </label>
                <select
                  value={metadata.availability}
                  onChange={(e) => setMetadata((prev) => ({ ...prev, availability: e.target.value as ContentMetadata['availability'] }))}
                  className="input-field w-full"
                >
                  <option value="both">Site + Telegram</option>
                  <option value="site">Apenas Site</option>
                  <option value="telegram">Apenas Telegram</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Descrição
                </label>
                <textarea
                  value={metadata.description}
                  onChange={(e) => setMetadata((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Descrição curta para listagens"
                  rows={3}
                  className="input-field w-full resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Sinopse
                </label>
                <textarea
                  value={metadata.synopsis}
                  onChange={(e) => setMetadata((prev) => ({ ...prev, synopsis: e.target.value }))}
                  placeholder="Sinopse completa do conteúdo"
                  rows={4}
                  className="input-field w-full resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Ano de Lançamento
                  </label>
                  <input
                    type="number"
                    value={metadata.releaseYear}
                    onChange={(e) => setMetadata((prev) => ({ ...prev, releaseYear: parseInt(e.target.value) }))}
                    min="1900"
                    max={new Date().getFullYear() + 5}
                    className="input-field w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Preço (R$)
                  </label>
                  <input
                    type="number"
                    value={metadata.priceCents / 100}
                    onChange={(e) => setMetadata((prev) => ({ ...prev, priceCents: parseFloat(e.target.value) * 100 }))}
                    min="0"
                    step="0.01"
                    placeholder="19.99"
                    className="input-field w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Diretor
                </label>
                <input
                  type="text"
                  value={metadata.director}
                  onChange={(e) => setMetadata((prev) => ({ ...prev, director: e.target.value }))}
                  placeholder="Nome do diretor"
                  className="input-field w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Elenco
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={castInput}
                    onChange={(e) => setCastInput(e.target.value)}
                    placeholder="Nome do ator/atriz"
                    className="input-field flex-1"
                    onKeyPress={(e) => e.key === 'Enter' && addCastMember()}
                  />
                  <button
                    type="button"
                    onClick={addCastMember}
                    className="btn-secondary"
                  >
                    Adicionar
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {metadata.cast.map((member) => (
                    <Badge
                      key={member}
                      variant="outline"
                      removable
                      onRemove={() => removeCastMember(member)}
                    >
                      {member}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Categorias *
                </label>
                <div className="relative mb-2">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        toggleCategory(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="input-field w-full"
                    disabled={availableCategories.length === 0}
                  >
                    <option value="">
                      {availableCategories.length === 0
                        ? 'Carregando categorias...'
                        : 'Selecione uma categoria'}
                    </option>
                    {availableCategories
                      .filter((cat) => !selectedCategories.includes(cat.name))
                      .map((category) => (
                        <option key={category.id} value={category.name}>
                          {category.name}
                        </option>
                      ))}
                  </select>
                </div>
                {selectedCategories.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedCategories.map((categoryName) => (
                      <Badge
                        key={categoryName}
                        variant="outline"
                        removable
                        onRemove={() => removeCategory(categoryName)}
                      >
                        {categoryName}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">
                    Nenhuma categoria selecionada
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* File Upload Section */}
          <div className="space-y-6">
            {/* Video Upload */}
            <div className="card">
              <h2 className="text-xl font-semibold text-white mb-4">Upload de Vídeos</h2>
              <FileUpload
                onFilesSelected={handleVideoFiles}
                title="Adicionar Vídeos"
                description="Arraste vídeos ou clique para selecionar"
                disabled={isUploading}
              />

              {videos.length > 0 && (
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-white">
                      Arquivos Selecionados ({videos.length})
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {videos.map((video) => (
                      <div
                        key={video.id}
                        className="bg-dark-700/30 border border-dark-600 rounded-lg p-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-dark-600 rounded-lg">
                            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-white truncate">{video.file.name}</p>
                              <Badge
                                variant={getStatusColor(video.status)}
                                icon={getStatusIcon(video.status)}
                              >
                                {getStatusText(video.status)}
                              </Badge>
                            </div>

                            <p className="text-sm text-gray-400 mb-2">
                              {formatFileSize(video.file.size)}
                              {video.contentId && (
                                <span className="ml-2">• ID: {video.contentId}</span>
                              )}
                            </p>

                            {video.status === 'uploading' && (
                              <ProgressBar
                                value={video.uploadProgress}
                                label="Upload"
                                showPercentage
                                size="sm"
                                color="primary"
                              />
                            )}

                            {video.status === 'processing' && (
                              <ProgressBar
                                value={video.transcodingProgress}
                                label="Transcodificação"
                                showPercentage
                                size="sm"
                                color="warning"
                              />
                            )}

                            {video.qualities && video.qualities.length > 0 && (
                              <div className="flex gap-1 mt-2">
                                {video.qualities.map((quality) => (
                                  <Badge key={quality} variant="success" size="sm">
                                    {quality}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            {video.error && (
                              <p className="text-sm text-red-400 mt-1">{video.error}</p>
                            )}
                          </div>

                          <button
                            onClick={() => removeVideo(video.id)}
                            disabled={video.status === 'uploading' || video.status === 'processing'}
                            className="p-1 text-gray-400 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Thumbnail Upload */}
            <div className="card">
              <h2 className="text-xl font-semibold text-white mb-4">Upload de Thumbnails</h2>
              <FileUpload
                onFilesSelected={handleThumbnailFiles}
                accept={{
                  'image/jpeg': ['.jpg', '.jpeg'],
                  'image/png': ['.png'],
                  'image/webp': ['.webp'],
                }}
                maxSize={10 * 1024 * 1024} // 10MB
                title="Adicionar Thumbnails"
                description="Imagens de capa e poster"
                disabled={isUploading}
              />

              {thumbnails.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {thumbnails.map((thumbnail, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-video bg-dark-700 rounded-lg overflow-hidden">
                        <img
                          src={URL.createObjectURL(thumbnail)}
                          alt={`Thumbnail ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        onClick={() => removeThumbnail(index)}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <p className="text-xs text-gray-400 mt-1 truncate">{thumbnail.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}