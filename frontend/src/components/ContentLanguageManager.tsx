'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Upload, Star, StarOff, Plus } from 'lucide-react';
import { VideoUpload } from './VideoUpload/VideoUpload';
import { UploadProgressBar } from './UploadProgress/UploadProgressBar';

interface LanguageOption {
  code: string;
  name: string;
}

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
  onPendingUploads?: (pendingUploads: Array<{ languageId: string; file: File; languageName: string }>) => void;
}

const LANGUAGE_TYPE_LABELS = {
  dubbed: 'Dublado',
  subtitled: 'Legendado',
};

export function ContentLanguageManager({ contentId, onLanguagesChange, onPendingUploads }: ContentLanguageManagerProps) {
  const [languages, setLanguages] = useState<ContentLanguage[]>([]);
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [uploadingLanguageId, setUploadingLanguageId] = useState<string | null>(null);
  const [pendingUploads, setPendingUploads] = useState<Array<{ languageId: string; file: File; languageName: string }>>([]);

  // Upload progress tracking
  const [uploadProgress, setUploadProgress] = useState<{
    progress: number;
    uploadedBytes: number;
    totalBytes: number;
    uploadSpeed?: number;
    timeRemaining?: number;
    status: 'uploading' | 'paused' | 'completed' | 'error';
    errorMessage?: string;
    fileName?: string;
  } | null>(null);

  const [uploadStartTime, setUploadStartTime] = useState<number | null>(null);
  const [lastUploadedBytes, setLastUploadedBytes] = useState<number>(0);
  const [lastProgressTime, setLastProgressTime] = useState<number | null>(null);

  // Form state for adding new language
  const [newLanguage, setNewLanguage] = useState<{
    language_type: 'dubbed' | 'subtitled';
    language_code: string;
    language_name: string;
    is_default: boolean;
    videoFile?: File;
  }>({
    language_type: 'dubbed',
    language_code: 'pt-BR',
    language_name: 'Português (Brasil)',
    is_default: false,
  });

  useEffect(() => {
    if (contentId) {
      loadLanguages();
      loadLanguageOptions();
    }
  }, [contentId]);

  const loadLanguages = async () => {
    try {
      setIsLoading(true);
      // Tentar obter token de diferentes fontes
      const token = typeof window !== 'undefined'
        ? (localStorage.getItem('admin_token') || localStorage.getItem('auth_token') || localStorage.getItem('sb-szghyvnbmjlquznxhqum-auth-token'))
        : null;
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_URL}/api/v1/content-language-upload/languages/${contentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setLanguages(data);
        onLanguagesChange?.(data);
      }
    } catch (error) {
      console.error('Erro ao carregar idiomas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadLanguageOptions = async () => {
    try {
      const token = typeof window !== 'undefined'
        ? (localStorage.getItem('admin_token') || localStorage.getItem('auth_token') || localStorage.getItem('sb-szghyvnbmjlquznxhqum-auth-token'))
        : null;
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_URL}/api/v1/content-language-upload/language-options`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setLanguageOptions(data);
      }
    } catch (error) {
      console.error('Erro ao carregar opções de idiomas:', error);
    }
  };

  const handleAddLanguage = async () => {
    if (!newLanguage.language_code || !newLanguage.language_name) {
      alert('Por favor, selecione um idioma');
      return;
    }

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

    try {
      const token = typeof window !== 'undefined'
        ? (localStorage.getItem('admin_token') || localStorage.getItem('auth_token') || localStorage.getItem('sb-szghyvnbmjlquznxhqum-auth-token'))
        : null;
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_URL}/api/v1/content-language-upload/language`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          content_id: contentId,
          language_type: newLanguage.language_type,
          language_code: newLanguage.language_code,
          language_name: newLanguage.language_name,
          is_default: newLanguage.is_default,
        }),
      });

      if (response.ok) {
        const createdLanguage = await response.json();

        // Adicionar à lista de uploads pendentes
        const newPending = {
          languageId: createdLanguage.id,
          file: newLanguage.videoFile,
          languageName: newLanguage.language_name,
        };

        const updatedPending = [...pendingUploads, newPending];
        setPendingUploads(updatedPending);

        // Notificar componente pai
        onPendingUploads?.(updatedPending);

        await loadLanguages();
        setShowAddForm(false);
        setNewLanguage({
          language_type: 'dubbed',
          language_code: 'pt-BR',
          language_name: 'Português (Brasil)',
          is_default: false,
          videoFile: undefined,
        });

        alert(`Idioma "${newLanguage.language_name}" adicionado! Clique em "Salvar Alterações" para iniciar o upload.`);
      } else {
        const error = await response.json();
        alert(error.message || 'Erro ao adicionar idioma');
      }
    } catch (error) {
      console.error('Erro ao adicionar idioma:', error);
      alert('Erro ao adicionar idioma');
    }
  };

  const handleDeleteLanguage = async (languageId: string) => {
    if (!confirm('Tem certeza que deseja deletar este idioma?')) {
      return;
    }

    try {
      const token = typeof window !== 'undefined'
        ? (localStorage.getItem('admin_token') || localStorage.getItem('auth_token') || localStorage.getItem('sb-szghyvnbmjlquznxhqum-auth-token'))
        : null;
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

  const handleSetDefault = async (languageId: string) => {
    try {
      const token = typeof window !== 'undefined'
        ? (localStorage.getItem('admin_token') || localStorage.getItem('auth_token') || localStorage.getItem('sb-szghyvnbmjlquznxhqum-auth-token'))
        : null;
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_URL}/api/v1/content-language-upload/language/${languageId}/set-default`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        await loadLanguages();
      } else {
        alert('Erro ao definir idioma padrão');
      }
    } catch (error) {
      console.error('Erro ao definir idioma padrão:', error);
      alert('Erro ao definir idioma padrão');
    }
  };

  const handleLanguageCodeChange = (code: string) => {
    const option = languageOptions.find(opt => opt.code === code);
    setNewLanguage(prev => ({
      ...prev,
      language_code: code,
      language_name: option?.name || '',
    }));
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  };

  const calculateUploadMetrics = (
    uploadedBytes: number,
    totalBytes: number,
    fileName: string
  ) => {
    const currentTime = Date.now();
    const progress = Math.round((uploadedBytes / totalBytes) * 100);

    // Calculate upload speed (bytes per second)
    let uploadSpeed: number | undefined;
    let timeRemaining: number | undefined;

    if (lastProgressTime && lastProgressTime !== currentTime) {
      const timeDiff = (currentTime - lastProgressTime) / 1000; // seconds
      const bytesDiff = uploadedBytes - lastUploadedBytes;
      uploadSpeed = bytesDiff / timeDiff;

      // Calculate time remaining
      const remainingBytes = totalBytes - uploadedBytes;
      if (uploadSpeed > 0) {
        timeRemaining = remainingBytes / uploadSpeed;
      }
    }

    // Update tracking state
    setLastUploadedBytes(uploadedBytes);
    setLastProgressTime(currentTime);

    return {
      progress,
      uploadedBytes,
      totalBytes,
      uploadSpeed,
      timeRemaining,
      status: 'uploading' as const,
      fileName,
    };
  };

  const handleVideoUploadProgress = (
    fileName: string,
    loaded: number,
    total: number
  ) => {
    const metrics = calculateUploadMetrics(loaded, total, fileName);
    setUploadProgress(metrics);
  };

  const resetUploadProgress = () => {
    setUploadProgress(null);
    setUploadStartTime(null);
    setLastUploadedBytes(0);
    setLastProgressTime(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Idiomas do Conteúdo</h3>
        <Button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Adicionar Idioma
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Adicionar Novo Idioma</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="language_type" className="text-sm font-medium text-gray-200">
                Tipo de Áudio
              </Label>
              <Select
                value={newLanguage.language_type}
                onValueChange={(value: any) => setNewLanguage(prev => ({
                  ...prev,
                  language_type: value,
                  language_code: 'pt-BR',
                  language_name: 'Português (Brasil)'
                }))}
              >
                <SelectTrigger className="w-full bg-gray-900/50 border border-gray-700 text-white rounded-lg px-4 py-3 hover:bg-gray-800/50 transition-colors">
                  <span className="block truncate text-white text-sm">
                    {newLanguage.language_type === 'dubbed' ? 'Dublado' : newLanguage.language_type === 'subtitled' ? 'Legendado' : 'Selecione o tipo de áudio'}
                  </span>
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
                  <SelectItem value="dubbed" className="text-white hover:bg-gray-800 data-[headlessui-state=active]:bg-gray-800 px-4 py-3 cursor-pointer transition-colors border-b border-gray-800 last:border-b-0">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-sm">Dublado</span>
                      <span className="text-xs text-gray-400">Áudio em português brasileiro</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="subtitled" className="text-white hover:bg-gray-800 data-[headlessui-state=active]:bg-gray-800 px-4 py-3 cursor-pointer transition-colors border-b border-gray-800 last:border-b-0">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-sm">Legendado</span>
                      <span className="text-xs text-gray-400">Áudio original com legendas em português</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newLanguage.language_type && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-200">
                  Arquivo de Vídeo (.mp4 apenas)
                </Label>
                <Input
                  type="file"
                  accept=".mp4"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setNewLanguage(prev => ({ ...prev, videoFile: file }));
                    }
                  }}
                  className="bg-gray-800 border-gray-700 text-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-gray-700 file:text-white hover:file:bg-gray-600"
                />
                <p className="text-xs text-gray-400">
                  {newLanguage.language_type === 'dubbed'
                    ? 'Arquivo com áudio dublado em português'
                    : 'Arquivo com áudio original e legendas'}
                </p>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_default"
                checked={newLanguage.is_default}
                onChange={(e) => setNewLanguage(prev => ({ ...prev, is_default: e.target.checked }))}
                className="rounded border-gray-700 bg-gray-800"
              />
              <Label htmlFor="is_default" className="text-sm text-gray-200">
                Definir como idioma padrão
              </Label>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleAddLanguage} className="bg-red-600 hover:bg-red-700">
                Adicionar
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)} className="border-gray-700 text-gray-200 hover:bg-gray-800">
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-8">Carregando idiomas...</div>
      ) : languages.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Nenhum idioma adicionado ainda
        </div>
      ) : (
        <div className="space-y-4">
          {languages.map((language) => (
            <Card key={language.id}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{language.language_name}</h4>
                      <Badge variant="secondary">
                        {LANGUAGE_TYPE_LABELS[language.language_type]}
                      </Badge>
                      {language.is_default && (
                        <Badge variant="default">Padrão</Badge>
                      )}
                      {pendingUploads.some(p => p.languageId === language.id) && !language.video_url && (
                        <Badge className="bg-yellow-600 hover:bg-yellow-700">Upload Pendente</Badge>
                      )}
                    </div>

                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Código: {language.language_code}</p>
                      {language.video_url && (
                        <p>Status: ✅ Vídeo carregado ({formatFileSize(language.file_size_bytes)})</p>
                      )}
                      {!language.video_url && !pendingUploads.some(p => p.languageId === language.id) && (
                        <p>Status: ⚠️ Nenhum vídeo adicionado</p>
                      )}
                      {!language.video_url && pendingUploads.some(p => p.languageId === language.id) && (
                        <p>Status: ⏳ Arquivo selecionado - clique em "Salvar Alterações" para iniciar upload</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!language.is_default && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(language.id)}
                        className="flex items-center gap-1"
                      >
                        <Star className="w-3 h-3" />
                        Definir Padrão
                      </Button>
                    )}

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteLanguage(language.id)}
                      className="flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {false && uploadingLanguageId === language.id && (
                  <div className="mt-4 border-t pt-4 space-y-4">
                    {/* Upload Progress Bar */}
                    {uploadProgress && uploadProgress.status !== 'completed' && (
                      <UploadProgressBar
                        progress={uploadProgress.progress}
                        fileName={uploadProgress.fileName || 'video.mp4'}
                        uploadedBytes={uploadProgress.uploadedBytes}
                        totalBytes={uploadProgress.totalBytes}
                        uploadSpeed={uploadProgress.uploadSpeed}
                        timeRemaining={uploadProgress.timeRemaining}
                        status={uploadProgress.status}
                        errorMessage={uploadProgress.errorMessage}
                        showControls={false}
                      />
                    )}

                    <VideoUpload
                      maxFileSize={5120}
                      onProgress={(fileName, loaded, total) => {
                        handleVideoUploadProgress(fileName, loaded, total);
                      }}
                      onUploadComplete={(result) => {
                        console.log('Upload completo:', result);
                        setUploadProgress({
                          ...uploadProgress!,
                          status: 'completed',
                          progress: 100,
                        });
                        setTimeout(() => {
                          setUploadingLanguageId(null);
                          resetUploadProgress();
                          loadLanguages();
                        }, 2000); // Show completed state for 2 seconds
                      }}
                      onUploadError={(error) => {
                        console.error('Erro no upload:', error);
                        setUploadProgress({
                          progress: uploadProgress?.progress || 0,
                          uploadedBytes: uploadProgress?.uploadedBytes || 0,
                          totalBytes: uploadProgress?.totalBytes || 0,
                          status: 'error',
                          errorMessage: error,
                          fileName: uploadProgress?.fileName,
                        });
                      }}
                      customEndpoints={{
                        initiate: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/content-language-upload/initiate-multipart`,
                        complete: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/content-language-upload/complete-multipart`,
                        presignedUrl: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/content-language-upload/presigned-url`,
                      }}
                      customPayload={{
                        content_language_id: language.id,
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setUploadingLanguageId(null);
                        resetUploadProgress();
                      }}
                      className="mt-2"
                    >
                      Cancelar Upload
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}