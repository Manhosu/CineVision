'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Film,
  Trash2,
  Edit,
  Plus,
  Search,
  Volume2,
  AlertCircle,
  CheckCircle,
  ArrowLeft
} from 'lucide-react';
import { useUpload } from '@/contexts/UploadContext';

interface AudioTrack {
  id: string;
  language_name: string;
  language_type: string;
  quality: string;
  status: string;
  is_primary: boolean;
}

interface Content {
  id: string;
  title: string;
  content_type: string;
  poster_url: string;
  total_seasons?: number;
  total_episodes?: number;
  created_at: string;
  status: string;
  audio_tracks?: AudioTrack[];
}

export default function ContentManagePage() {
  const router = useRouter();
  const { addTask, updateTask, tasks } = useUpload();
  const cancelFlagsRef = useRef<Map<string, boolean>>(new Map());
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Content | null>(null);
  const [showAddAudioModal, setShowAddAudioModal] = useState(false);
  const [newAudio, setNewAudio] = useState({
    language_name: '',
    language_type: 'dubbed',
    language_code: 'pt-BR',
    quality: '1080p',
    audio_type: 'Dublado',
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);

  useEffect(() => {
    fetchContents();
  }, []);

  // Sync cancel flags from tasks
  useEffect(() => {
    tasks.forEach(task => {
      if (task.cancelRequested) {
        cancelFlagsRef.current.set(task.id, true);
      }
    });
  }, [tasks]);

  const fetchContents = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/v1/admin/content');
      if (response.ok) {
        const data = await response.json();

        // Fetch audio tracks for each content
        const contentsWithAudio = await Promise.all(
          data.map(async (content: Content) => {
            try {
              const audioResponse = await fetch(
                `http://localhost:3001/api/v1/admin/content/${content.id}/audio-tracks`
              );
              if (audioResponse.ok) {
                const audioData = await audioResponse.json();
                return { ...content, audio_tracks: audioData.data || [] };
              }
            } catch (err) {
              console.error('Error fetching audio tracks:', err);
            }
            return { ...content, audio_tracks: [] };
          })
        );

        setContents(contentsWithAudio);
      }
    } catch (error) {
      console.error('Error fetching contents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (content: Content) => {
    setDeleteTarget(content);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      const response = await fetch(
        `http://localhost:3001/api/v1/admin/content/${deleteTarget.id}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        await fetchContents();
        setShowDeleteConfirm(false);
        setDeleteTarget(null);
      } else {
        alert('Erro ao deletar conteúdo');
      }
    } catch (error) {
      console.error('Error deleting content:', error);
      alert('Erro ao deletar conteúdo');
    }
  };

  const handleEdit = (content: Content) => {
    setSelectedContent(content);
    setShowEditModal(true);
  };

  const handleDeleteAudioTrack = async (contentId: string, audioId: string) => {
    if (!confirm('Deseja realmente remover este áudio?')) return;

    try {
      const response = await fetch(
        `http://localhost:3001/api/v1/admin/content/${contentId}/audio-tracks/${audioId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        await fetchContents();
        if (selectedContent?.id === contentId) {
          const updatedContent = contents.find(c => c.id === contentId);
          if (updatedContent) setSelectedContent(updatedContent);
        }
      }
    } catch (error) {
      console.error('Error deleting audio track:', error);
    }
  };

  const handleAddAudio = () => {
    setShowAddAudioModal(true);
  };

  const handleAddAudioSubmit = async () => {
    if (!selectedContent) return;

    if (!newAudio.language_name.trim()) {
      alert('Por favor, preencha o nome do idioma');
      return;
    }

    if (!videoFile) {
      alert('Por favor, selecione um arquivo de vídeo');
      return;
    }

    // Create upload task
    const taskId = `upload-${Date.now()}`;
    const task = {
      id: taskId,
      fileName: videoFile.name,
      contentTitle: selectedContent.title,
      progress: 0,
      status: 'uploading' as const,
    };

    addTask(task);

    // Close modal and reset form immediately
    setShowAddAudioModal(false);
    setNewAudio({
      language_name: '',
      language_type: 'dubbed',
      language_code: 'pt-BR',
      quality: '1080p',
      audio_type: 'Dublado',
    });
    const fileToUpload = videoFile;
    const contentToUpload = selectedContent;
    const audioToUpload = { ...newAudio };
    setVideoFile(null);

    // Start upload in background
    (async () => {
      try {

      // Step 1: Try to create audio track record, or get existing one
      let languageId: string | null = null;

        const createResponse = await fetch(
          `http://localhost:3001/api/v1/admin/content/${contentToUpload.id}/audio-tracks`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(audioToUpload),
          }
        );

        if (createResponse.ok) {
          const audioTrack = await createResponse.json();
          languageId = audioTrack.data?.id || audioTrack.id;
        } else if (createResponse.status === 500) {
          const listResponse = await fetch(
            `http://localhost:3001/api/v1/admin/content/${contentToUpload.id}/audio-tracks`
          );

          if (listResponse.ok) {
            const { data } = await listResponse.json();
            const existing = data.find(
              (a: any) =>
                a.language_type === audioToUpload.language_type &&
                a.language_code === audioToUpload.language_code
            );

            if (existing) {
              languageId = existing.id;
            }
          }
        }

        if (!languageId) {
          throw new Error('Não foi possível criar ou encontrar o registro de áudio');
        }

        // Step 2: Initiate multipart upload
        const filename = fileToUpload.name.replace(/[^a-zA-Z0-9.-]/g, '-');
        const initiateResponse = await fetch(
          'http://localhost:3001/api/v1/content-language-upload/initiate-multipart',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content_language_id: languageId,
              file_name: filename,
              file_size: fileToUpload.size,
              content_type: 'video/mp4',
            }),
          }
        );

        if (!initiateResponse.ok) {
          throw new Error('Erro ao iniciar upload multipart');
        }

        const { uploadId, key } = await initiateResponse.json();

        // Update task with uploadId and languageId for cancellation
        updateTask(taskId, { uploadId, languageId });

        // Step 3: Upload file in chunks
        const chunkSize = 10 * 1024 * 1024;
        const totalParts = Math.ceil(fileToUpload.size / chunkSize);
        const uploadedParts: any[] = [];

        for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
          // Check if cancellation was requested using ref
          if (cancelFlagsRef.current.get(taskId)) {
            // Call abort endpoint
            try {
              await fetch('http://localhost:3001/api/v1/content-language-upload/abort-multipart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  content_language_id: languageId,
                  upload_id: uploadId,
                }),
              });
            } catch (abortError) {
              console.error('Error aborting upload:', abortError);
            }
            updateTask(taskId, { status: 'cancelled', progress: 0 });
            cancelFlagsRef.current.delete(taskId);
            return; // Exit upload function
          }

          const start = (partNumber - 1) * chunkSize;
          const end = Math.min(start + chunkSize, fileToUpload.size);
          const chunk = fileToUpload.slice(start, end);

          const base64Chunk = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = (reader.result as string).split(',')[1];
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(chunk);
          });

          const uploadResponse = await fetch(
            'http://localhost:3001/api/v1/content-language-upload/upload-part',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content_language_id: languageId,
                upload_id: uploadId,
                part_number: partNumber,
                chunk_data: base64Chunk,
              }),
            }
          );

          if (!uploadResponse.ok) {
            throw new Error(`Erro ao fazer upload da parte ${partNumber}`);
          }

          const { ETag, PartNumber } = await uploadResponse.json();
          uploadedParts.push({ PartNumber, ETag });

          // Update progress
          const progress = Math.round((partNumber / totalParts) * 100);
          updateTask(taskId, { progress });
        }

        // Step 4: Complete multipart upload
        const completeResponse = await fetch(
          'http://localhost:3001/api/v1/content-language-upload/complete-multipart',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content_language_id: languageId,
              upload_id: uploadId,
              parts: uploadedParts,
            }),
          }
        );

        if (!completeResponse.ok) {
          throw new Error('Erro ao finalizar upload');
        }

        // Mark as completed
        updateTask(taskId, { status: 'completed', progress: 100 });

        // Refresh content list
        await fetchContents();
      } catch (error) {
        console.error('Error adding audio track:', error);
        updateTask(taskId, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    })();
  };

  const filteredContents = contents.filter(content =>
    content.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <button
              onClick={() => router.push('/admin')}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar para Admin
            </button>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
              Gerenciar Conteúdos
            </h1>
            <p className="text-gray-400 mt-2">
              Gerencie filmes, séries e seus áudios/legendas
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6 relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por título..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-dark-800/50 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <p className="text-3xl font-bold bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
              {contents.length}
            </p>
            <p className="text-sm text-gray-400 mt-1">Total de Conteúdos</p>
          </div>
          <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <p className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              {contents.filter(c => c.content_type === 'movie').length}
            </p>
            <p className="text-sm text-gray-400 mt-1">Filmes</p>
          </div>
          <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <p className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              {contents.filter(c => c.content_type === 'series').length}
            </p>
            <p className="text-sm text-gray-400 mt-1">Séries</p>
          </div>
        </div>

        {/* Content Table */}
        <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-900/50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                    Poster
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                    Título
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                    Tipo
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                    Áudios
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                    Status
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredContents.map((content) => (
                  <tr key={content.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <img
                        src={content.poster_url || '/images/placeholder-poster.svg'}
                        alt={content.title}
                        className="w-12 h-16 object-cover rounded"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{content.title}</div>
                      {content.content_type === 'series' && (
                        <div className="text-sm text-gray-400 mt-1">
                          {content.total_seasons} Temporadas • {content.total_episodes} Episódios
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-primary-500/20 text-primary-400">
                        <Film className="w-3 h-3" />
                        {content.content_type === 'movie' ? 'Filme' : 'Série'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-300">
                          {content.audio_tracks?.length || 0} áudios
                        </span>
                      </div>
                      {content.audio_tracks && content.audio_tracks.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          {content.audio_tracks.map(a => a.language_name).join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {content.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">
                          <CheckCircle className="w-3 h-3" />
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-yellow-500/20 text-yellow-400">
                          <AlertCircle className="w-3 h-3" />
                          {content.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(content)}
                          className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(content)}
                          className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                          title="Deletar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && deleteTarget && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-dark-800 border border-white/10 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-white mb-4">
                Confirmar Exclusão
              </h3>
              <p className="text-gray-300 mb-6">
                Tem certeza que deseja excluir <strong>{deleteTarget.title}</strong>?
                Esta ação não pode ser desfeita e irá remover:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-400 mb-6 space-y-1">
                <li>O conteúdo do banco de dados</li>
                <li>Todos os arquivos de vídeo do S3</li>
                <li>Todos os áudios/legendas</li>
                <li>Imagens (poster, backdrop)</li>
              </ul>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteTarget(null);
                  }}
                  className="flex-1 px-4 py-2 rounded-lg bg-dark-700 text-white hover:bg-dark-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && selectedContent && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-dark-800 border border-white/10 rounded-xl p-6 max-w-4xl w-full my-8">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-2xl font-bold text-white">
                  Editar: {selectedContent.title}
                </h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Audio Tracks Section */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Volume2 className="w-5 h-5" />
                    Áudios / Legendas
                  </h4>
                  <button
                    onClick={handleAddAudio}
                    className="px-4 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Áudio
                  </button>
                </div>

                {selectedContent.audio_tracks && selectedContent.audio_tracks.length > 0 ? (
                  <div className="space-y-3">
                    {selectedContent.audio_tracks.map((audio) => (
                      <div
                        key={audio.id}
                        className="bg-dark-700/50 border border-white/10 rounded-lg p-4 flex items-center justify-between"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-white">
                              {audio.language_name}
                            </span>
                            <span className="px-2 py-1 rounded text-xs bg-primary-500/20 text-primary-400">
                              {audio.language_type}
                            </span>
                            <span className="px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-400">
                              {audio.quality}
                            </span>
                            {audio.is_primary && (
                              <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400">
                                Padrão
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-400 mt-1">
                            Status: {audio.status}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteAudioTrack(selectedContent.id, audio.id)}
                          className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    Nenhum áudio cadastrado
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-6 py-2 rounded-lg bg-dark-700 text-white hover:bg-dark-600 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Audio Modal */}
        {showAddAudioModal && selectedContent && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-dark-800 border border-white/10 rounded-xl p-6 max-w-lg w-full">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-xl font-bold text-white">
                  Adicionar Novo Áudio
                </h3>
                <button
                  onClick={() => setShowAddAudioModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nome do Idioma *
                  </label>
                  <input
                    type="text"
                    value={newAudio.language_name}
                    onChange={(e) => setNewAudio({ ...newAudio, language_name: e.target.value })}
                    placeholder="Ex: Português (Brasil) - Dublado"
                    className="w-full bg-dark-700 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Tipo de Idioma
                  </label>
                  <select
                    value={newAudio.language_type}
                    onChange={(e) => setNewAudio({ ...newAudio, language_type: e.target.value })}
                    className="w-full bg-dark-700 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary-500"
                  >
                    <option value="original">Original</option>
                    <option value="dubbed">Dublado</option>
                    <option value="subtitled">Legendado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Código do Idioma
                  </label>
                  <select
                    value={newAudio.language_code}
                    onChange={(e) => setNewAudio({ ...newAudio, language_code: e.target.value })}
                    className="w-full bg-dark-700 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary-500"
                  >
                    <option value="pt-BR">Português (Brasil)</option>
                    <option value="en-US">Inglês (EUA)</option>
                    <option value="es-ES">Espanhol (Espanha)</option>
                    <option value="fr-FR">Francês</option>
                    <option value="de-DE">Alemão</option>
                    <option value="it-IT">Italiano</option>
                    <option value="ja-JP">Japonês</option>
                    <option value="ko-KR">Coreano</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Qualidade
                  </label>
                  <select
                    value={newAudio.quality}
                    onChange={(e) => setNewAudio({ ...newAudio, quality: e.target.value })}
                    className="w-full bg-dark-700 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary-500"
                  >
                    <option value="480p">480p</option>
                    <option value="720p">720p</option>
                    <option value="1080p">1080p</option>
                    <option value="4K">4K</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Tipo de Áudio
                  </label>
                  <input
                    type="text"
                    value={newAudio.audio_type}
                    onChange={(e) => setNewAudio({ ...newAudio, audio_type: e.target.value })}
                    placeholder="Ex: Dublado, Legendado, Original"
                    className="w-full bg-dark-700 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Arquivo de Vídeo *
                  </label>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                    className="w-full bg-dark-700 border border-white/10 rounded-lg px-4 py-2 text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-500 file:text-white hover:file:bg-primary-600 cursor-pointer focus:outline-none focus:border-primary-500"
                  />
                  {videoFile && (
                    <p className="text-sm text-gray-400 mt-2">
                      Arquivo selecionado: {videoFile.name} ({(videoFile.size / 1024 / 1024 / 1024).toFixed(2)} GB)
                    </p>
                  )}
                </div>

              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAddAudioModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-dark-700 text-white hover:bg-dark-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddAudioSubmit}
                  disabled={!videoFile}
                  className="flex-1 px-4 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
