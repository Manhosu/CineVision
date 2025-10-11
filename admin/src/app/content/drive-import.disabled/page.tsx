'use client';

import React, { useState, useEffect } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import Cookies from 'js-cookie';

interface Content {
  id: string;
  title: string;
  type: string;
}

interface DriveImportProgress {
  stage: string;
  progress: number;
  message: string;
  error?: string;
  s3Url?: string;
  fileSize?: number;
}

export default function DriveImportPage() {
  const [driveUrl, setDriveUrl] = useState('');
  const [selectedContentId, setSelectedContentId] = useState('');
  const [audioType, setAudioType] = useState('dublado');
  const [language, setLanguage] = useState('pt-BR');
  const [quality, setQuality] = useState('1080p');
  const [contents, setContents] = useState<Content[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [progress, setProgress] = useState<DriveImportProgress | null>(null);

  // Carregar conteúdos disponíveis
  useEffect(() => {
    fetchContents();
  }, []);

  // Poll progress when upload is active
  useEffect(() => {
    if (!uploadId) return;

    const interval = setInterval(async () => {
      try {
        const token = Cookies.get('admin_token');
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/drive-import/progress/${uploadId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const progressData = await response.json();
          setProgress(progressData);

          // Stop polling if completed or failed
          if (progressData.stage === 'completed' || progressData.stage === 'failed') {
            clearInterval(interval);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar progresso:', error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [uploadId]);

  const fetchContents = async () => {
    try {
      const token = Cookies.get('admin_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/content`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setContents(data);
      }
    } catch (error) {
      console.error('Erro ao buscar conteúdos:', error);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!driveUrl || !selectedContentId) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    setIsLoading(true);
    setProgress(null);

    try {
      const token = Cookies.get('admin_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/drive-import/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          drive_url: driveUrl,
          content_id: selectedContentId,
          audio_type: audioType,
          language,
          quality,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setUploadId(result.uploadId);
        alert('Importação iniciada com sucesso!');
      } else {
        const error = await response.json();
        alert(`Erro: ${error.message || 'Falha ao iniciar importação'}`);
      }
    } catch (error) {
      console.error('Erro ao importar:', error);
      alert('Erro ao importar vídeo do Google Drive');
    } finally {
      setIsLoading(false);
    }
  };

  const getProgressColor = () => {
    if (!progress) return 'bg-blue-500';

    switch (progress.stage) {
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'uploading':
        return 'bg-blue-500';
      case 'saving':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      'validating': 'Validando',
      'downloading': 'Baixando do Drive',
      'uploading': 'Enviando para S3',
      'saving': 'Salvando no banco',
      'completed': 'Concluído',
      'failed': 'Falhou',
    };
    return labels[stage] || stage;
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">Importar do Google Drive</h1>
          <p className="text-gray-400 mt-1">
            Importe vídeos diretamente do Google Drive para o S3
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form */}
          <div className="card space-y-6">
            <h2 className="text-xl font-semibold text-white">Informações do Import</h2>

            <form onSubmit={handleImport} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Link do Google Drive *
                </label>
                <input
                  type="url"
                  value={driveUrl}
                  onChange={(e) => setDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/..."
                  className="input-field w-full"
                  required
                  disabled={isLoading || !!uploadId}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Cole o link de compartilhamento do arquivo no Google Drive
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Conteúdo de Destino *
                </label>
                <select
                  value={selectedContentId}
                  onChange={(e) => setSelectedContentId(e.target.value)}
                  className="input-field w-full"
                  required
                  disabled={isLoading || !!uploadId}
                >
                  <option value="">Selecione um conteúdo</option>
                  {contents.map((content) => (
                    <option key={content.id} value={content.id}>
                      {content.title} ({content.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tipo de Áudio *
                </label>
                <select
                  value={audioType}
                  onChange={(e) => setAudioType(e.target.value)}
                  className="input-field w-full"
                  disabled={isLoading || !!uploadId}
                >
                  <option value="dublado">Dublado</option>
                  <option value="legendado">Legendado</option>
                  <option value="original">Original</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Idioma
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="input-field w-full"
                    disabled={isLoading || !!uploadId}
                  >
                    <option value="pt-BR">Português (Brasil)</option>
                    <option value="en-US">English (US)</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Qualidade
                  </label>
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    className="input-field w-full"
                    disabled={isLoading || !!uploadId}
                  >
                    <option value="480p">480p</option>
                    <option value="720p">720p</option>
                    <option value="1080p">1080p</option>
                    <option value="4K">4K</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !!uploadId}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Iniciando...' : uploadId ? 'Import em Andamento' : 'Iniciar Importação'}
              </button>

              {uploadId && (
                <button
                  type="button"
                  onClick={() => {
                    setUploadId(null);
                    setProgress(null);
                    setDriveUrl('');
                  }}
                  className="btn-secondary w-full"
                >
                  Nova Importação
                </button>
              )}
            </form>
          </div>

          {/* Progress */}
          <div className="card space-y-6">
            <h2 className="text-xl font-semibold text-white">Status do Import</h2>

            {!progress && !uploadId && (
              <div className="text-center py-12 text-gray-500">
                <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p>Aguardando início da importação...</p>
              </div>
            )}

            {uploadId && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Upload ID:</span>
                  <span className="font-mono text-white">{uploadId}</span>
                </div>

                {progress && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-300">
                          {getStageLabel(progress.stage)}
                        </span>
                        <span className="text-sm font-medium text-white">
                          {progress.progress}%
                        </span>
                      </div>
                      <div className="w-full bg-dark-700 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${getProgressColor()}`}
                          style={{ width: `${progress.progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="bg-dark-700/50 border border-dark-600 rounded-lg p-4">
                      <p className="text-sm text-gray-300">{progress.message}</p>

                      {progress.fileSize && (
                        <p className="text-xs text-gray-500 mt-2">
                          Tamanho: {(progress.fileSize / (1024 * 1024 * 1024)).toFixed(2)} GB
                        </p>
                      )}

                      {progress.error && (
                        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded">
                          <p className="text-sm text-red-400">{progress.error}</p>
                        </div>
                      )}

                      {progress.s3Url && (
                        <div className="mt-3">
                          <p className="text-xs text-gray-500 mb-1">URL S3:</p>
                          <p className="text-xs font-mono text-green-400 break-all">
                            {progress.s3Url}
                          </p>
                        </div>
                      )}
                    </div>

                    {progress.stage === 'completed' && (
                      <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-green-400 font-medium">
                          Importação concluída com sucesso!
                        </span>
                      </div>
                    )}

                    {progress.stage === 'failed' && (
                      <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-red-400 font-medium">
                          Importação falhou
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-3">📖 Como Usar</h3>
          <ol className="space-y-2 text-sm text-gray-300">
            <li className="flex gap-3">
              <span className="font-bold text-blue-400">1.</span>
              <span>Faça upload do vídeo para o Google Drive e obtenha o link de compartilhamento</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-blue-400">2.</span>
              <span>Certifique-se de que o link está configurado para "Qualquer pessoa com o link pode visualizar"</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-blue-400">3.</span>
              <span>Cole o link completo do Google Drive no campo acima</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-blue-400">4.</span>
              <span>Selecione o conteúdo de destino (o filme/série que receberá o vídeo)</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-blue-400">5.</span>
              <span>Escolha o tipo de áudio (dublado, legendado ou original)</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-blue-400">6.</span>
              <span>Clique em "Iniciar Importação" e acompanhe o progresso em tempo real</span>
            </li>
          </ol>
        </div>
      </div>
    </AdminLayout>
  );
}
