'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { Plus, Edit2, Trash2, Save, X, Film, Upload as UploadIcon, Clock } from 'lucide-react';
import { EpisodeVideoUpload, EpisodeVideoUploadRef } from '@/components/EpisodeVideoUpload';
import { uploadImageToSupabase } from '@/lib/supabaseStorage';
import { useUpload } from '@/contexts/UploadContext';

interface Episode {
  id: string;
  season_number: number;
  episode_number: number;
  title: string;
  description: string;
  duration_seconds: number;
  thumbnail_url?: string;
  video_url?: string;
  storage_path?: string;
  file_storage_key?: string;
  processing_status?: string;
  created_at: string;
  updated_at: string;
}

interface EpisodeManagerProps {
  seriesId: string;
  totalSeasons: number;
  onEpisodesChange?: (episodes: Episode[]) => void;
}

interface NewEpisode {
  season_number: number;
  episode_number: number;
  title: string;
  description: string;
  duration_minutes: number;
}

export function EpisodeManager({ seriesId, totalSeasons, onEpisodesChange }: EpisodeManagerProps) {
  const videoUploadRef = useRef<EpisodeVideoUploadRef>(null);
  const { getPendingUploadByEpisode } = useUpload();

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEpisode, setEditingEpisode] = useState<Episode | null>(null);
  const [showVideoUpload, setShowVideoUpload] = useState(false);
  const [selectedEpisodeForUpload, setSelectedEpisodeForUpload] = useState<Episode | null>(null);

  // New episode form
  const [newEpisode, setNewEpisode] = useState<NewEpisode>({
    season_number: 1,
    episode_number: 1,
    title: '',
    description: '',
    duration_minutes: 0,
  });

  // Edit form
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDuration, setEditDuration] = useState(0);
  const [editThumbnail, setEditThumbnail] = useState('');
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadEpisodes();
  }, [seriesId]);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/content/series/${seriesId}/episodes`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setEpisodes(data);
        onEpisodesChange?.(data);
      } else {
        toast.error('Erro ao carregar episódios');
      }
    } catch (error) {
      console.error('Erro ao carregar episódios:', error);
      toast.error('Erro ao carregar episódios');
    } finally {
      setLoading(false);
    }
  };

  const handleAddEpisode = async () => {
    if (!newEpisode.title.trim()) {
      toast.error('O título é obrigatório');
      return;
    }

    try {
      const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/content/series/${seriesId}/episodes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...newEpisode,
            duration_seconds: newEpisode.duration_minutes * 60,
          }),
        }
      );

      if (response.ok) {
        toast.success('Episódio adicionado com sucesso!');
        setShowAddModal(false);
        setNewEpisode({
          season_number: selectedSeason,
          episode_number: 1,
          title: '',
          description: '',
          duration_minutes: 0,
        });
        await loadEpisodes();
      } else {
        const error = await response.json();
        toast.error(`Erro ao adicionar episódio: ${error.message || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao adicionar episódio:', error);
      toast.error('Erro ao adicionar episódio');
    }
  };

  const handleEditEpisode = async () => {
    if (!editingEpisode) return;

    if (!editTitle.trim()) {
      toast.error('O título é obrigatório');
      return;
    }

    try {
      const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/content/series/${seriesId}/episodes/${editingEpisode.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: editTitle.trim(),
            description: editDescription.trim(),
            duration_seconds: editDuration * 60,
            thumbnail_url: editThumbnail,
          }),
        }
      );

      if (response.ok) {
        toast.success('Episódio atualizado com sucesso!');
        setEditingEpisode(null);
        await loadEpisodes();
      } else {
        const error = await response.json();
        toast.error(`Erro ao atualizar episódio: ${error.message || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao atualizar episódio:', error);
      toast.error('Erro ao atualizar episódio');
    }
  };

  const handleDeleteEpisode = async (episodeId: string, episodeTitle: string) => {
    if (!confirm(`Tem certeza que deseja deletar o episódio "${episodeTitle}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/content/episodes/${episodeId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        toast.success('Episódio deletado com sucesso!');
        await loadEpisodes();
      } else {
        const error = await response.json();
        toast.error(`Erro ao deletar episódio: ${error.message || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao deletar episódio:', error);
      toast.error('Erro ao deletar episódio');
    }
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingThumbnail(true);
      const url = await uploadImageToSupabase(file, 'thumbnails');
      setEditThumbnail(url);
      toast.success('Thumbnail enviado com sucesso!');
    } catch (error) {
      console.error('Erro ao fazer upload do thumbnail:', error);
      toast.error('Erro ao fazer upload do thumbnail');
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const startEditingEpisode = (episode: Episode) => {
    setEditingEpisode(episode);
    setEditTitle(episode.title);
    setEditDescription(episode.description);
    setEditDuration(Math.round(episode.duration_seconds / 60));
    setEditThumbnail(episode.thumbnail_url || '');
  };

  const openVideoUpload = (episode: Episode) => {
    setSelectedEpisodeForUpload(episode);
    setShowVideoUpload(true);
  };

  const seasonsEpisodes = episodes.filter(ep => ep.season_number === selectedSeason);
  const seasons = Array.from({ length: totalSeasons }, (_, i) => i + 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-xl font-semibold">Gerenciar Episódios</h3>

          {/* Season Selector */}
          {totalSeasons > 1 && (
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(parseInt(e.target.value))}
              className="px-4 py-2 bg-dark-700 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary-500"
            >
              {seasons.map(season => (
                <option key={season} value={season}>Temporada {season}</option>
              ))}
            </select>
          )}
        </div>

        <button
          onClick={() => {
            setNewEpisode({
              ...newEpisode,
              season_number: selectedSeason,
              episode_number: seasonsEpisodes.length + 1,
            });
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors font-semibold"
        >
          <Plus className="w-5 h-5" />
          Adicionar Episódio
        </button>
      </div>

      {/* Episodes List */}
      {seasonsEpisodes.length > 0 ? (
        <div className="space-y-3">
          {seasonsEpisodes.map((episode) => (
            <div
              key={episode.id}
              className="bg-dark-700/50 border border-white/10 rounded-lg p-4"
            >
              {editingEpisode?.id === episode.id ? (
                /* Edit Mode */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Título</label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Duração (minutos)</label>
                      <input
                        type="number"
                        value={editDuration}
                        onChange={(e) => setEditDuration(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary-500"
                        min="0"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Descrição</label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary-500"
                    />
                  </div>

                  {/* Thumbnail Upload */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Thumbnail</label>
                    {editThumbnail && (
                      <div className="relative mb-3 w-48">
                        <img
                          src={editThumbnail}
                          alt="Thumbnail"
                          className="w-full h-28 object-cover rounded-lg border border-white/10"
                        />
                        <button
                          onClick={() => setEditThumbnail('')}
                          className="absolute top-1 right-1 p-1 bg-red-500 hover:bg-red-600 rounded-full transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <input
                      ref={thumbnailInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleThumbnailUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => thumbnailInputRef.current?.click()}
                      disabled={uploadingThumbnail}
                      className="px-4 py-2 bg-dark-800 hover:bg-dark-700 border border-white/10 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {uploadingThumbnail ? 'Enviando...' : editThumbnail ? 'Trocar Thumbnail' : 'Upload Thumbnail'}
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleEditEpisode}
                      className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      Salvar
                    </button>
                    <button
                      onClick={() => setEditingEpisode(null)}
                      className="flex items-center gap-2 px-4 py-2 bg-dark-600 hover:bg-dark-500 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <div className="flex items-start justify-between">
                  <div className="flex gap-4 flex-1">
                    {episode.thumbnail_url && (
                      <img
                        src={episode.thumbnail_url}
                        alt={episode.title}
                        className="w-32 h-20 object-cover rounded-lg border border-white/10"
                      />
                    )}
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg flex items-center gap-2">
                        S{episode.season_number}E{episode.episode_number}: {episode.title}
                        {getPendingUploadByEpisode(episode.id) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full border border-yellow-500/30">
                            <Clock className="w-3 h-3" />
                            Upload Pendente
                          </span>
                        )}
                      </h4>
                      <p className="text-sm text-gray-400 mt-1">{episode.description}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        Duração: {Math.round(episode.duration_seconds / 60)} min
                        {(episode.video_url || episode.storage_path || episode.file_storage_key) && (
                          <span className="ml-3">✓ Vídeo carregado</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openVideoUpload(episode)}
                      className="p-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg transition-colors"
                      title="Upload vídeo"
                    >
                      <UploadIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => startEditingEpisode(episode)}
                      className="p-2 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteEpisode(episode.id, episode.title)}
                      className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors"
                      title="Deletar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-dark-700/30 rounded-lg border border-white/10">
          <Film className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <p className="text-gray-400">Nenhum episódio na Temporada {selectedSeason}</p>
          <p className="text-sm text-gray-500 mt-2">Clique em "Adicionar Episódio" para começar</p>
        </div>
      )}

      {/* Add Episode Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-white/10 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Adicionar Episódio</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Temporada</label>
                  <input
                    type="number"
                    value={newEpisode.season_number}
                    onChange={(e) => setNewEpisode({ ...newEpisode, season_number: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary-500"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Número do Episódio</label>
                  <input
                    type="number"
                    value={newEpisode.episode_number}
                    onChange={(e) => setNewEpisode({ ...newEpisode, episode_number: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary-500"
                    min="1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Título *</label>
                <input
                  type="text"
                  value={newEpisode.title}
                  onChange={(e) => setNewEpisode({ ...newEpisode, title: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary-500"
                  placeholder="Nome do episódio"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Descrição</label>
                <textarea
                  value={newEpisode.description}
                  onChange={(e) => setNewEpisode({ ...newEpisode, description: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary-500"
                  placeholder="Descrição do episódio"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Duração (minutos)</label>
                <input
                  type="number"
                  value={newEpisode.duration_minutes}
                  onChange={(e) => setNewEpisode({ ...newEpisode, duration_minutes: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary-500"
                  min="0"
                  placeholder="Duração em minutos"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAddEpisode}
                className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors font-semibold"
              >
                Adicionar
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 bg-dark-600 hover:bg-dark-500 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Upload Modal */}
      {showVideoUpload && selectedEpisodeForUpload && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-white/10 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Upload de Vídeo - {selectedEpisodeForUpload.title}</h3>
              <button
                onClick={() => {
                  setShowVideoUpload(false);
                  setSelectedEpisodeForUpload(null);
                }}
                className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <EpisodeVideoUpload
              ref={videoUploadRef}
              contentId={seriesId}
              episodeId={selectedEpisodeForUpload.id}
              seasonNumber={selectedEpisodeForUpload.season_number}
              episodeNumber={selectedEpisodeForUpload.episode_number}
              onUploadComplete={() => {
                toast.success('Vídeo carregado com sucesso!');
                setShowVideoUpload(false);
                setSelectedEpisodeForUpload(null);
                loadEpisodes();
              }}
            />

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  if (!videoUploadRef.current?.hasFile()) {
                    toast.error('Selecione um arquivo antes de salvar');
                    return;
                  }

                  const saved = videoUploadRef.current?.saveFile();
                  if (saved) {
                    toast.success('Arquivo salvo! Clique em "Salvar Alterações" para iniciar o upload');
                    setShowVideoUpload(false);
                    setSelectedEpisodeForUpload(null);
                    loadEpisodes(); // Reload to show pending indicator
                  }
                }}
                className="flex-1 px-4 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors font-semibold"
              >
                Salvar
              </button>
              <button
                onClick={() => {
                  setShowVideoUpload(false);
                  setSelectedEpisodeForUpload(null);
                }}
                className="px-4 py-3 bg-dark-600 hover:bg-dark-500 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
