'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MultipartUploadService, UploadProgress } from '@/services/multipartUpload.service';

interface ContentLanguage {
  id: string;
  content_id: string;
  language_type: 'dubbed' | 'subtitled';
  language_code: string;
  language_name: string;
  video_url?: string;
  video_storage_key?: string;
  file_size_bytes?: number;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface ContentLanguageManagerProps {
  contentId: string;
  onLanguagesChange?: (languages: ContentLanguage[]) => void;
}

const LANGUAGE_TYPE_LABELS = {
  dubbed: 'Dublado',
  subtitled: 'Legendado',
};

export function ContentLanguageManager({ contentId, onLanguagesChange }: ContentLanguageManagerProps) {
  const [languages, setLanguages] = useState<ContentLanguage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Estado de upload
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Formulário de novo idioma
  const [newLanguage, setNewLanguage] = useState<{
    language_type: 'dubbed' | 'subtitled';
    videoFile?: File;
  }>({
    language_type: 'dubbed',
  });

  const uploadServiceRef = useRef<MultipartUploadService | null>(null);

  useEffect(() => {
    if (contentId) {
      loadLanguages();
    }
  }, [contentId]);

  const loadLanguages = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('admin_token') || localStorage.getItem('auth_token') || localStorage.getItem('sb-szghyvnbmjlquznxhqum-auth-token');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_URL}/api/v1/content-language-upload/languages/${contentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setLanguages(data);
        if (onLanguagesChange) {
          onLanguagesChange(data);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar idiomas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo de arquivo
      const validTypes = ['video/x-matroska', 'video/mp4', 'video/quicktime'];
      const validExtensions = ['.mkv', '.mp4', '.mov'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

      if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
        alert('Por favor, selecione um arquivo de vídeo válido (.mkv ou .mp4)');
        return;
      }

      // Validar tamanho (máx 5GB)
      const maxSize = 5 * 1024 * 1024 * 1024; // 5GB
      if (file.size > maxSize) {
        alert('O arquivo deve ter no máximo 5GB.');
        return;
      }

      setNewLanguage(prev => ({ ...prev, videoFile: file }));
    }
  };

  const handleAddLanguage = async () => {
    if (!newLanguage.videoFile) {
      alert('Por favor, selecione um arquivo de vídeo');
      return;
    }

    // Verificar se já existe um arquivo do mesmo tipo
    const existingType = languages.find(lang => lang.language_type === newLanguage.language_type);
    if (existingType) {
      const tipoTexto = newLanguage.language_type === 'dubbed' ? 'dublado' : 'legendado';
      alert(`Já existe um arquivo ${tipoTexto} para este conteúdo. Você só pode ter um arquivo de cada tipo.`);
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(null);

    try {
      // Criar serviço de upload
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const uploadService = new MultipartUploadService(API_URL);
      uploadServiceRef.current = uploadService;

      // Iniciar upload com callbacks de progresso
      await uploadService.uploadFile({
        file: newLanguage.videoFile,
        contentId: contentId,
        languageType: newLanguage.language_type,
        onProgress: (progress) => {
          setUploadProgress(progress);
        },
        onError: (error) => {
          setUploadError(error.message);
        },
      });

      // Upload concluído com sucesso
      setIsUploading(false);
      setUploadProgress(null);
      setShowAddForm(false);
      setNewLanguage({
        language_type: 'dubbed',
        videoFile: undefined,
      });

      // Recarregar lista de idiomas
      await loadLanguages();

      alert('Upload concluído com sucesso!');

    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      setUploadError(error.message || 'Erro ao fazer upload do vídeo');
      setIsUploading(false);
    }
  };

  const handleCancelUpload = () => {
    if (uploadServiceRef.current) {
      uploadServiceRef.current.abort();
      setIsUploading(false);
      setUploadProgress(null);
      setUploadError(null);
    }
  };

  const handleDeleteLanguage = async (languageId: string) => {
    if (!confirm('Tem certeza que deseja deletar este idioma?')) {
      return;
    }

    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('auth_token') || localStorage.getItem('sb-szghyvnbmjlquznxhqum-auth-token');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_URL}/api/v1/content-language-upload/language/${languageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        await loadLanguages();
      } else {
        alert('Erro ao deletar idioma');
      }
    } catch (error) {
      console.error('Erro ao deletar idioma:', error);
      alert('Erro ao deletar idioma');
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white">Idiomas do Conteúdo</h3>

      {/* Botão Adicionar Idioma */}
      {!showAddForm && !isUploading && (
        <button
          onClick={() => setShowAddForm(true)}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Adicionar Idioma
        </button>
      )}

      {/* Formulário de Adicionar Idioma */}
      {showAddForm && !isUploading && (
        <div className="p-6 bg-gray-800 rounded-lg border border-gray-700">
          <h3 className="text-lg font-bold text-white mb-4">Adicionar Novo Idioma</h3>

          <div className="space-y-4">
            {/* Tipo de Áudio */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tipo de Áudio
              </label>
              <select
                value={newLanguage.language_type}
                onChange={(e) => setNewLanguage(prev => ({
                  ...prev,
                  language_type: e.target.value as 'dubbed' | 'subtitled'
                }))}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
              >
                <option value="dubbed">Dublado</option>
                <option value="subtitled">Legendado</option>
              </select>
            </div>

            {/* Arquivo de Vídeo */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Arquivo de Vídeo (.mkv ou .mp4)
              </label>
              <input
                type="file"
                accept=".mkv,.mp4,video/x-matroska,video/mp4"
                onChange={handleFileChange}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700"
              />
              {newLanguage.videoFile && (
                <p className="text-sm text-gray-400 mt-2">
                  Arquivo selecionado: {newLanguage.videoFile.name} ({MultipartUploadService.formatBytes(newLanguage.videoFile.size)})
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Arquivo com áudio {newLanguage.language_type === 'dubbed' ? 'dublado em português' : 'original com legendas'}
              </p>
            </div>

            {/* Ações */}
            <div className="flex gap-4 pt-4">
              <button
                onClick={handleAddLanguage}
                disabled={!newLanguage.videoFile}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Adicionar
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewLanguage({ language_type: 'dubbed', videoFile: undefined });
                }}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra de Progresso do Upload */}
      {isUploading && uploadProgress && (
        <div className="p-6 bg-gray-800 rounded-lg border border-blue-500">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                Enviando arquivo...
              </h3>
              <span className="text-2xl font-bold text-blue-400">
                {uploadProgress.percentage.toFixed(1)}%
              </span>
            </div>

            {/* Barra de progresso */}
            <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300"
                style={{ width: `${uploadProgress.percentage}%` }}
              />
            </div>

            {/* Informações detalhadas */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Progresso:</span>
                <span className="text-white ml-2">
                  {MultipartUploadService.formatBytes(uploadProgress.uploadedBytes)} / {MultipartUploadService.formatBytes(uploadProgress.totalBytes)}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Velocidade:</span>
                <span className="text-white ml-2">
                  {uploadProgress.uploadSpeed ? `${MultipartUploadService.formatBytes(uploadProgress.uploadSpeed)}/s` : '--'}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Tempo restante:</span>
                <span className="text-white ml-2">
                  {uploadProgress.timeRemaining ? MultipartUploadService.formatTime(uploadProgress.timeRemaining) : '--'}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Partes:</span>
                <span className="text-white ml-2">
                  {uploadProgress.currentPart} / {uploadProgress.totalParts}
                </span>
              </div>
            </div>

            {/* Botão cancelar */}
            <button
              onClick={handleCancelUpload}
              className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              Cancelar Upload
            </button>
          </div>
        </div>
      )}

      {/* Erro de Upload */}
      {uploadError && (
        <div className="p-4 bg-red-900/20 border border-red-500 rounded-lg">
          <p className="text-red-400">{uploadError}</p>
          <button
            onClick={() => setUploadError(null)}
            className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Lista de Idiomas */}
      <div className="space-y-3">
        {languages.length === 0 && !isLoading && (
          <p className="text-gray-400 text-center py-8">
            Nenhum idioma adicionado ainda
          </p>
        )}

        {languages.map((language) => (
          <div
            key={language.id}
            className="p-4 bg-gray-800 rounded-lg border border-gray-700 flex items-center justify-between"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-blue-600 rounded-full text-sm font-medium">
                  {LANGUAGE_TYPE_LABELS[language.language_type]}
                </span>
                {language.is_default && (
                  <span className="px-3 py-1 bg-green-600 rounded-full text-sm font-medium">
                    Padrão
                  </span>
                )}
                {language.file_size_bytes && (
                  <span className="text-gray-400 text-sm">
                    {MultipartUploadService.formatBytes(language.file_size_bytes)}
                  </span>
                )}
              </div>
              {language.video_storage_key && (
                <p className="text-gray-500 text-xs mt-2">
                  {language.video_storage_key}
                </p>
              )}
            </div>

            <button
              onClick={() => handleDeleteLanguage(language.id)}
              className="ml-4 p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              title="Deletar idioma"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}