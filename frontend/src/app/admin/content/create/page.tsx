'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { SimultaneousVideoUpload, SimultaneousVideoUploadRef } from '@/components/SimultaneousVideoUpload';
import { uploadImageToSupabase } from '@/lib/supabaseStorage';
import { supabase } from '@/lib/supabase';
import { UploadQueue, QueueStats } from '@/lib/uploadQueue';
import { useUpload } from '@/contexts/UploadContext';

interface ContentFormData {
  title: string;
  description: string;
  synopsis: string;
  release_date: string;
  duration_minutes: number;
  genres: string[];
  rating: string;
  director: string;
  cast: string;
  trailer_url: string;
  poster_url: string;
  backdrop_url: string;
  content_type: 'movie' | 'series';
  is_featured: boolean;
  price_cents: number;
}

const AVAILABLE_GENRES = [
  'Ação',
  'Aventura',
  'Animação',
  'Comédia',
  'Crime',
  'Documentário',
  'Drama',
  'Fantasia',
  'Ficção Científica',
  'Guerra',
  'História',
  'Horror',
  'Musical',
  'Mistério',
  'Romance',
  'Suspense',
  'Terror',
  'Thriller',
  'Western'
];

interface FileUploadState {
  posterFile: File | null;
  posterUploading: boolean;
  posterUrl: string;
  backdropFile: File | null;
  backdropUploading: boolean;
  backdropUrl: string;
}

interface Episode {
  id?: string;
  season_number: number;
  episode_number: number;
  title: string;
  description: string;
  duration_minutes: number;
  thumbnail_url?: string;
  video_file?: File;
  thumbnail_file?: File;
  uploading?: boolean;
  uploaded?: boolean;
  uploadProgress?: number;
  error?: string;
}

export default function AdminContentCreatePage() {
  const router = useRouter();
  const videoUploadRef = useRef<SimultaneousVideoUploadRef>(null);
  const { addTask, updateTask } = useUpload(); // Global upload context
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdContentId, setCreatedContentId] = useState<string | null>(null);
  const [showLanguageManager, setShowLanguageManager] = useState(false);
  const [formData, setFormData] = useState<ContentFormData>({
    title: '',
    description: '',
    synopsis: '',
    release_date: '',
    duration_minutes: 0,
    genres: [],
    rating: '',
    director: '',
    cast: '',
    trailer_url: '',
    poster_url: '',
    backdrop_url: '',
    content_type: 'movie',
    is_featured: false,
    price_cents: 1990, // R$ 19.90 default
  });

  const [fileUpload, setFileUpload] = useState<FileUploadState>({
    posterFile: null,
    posterUploading: false,
    posterUrl: '',
    backdropFile: null,
    backdropUploading: false,
    backdropUrl: '',
  });

  // Estado separado para o input de preço (permite digitação livre)
  const [priceInput, setPriceInput] = useState<string>('19.90');

  // Informações de série
  const [seriesInfo, setSeriesInfo] = useState({
    totalSeasons: 1,
    totalEpisodes: 1
  });

  // Estado para gerenciar episódios
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [showEpisodeManager, setShowEpisodeManager] = useState(false);
  const [currentSeason, setCurrentSeason] = useState(1);
  const [editingEpisode, setEditingEpisode] = useState<Episode | null>(null);

  // Upload queue state
  const [uploadQueue] = useState(() => new UploadQueue(2, (stats) => {
    setQueueStats(stats);
  }));
  const [queueStats, setQueueStats] = useState<QueueStats>({
    total: 0,
    completed: 0,
    failed: 0,
    pending: 0,
    active: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar se o pôster foi enviado
    if (!formData.poster_url) {
      alert('Por favor, faça o upload do pôster antes de criar o conteúdo.');
      return;
    }

    // Verificar se ainda há uploads em andamento
    if (fileUpload.posterUploading) {
      alert('Aguarde o upload do pôster ser concluído antes de criar o conteúdo.');
      return;
    }

    // Validar se pelo menos um gênero foi selecionado
    if (formData.genres.length === 0) {
      toast.error('Por favor, selecione pelo menos um gênero.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Transformar dados para o formato esperado pelo backend
      const backendData: any = {
        title: formData.title,
        description: formData.description || undefined,
        synopsis: formData.synopsis || undefined,
        poster_url: formData.poster_url,
        backdrop_url: formData.backdrop_url || undefined,
        trailer_url: formData.trailer_url || undefined,
        content_type: formData.content_type, // Manter content_type
        type: formData.content_type, // Também enviar type para compatibilidade
        availability: 'site', // Padrão
        price_cents: formData.price_cents,
        currency: 'BRL',
        is_featured: formData.is_featured,
        genres: formData.genres.length > 0 ? formData.genres : undefined,
        director: formData.director || undefined,
        cast: formData.cast || undefined,
        release_year: formData.release_date ? new Date(formData.release_date).getFullYear() : undefined, // release_date → release_year
        duration_minutes: formData.duration_minutes || undefined,
        imdb_rating: formData.rating ? parseFloat(formData.rating) : undefined, // rating → imdb_rating
      };

      // Adicionar informações de série se aplicável
      if (formData.content_type === 'series') {
        backendData.total_seasons = seriesInfo.totalSeasons;
        backendData.total_episodes = seriesInfo.totalEpisodes;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/content/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(backendData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao criar conteúdo');
      }

      const data = await response.json();
      toast.success('Conteúdo criado com sucesso!');
      setCreatedContentId(data.id);

      // Para séries, mostrar gerenciador de episódios
      if (formData.content_type === 'series') {
        setShowEpisodeManager(true);
      } else {
        // Para filmes, mostrar gerenciador de vídeos/idiomas
        setShowLanguageManager(true);
      }
    } catch (error: any) {
      console.error('Error creating content:', error);
      toast.error(error.message || 'Erro ao criar conteúdo');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const uploadPosterFile = async (file: File): Promise<string> => {
    const result = await uploadImageToSupabase(file, 'cinevision-capas', 'posters');

    if (result.error) {
      throw new Error(result.error);
    }

    return result.publicUrl;
  };

  const uploadBackdropFile = async (file: File): Promise<string> => {
    const result = await uploadImageToSupabase(file, 'cinevision-capas', 'backdrops');

    if (result.error) {
      throw new Error(result.error);
    }

    return result.publicUrl;
  };

  const handlePosterFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido.');
      return;
    }

    // Validar tamanho (máx 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('O arquivo deve ter no máximo 10MB.');
      return;
    }

    setFileUpload(prev => ({ ...prev, posterFile: file, posterUploading: true }));

    try {
      const posterUrl = await uploadPosterFile(file);
      setFileUpload(prev => ({ ...prev, posterUrl, posterUploading: false }));
      setFormData(prev => ({ ...prev, poster_url: posterUrl }));
    } catch (error) {
      console.error('Erro no upload do pôster:', error);
      alert('Erro no upload do pôster. Tente novamente.');
      setFileUpload(prev => ({ ...prev, posterUploading: false }));
    }
  };

  const handleBackdropFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido.');
      return;
    }

    // Validar tamanho (máx 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('O arquivo deve ter no máximo 10MB.');
      return;
    }

    setFileUpload(prev => ({ ...prev, backdropFile: file, backdropUploading: true }));

    try {
      const backdropUrl = await uploadBackdropFile(file);
      setFileUpload(prev => ({ ...prev, backdropUrl, backdropUploading: false }));
      setFormData(prev => ({ ...prev, backdrop_url: backdropUrl }));
      toast.success('Backdrop enviado com sucesso!');
    } catch (error) {
      console.error('Erro no upload do backdrop:', error);
      alert('Erro no upload do backdrop. Tente novamente.');
      setFileUpload(prev => ({ ...prev, backdropUploading: false }));
    }
  };

  const toggleGenre = (genre: string) => {
    setFormData(prev => ({
      ...prev,
      genres: prev.genres.includes(genre)
        ? prev.genres.filter(g => g !== genre)
        : [...prev.genres, genre]
    }));
  };

  // Episode management functions
  const addEpisode = () => {
    const newEpisode: Episode = {
      season_number: currentSeason,
      episode_number: episodes.filter(ep => ep.season_number === currentSeason).length + 1,
      title: '',
      description: '',
      duration_minutes: 0,
    };
    setEditingEpisode(newEpisode);
  };

  const saveEpisode = (episode: Episode) => {
    if (!episode.title || !episode.description || episode.duration_minutes <= 0) {
      toast.error('Por favor, preencha todos os campos do episódio');
      return;
    }

    setEpisodes(prev => {
      const existing = prev.findIndex(
        ep => ep.season_number === episode.season_number && ep.episode_number === episode.episode_number
      );
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = episode;
        return updated;
      }
      return [...prev, episode];
    });
    setEditingEpisode(null);
    toast.success('Episódio adicionado com sucesso!');
  };

  const deleteEpisode = (season: number, episode: number) => {
    setEpisodes(prev => prev.filter(
      ep => !(ep.season_number === season && ep.episode_number === episode)
    ));
    toast.success('Episódio removido');
  };

  const uploadEpisode = async (episode: Episode) => {
    if (!episode.video_file) {
      toast.error('Por favor, selecione um arquivo de vídeo para o episódio');
      return;
    }

    if (!createdContentId) {
      toast.error('Erro: ID do conteúdo não encontrado');
      return;
    }

    // Create global upload task that persists across page navigation
    const taskId = `episode-${createdContentId}-s${episode.season_number}e${episode.episode_number}-${Date.now()}`;

    console.log('[uploadEpisode] Creating task:', {
      taskId,
      type: 'episode',
      fileName: episode.video_file.name,
      contentTitle: episode.title,
      seasonNumber: episode.season_number,
      episodeNumber: episode.episode_number,
    });

    addTask({
      id: taskId,
      type: 'episode',
      fileName: episode.video_file.name,
      contentTitle: episode.title,
      progress: 0,
      status: 'uploading',
      seasonNumber: episode.season_number,
      episodeNumber: episode.episode_number,
    });

    console.log('[uploadEpisode] Task created successfully');

    try {
      // Marcar como uploading
      setEpisodes(prev => prev.map(ep =>
        ep.season_number === episode.season_number && ep.episode_number === episode.episode_number
          ? { ...ep, uploading: true, error: undefined }
          : ep
      ));

      // 1. Upload thumbnail se houver
      let thumbnailUrl = episode.thumbnail_url;
      if (episode.thumbnail_file) {
        const thumbResult = await uploadImageToSupabase(
          episode.thumbnail_file,
          'cinevision-capas',
          `episodes/s${episode.season_number}e${episode.episode_number}`
        );
        if (thumbResult.error) throw new Error(thumbResult.error);
        thumbnailUrl = thumbResult.publicUrl;
      }

      // 2. Criar episódio no backend
      const episodeData = {
        series_id: createdContentId,
        season_number: episode.season_number,
        episode_number: episode.episode_number,
        title: episode.title,
        description: episode.description,
        duration_minutes: episode.duration_minutes,
        thumbnail_url: thumbnailUrl,
      };

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/content/series/${createdContentId}/episodes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(episodeData),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao criar episódio');
      }

      const createdEpisode = await response.json();
      const episodeId = createdEpisode.data?.id || createdEpisode.id;

      // 3. Upload do vídeo do episódio usando multipart upload S3
      const videoFile = episode.video_file;

      // Get auth token
      const token = localStorage.getItem('access_token') || localStorage.getItem('token');
      if (!token) {
        throw new Error('Token de autenticação não encontrado');
      }

      // Detect content type
      const getContentType = (file: File): string => {
        if (file.type && file.type.startsWith('video/')) {
          return file.type;
        }
        const extension = file.name.split('.').pop()?.toLowerCase();
        switch (extension) {
          case 'mp4': return 'video/mp4';
          case 'mkv': return 'video/x-matroska';
          case 'mov': return 'video/quicktime';
          default: return 'video/mp4';
        }
      };

      const contentType = getContentType(videoFile);

      // 3.1. Initiate multipart upload
      const initResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/uploads/init`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            episodeId: episodeId,
            filename: videoFile.name,
            contentType: contentType,
            size: videoFile.size,
          }),
        }
      );

      if (!initResponse.ok) {
        const errorData = await initResponse.json().catch(() => ({ message: 'Erro ao iniciar upload' }));
        throw new Error(errorData.message || 'Erro ao iniciar upload');
      }

      const { uploadId, key, partSize, partsCount, presignedUrls } = await initResponse.json();
      const uploadedParts: { ETag: string; PartNumber: number }[] = [];

      // 3.2. Upload parts to S3
      for (let i = 0; i < presignedUrls.length; i++) {
        const { partNumber, url: presignedUrl } = presignedUrls[i];
        const start = (partNumber - 1) * partSize;
        const end = Math.min(start + partSize, videoFile.size);
        const chunk = videoFile.slice(start, end);

        const partResponse = await fetch(presignedUrl, {
          method: 'PUT',
          body: chunk,
        });

        if (!partResponse.ok) {
          throw new Error(`Erro ao fazer upload da parte ${partNumber}`);
        }

        const etag = partResponse.headers.get('ETag');
        if (!etag) {
          throw new Error(`ETag não retornado para parte ${partNumber}`);
        }

        uploadedParts.push({ ETag: etag.replace(/"/g, ''), PartNumber: partNumber });

        // Update progress (both local and global)
        const progress = Math.round(((i + 1) / partsCount) * 100);
        setEpisodes(prev => prev.map(ep =>
          ep.season_number === episode.season_number && ep.episode_number === episode.episode_number
            ? { ...ep, uploadProgress: progress }
            : ep
        ));

        // Update global task progress
        updateTask(taskId, { progress });
      }

      // 3.3. Complete multipart upload
      const completeResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/uploads/complete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            uploadId,
            key,
            parts: uploadedParts,
            episodeId: episodeId,
          }),
        }
      );

      if (!completeResponse.ok) {
        const errorData = await completeResponse.json().catch(() => ({ message: 'Erro ao finalizar upload' }));
        throw new Error(errorData.message || 'Erro ao finalizar upload');
      }

      setEpisodes(prev => prev.map(ep =>
        ep.season_number === episode.season_number && ep.episode_number === episode.episode_number
          ? { ...ep, id: episodeId, uploading: false, uploaded: true }
          : ep
      ));

      // Mark global task as completed
      updateTask(taskId, { status: 'completed', progress: 100 });

      toast.success(`Episódio S${episode.season_number}E${episode.episode_number} enviado com sucesso!`);
    } catch (error: any) {
      console.error('Error uploading episode:', error);
      setEpisodes(prev => prev.map(ep =>
        ep.season_number === episode.season_number && ep.episode_number === episode.episode_number
          ? { ...ep, uploading: false, error: error.message }
          : ep
      ));

      // Mark global task as error
      updateTask(taskId, { status: 'error', error: error.message });

      toast.error(error.message || 'Erro ao fazer upload do episódio');
    }
  };

  /**
   * Upload all episodes that have video files but haven't been uploaded yet
   */
  const uploadAllEpisodes = async () => {
    const episodesToUpload = episodes.filter(ep => ep.video_file && !ep.uploaded && !ep.uploading);

    if (episodesToUpload.length === 0) {
      toast.error('Nenhum episódio disponível para upload');
      return;
    }

    toast.success(`Iniciando upload de ${episodesToUpload.length} episódio(s) em fila...`);

    // Add all episodes to the upload queue
    const queueItems = episodesToUpload.map(episode => ({
      id: `${episode.season_number}-${episode.episode_number}`,
      execute: () => uploadEpisode(episode),
      priority: episode.season_number * 1000 + episode.episode_number, // Upload in order
    }));

    uploadQueue.addBatch(queueItems);

    // Wait for completion
    await uploadQueue.waitForCompletion();

    const stats = uploadQueue.getStats();
    if (stats.failed > 0) {
      toast.error(`${stats.completed} episódio(s) enviado(s), ${stats.failed} falharam`);
    } else {
      toast.success(`Todos os ${stats.completed} episódio(s) foram enviados com sucesso!`);
    }
  };

  const finalizeSeries = async () => {
    if (episodes.length === 0) {
      toast.error('Por favor, adicione pelo menos um episódio antes de finalizar');
      return;
    }

    // Verificar se todos os episódios têm arquivos de vídeo selecionados
    const episodesWithoutFiles = episodes.filter(ep => !ep.video_file);
    if (episodesWithoutFiles.length > 0) {
      toast.error(`${episodesWithoutFiles.length} episódio(s) não possuem arquivo de vídeo selecionado`);
      return;
    }

    // Iniciar upload de todos os episódios que ainda não foram enviados
    const episodesToUpload = episodes.filter(ep => ep.video_file && !ep.uploaded && !ep.uploading);

    if (episodesToUpload.length > 0) {
      toast.success(`Iniciando upload de ${episodesToUpload.length} episódio(s)...`);

      // Add all episodes to the upload queue
      const queueItems = episodesToUpload.map(episode => ({
        id: `${episode.season_number}-${episode.episode_number}`,
        execute: () => uploadEpisode(episode),
        priority: episode.season_number * 1000 + episode.episode_number,
      }));

      uploadQueue.addBatch(queueItems);

      // Upload acontece em background - publicação será automática após conclusão
      uploadQueue.waitForCompletion().then(async () => {
        const stats = uploadQueue.getStats();

        if (stats.failed > 0) {
          toast.error(`${stats.completed} episódio(s) enviado(s), ${stats.failed} falharam. Publicação cancelada.`);
          return;
        }

        // Todos os uploads completaram - publicar automaticamente
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/content/${createdContentId}/publish`,
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
            }
          );

          if (!response.ok) {
            throw new Error('Erro ao publicar série');
          }

          toast.success('✅ Série publicada e usuários notificados!');
        } catch (error: any) {
          console.error('Error publishing series:', error);
          toast.error('Erro ao publicar série: ' + error.message);
        }
      });

      toast.success('Upload iniciado! A série será publicada automaticamente quando todos os uploads terminarem.');
      router.push('/admin');
      return;
    }

    // Se todos já foram enviados, apenas publicar
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/content/${createdContentId}/publish`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao publicar série');
      }

      toast.success('✅ Série publicada com sucesso!');
      router.push('/admin');
    } catch (error: any) {
      console.error('Error finalizing series:', error);
      toast.error(error.message || 'Erro ao finalizar série');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header with gradient */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/admin')}
            className="mb-6 px-4 py-2 bg-gradient-to-r from-gray-800/80 to-gray-900/80 backdrop-blur-xl border border-gray-700/50 hover:border-gray-600 rounded-lg transition-all duration-300 hover:scale-105 flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Voltar ao Dashboard</span>
          </button>

          <div className="relative">
            <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-red-500 via-red-600 to-red-700 bg-clip-text text-transparent">
              Criar Novo Conteúdo
            </h1>
            <p className="text-xl text-gray-400">Adicione um novo filme ou série ao catálogo com uploads simultâneos</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <div className="relative bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-700/50 hover:border-gray-600 transition-all duration-300 overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

            <div className="relative z-10 space-y-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-3 rounded-xl bg-gradient-to-br from-red-500 to-red-600 shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white">Informações Básicas</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Tipo de Conteúdo *</label>
                  <select
                    name="content_type"
                    value={formData.content_type}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                    required
                  >
                    <option value="movie">🎬 Filme</option>
                    <option value="series">📺 Série</option>
                  </select>
                </div>

                {/* Informações de Série - Condicional */}
                {formData.content_type === 'series' && (
                  <div className="md:col-span-2 p-4 bg-blue-900/10 border border-blue-500/20 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                      <span className="mr-2">📺</span>
                      Informações da Série
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Número de Temporadas *
                        </label>
                        <input
                          type="number"
                          value={seriesInfo.totalSeasons}
                          onChange={(e) => setSeriesInfo({...seriesInfo, totalSeasons: parseInt(e.target.value) || 1})}
                          min="1"
                          max="50"
                          className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required={formData.content_type === 'series'}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Episódios por Temporada *
                        </label>
                        <input
                          type="number"
                          value={seriesInfo.totalEpisodes}
                          onChange={(e) => setSeriesInfo({...seriesInfo, totalEpisodes: parseInt(e.target.value) || 1})}
                          min="1"
                          max="100"
                          className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required={formData.content_type === 'series'}
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex items-start space-x-2 text-sm text-gray-400">
                      <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p>
                        Após criar a série, você poderá fazer upload dos episódios individualmente através do gerenciador de vídeos.
                        Cada episódio será vinculado à temporada correspondente.
                      </p>
                    </div>
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Título *</label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="Ex: A Hora do Mal"
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Descrição Curta *</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Uma breve descrição do conteúdo..."
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Sinopse Completa</label>
                <textarea
                  name="synopsis"
                  value={formData.synopsis}
                  onChange={handleChange}
                  rows={5}
                  placeholder="A sinopse completa do filme ou série..."
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Media Information */}
          <div className="relative bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-700/50 hover:border-gray-600 transition-all duration-300 overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

            <div className="relative z-10 space-y-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white">Detalhes do Conteúdo</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Data de Lançamento *</label>
                  <input
                    type="date"
                    name="release_date"
                    value={formData.release_date}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Duração (minutos) *</label>
                  <input
                    type="number"
                    name="duration_minutes"
                    value={formData.duration_minutes}
                    onChange={handleChange}
                    min="1"
                    placeholder="120"
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    required
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Gêneros *
                    <span className="text-xs text-gray-500 ml-2">
                      (Selecione um ou mais gêneros)
                    </span>
                  </label>

                  {/* Selected Genres Display */}
                  {formData.genres.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3 p-3 bg-blue-900/10 border border-blue-500/20 rounded-xl">
                      {formData.genres.map((genre) => (
                        <span
                          key={genre}
                          className="inline-flex items-center space-x-2 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-medium rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200"
                        >
                          <span>{genre}</span>
                          <button
                            type="button"
                            onClick={() => toggleGenre(genre)}
                            className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                            title={`Remover ${genre}`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Genre Selection Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-4 bg-gray-900/50 border border-gray-600/50 rounded-xl max-h-64 overflow-y-auto">
                    {AVAILABLE_GENRES.map((genre) => {
                      const isSelected = formData.genres.includes(genre);
                      return (
                        <button
                          key={genre}
                          type="button"
                          onClick={() => toggleGenre(genre)}
                          className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                            isSelected
                              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg scale-105'
                              : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/70 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center justify-between space-x-2">
                            <span>{genre}</span>
                            {isSelected && (
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Validation Message */}
                  {formData.genres.length === 0 && (
                    <p className="mt-2 text-xs text-gray-400 flex items-center space-x-1">
                      <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>Selecione pelo menos um gênero</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Classificação</label>
                  <input
                    type="text"
                    name="rating"
                    value={formData.rating}
                    onChange={handleChange}
                    placeholder="Livre, 12, 14, 16, 18"
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Diretor</label>
                  <input
                    type="text"
                    name="director"
                    value={formData.director}
                    onChange={handleChange}
                    placeholder="Nome do diretor"
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Elenco</label>
                  <input
                    type="text"
                    name="cast"
                    value={formData.cast}
                    onChange={handleChange}
                    placeholder="Separado por vírgulas"
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* URLs and Media */}
          <div className="relative bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-700/50 hover:border-gray-600 transition-all duration-300 overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

            <div className="relative z-10 space-y-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white">Mídia e Imagens</h2>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">URL do Trailer (YouTube)</label>
                <input
                  type="url"
                  name="trailer_url"
                  value={formData.trailer_url}
                  onChange={handleChange}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Poster Upload */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Pôster do Filme * <span className="text-xs text-gray-500">(Vertical)</span></label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePosterFileChange}
                      className="w-full px-4 py-3 bg-gray-900/50 border-2 border-dashed border-gray-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-purple-600 file:to-purple-700 file:text-white hover:file:from-purple-700 hover:file:to-purple-800 cursor-pointer"
                      disabled={fileUpload.posterUploading}
                    />
                  </div>
                  {fileUpload.posterUploading && (
                    <div className="flex items-center space-x-2 text-purple-400 bg-purple-900/20 px-4 py-2 rounded-lg">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400"></div>
                      <span className="text-sm">Fazendo upload...</span>
                    </div>
                  )}
                  {fileUpload.posterUrl && (
                    <div className="flex items-center space-x-2 text-green-400 bg-green-900/20 px-4 py-2 rounded-lg">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm font-medium">Pôster enviado com sucesso!</span>
                    </div>
                  )}
                  {fileUpload.posterFile && (
                    <div className="text-xs text-gray-400 bg-gray-900/30 px-3 py-2 rounded-lg">
                      📄 {fileUpload.posterFile.name} ({(fileUpload.posterFile.size / 1024 / 1024).toFixed(2)} MB)
                    </div>
                  )}
                </div>

                {/* Backdrop Upload */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Backdrop (Opcional) <span className="text-xs text-gray-500">(Horizontal)</span></label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleBackdropFileChange}
                      className="w-full px-4 py-3 bg-gray-900/50 border-2 border-dashed border-gray-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-purple-600 file:to-purple-700 file:text-white hover:file:from-purple-700 hover:file:to-purple-800 cursor-pointer"
                      disabled={fileUpload.backdropUploading}
                    />
                  </div>
                  {fileUpload.backdropUploading && (
                    <div className="flex items-center space-x-2 text-purple-400 bg-purple-900/20 px-4 py-2 rounded-lg">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400"></div>
                      <span className="text-sm">Fazendo upload...</span>
                    </div>
                  )}
                  {fileUpload.backdropUrl && (
                    <div className="flex items-center space-x-2 text-green-400 bg-green-900/20 px-4 py-2 rounded-lg">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm font-medium">Backdrop enviado com sucesso!</span>
                    </div>
                  )}
                  {fileUpload.backdropFile && (
                    <div className="text-xs text-gray-400 bg-gray-900/30 px-3 py-2 rounded-lg">
                      📄 {fileUpload.backdropFile.name} ({(fileUpload.backdropFile.size / 1024 / 1024).toFixed(2)} MB)
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Pricing and Options */}
          <div className="relative bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-700/50 hover:border-gray-600 transition-all duration-300 overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

            <div className="relative z-10 space-y-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-green-600 shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white">Preço e Opções</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Preço (R$) *</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-green-400 font-bold text-lg">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      name="price_reais"
                      value={priceInput}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^\d.,]/g, '').replace(',', '.');
                        setPriceInput(value);

                        const reaisValue = parseFloat(value) || 0;
                        const centsValue = Math.round(reaisValue * 100);
                        setFormData(prev => ({ ...prev, price_cents: centsValue }));
                      }}
                      onBlur={() => {
                        // Formata ao perder o foco
                        const reaisValue = parseFloat(priceInput.replace(',', '.')) || 0;
                        setPriceInput(reaisValue.toFixed(2));
                      }}
                      placeholder="7.10"
                      className="w-full pl-14 pr-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                      required
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Valor em centavos: {formData.price_cents}</p>
                </div>

                <div className="flex items-center justify-center">
                  <label className="relative inline-flex items-center cursor-pointer group">
                    <input
                      type="checkbox"
                      name="is_featured"
                      checked={formData.is_featured}
                      onChange={handleChange}
                      className="sr-only peer"
                    />
                    <div className="w-14 h-7 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-red-600 peer-checked:to-red-700"></div>
                    <span className="ms-3 text-sm font-medium text-gray-300">⭐ Destacar na página inicial</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={() => router.push('/admin')}
              className="px-8 py-4 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 rounded-xl transition-all duration-300 hover:scale-105 flex items-center space-x-2 border border-gray-600/50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="font-medium">Cancelar</span>
            </button>
            <button
              type="submit"
              disabled={isSubmitting || fileUpload.posterUploading}
              className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 hover:scale-105 disabled:hover:scale-100 shadow-lg hover:shadow-red-900/50 flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Criando Conteúdo...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Criar Conteúdo e Adicionar Vídeos</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Video Upload Section - shown after content creation */}
        {showLanguageManager && createdContentId && (
          <div className="mt-8 space-y-6">
            {/* Success Banner */}
            <div className="relative bg-gradient-to-br from-green-900/50 via-green-800/30 to-gray-900/50 backdrop-blur-xl rounded-2xl p-8 border-2 border-green-500/50 shadow-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent"></div>

              <div className="relative z-10 flex items-start space-x-6">
                <div className="flex-shrink-0">
                  <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                    <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>

                <div className="flex-1">
                  <h2 className="text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent mb-2">
                    ✅ Conteúdo Criado com Sucesso!
                  </h2>
                  <p className="text-xl text-gray-300 mb-4">
                    Agora adicione os vídeos nas versões <strong className="text-blue-400">Dublado</strong> e <strong className="text-purple-400">Legendado</strong>
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    <div className="flex items-center space-x-3 bg-blue-900/20 px-4 py-3 rounded-xl border border-blue-500/30">
                      <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-400">Formatos</p>
                        <p className="text-sm font-semibold text-white">.mkv, .mp4</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 bg-purple-900/20 px-4 py-3 rounded-xl border border-purple-500/30">
                      <svg className="w-5 h-5 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-400">Tamanho Máx</p>
                        <p className="text-sm font-semibold text-white">5GB por arquivo</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 bg-green-900/20 px-4 py-3 rounded-xl border border-green-500/30">
                      <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-400">Upload</p>
                        <p className="text-sm font-semibold text-white">Simultâneo</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Simultaneous Video Upload Component */}
            <SimultaneousVideoUpload
              ref={videoUploadRef}
              contentId={createdContentId}
              onUploadComplete={() => {
                toast.success('Vídeos enviados com sucesso!');
              }}
            />

            {/* Action Buttons */}
            <div className="flex flex-col gap-4">
              <div className="flex gap-4">
                <button
                  onClick={async () => {
                    console.log('[Finalizar Button] Clicked');
                    console.log('[Finalizar Button] videoUploadRef.current:', videoUploadRef.current);
                    console.log('[Finalizar Button] hasFiles():', videoUploadRef.current?.hasFiles());

                    // Publicar conteúdo e notificar usuários
                    const publishContent = async () => {
                      try {
                        const token = localStorage.getItem('token');
                        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/content/${createdContentId}/publish`, {
                          method: 'PUT',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                          },
                        });

                        if (!response.ok) {
                          console.error('Erro ao publicar conteúdo');
                          toast.error('Erro ao publicar conteúdo.');
                        } else {
                          console.log('✅ Conteúdo publicado e notificações enviadas');
                          toast.success('✅ Conteúdo publicado e usuários notificados!');
                        }
                      } catch (error) {
                        console.error('Error publishing content:', error);
                        toast.error('Erro ao publicar conteúdo.');
                      }
                    };

                    // Se não há arquivos de vídeo selecionados, apenas publica e redireciona
                    if (!videoUploadRef.current?.hasFiles()) {
                      console.log('[Finalizar Button] Nenhum arquivo selecionado, publicando...');
                      await publishContent();
                      router.push('/admin');
                      return;
                    }

                    console.log('[Finalizar Button] Iniciando upload...');
                    // Iniciar upload em background (não aguarda a conclusão, apenas inicia)
                    videoUploadRef.current.startUpload().catch((error) => {
                      console.error('[Finalizar Button] Upload error:', error);
                      toast.error('Erro ao iniciar upload. Verifique os arquivos.');
                    });

                    // Pequeno delay para garantir que o upload foi iniciado
                    await new Promise(resolve => setTimeout(resolve, 500));

                    // NÃO publicar agora - será publicado automaticamente quando uploads estiverem 100%
                    toast.success('Upload iniciado! O conteúdo será publicado automaticamente quando todos os uploads terminarem.');

                    // Redirecionar para /admin
                    console.log('[Finalizar Button] Redirecionando para /admin');
                    router.push('/admin');
                  }}
                  className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-green-900/50 flex items-center justify-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Finalizar</span>
                </button>

                <button
                  onClick={() => {
                    if (confirm('Deseja criar outro conteúdo? Os vídeos do conteúdo atual já foram salvos.')) {
                      setCreatedContentId(null);
                      setShowLanguageManager(false);
                      setFormData({
                        title: '',
                        description: '',
                        synopsis: '',
                        release_date: '',
                        duration_minutes: 0,
                        genres: [],
                        rating: '',
                        director: '',
                        cast: '',
                        trailer_url: '',
                        poster_url: '',
                        backdrop_url: '',
                        content_type: 'movie',
                        is_featured: false,
                        price_cents: 1990,
                      });
                      setPriceInput('19.90');
                      setFileUpload({
                        posterFile: null,
                        posterUploading: false,
                        posterUrl: '',
                        backdropFile: null,
                        backdropUploading: false,
                        backdropUrl: '',
                      });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-blue-900/50 flex items-center justify-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Criar Outro Conteúdo</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Episode Manager - shown after series creation */}
        {showEpisodeManager && createdContentId && (
          <div className="mt-8 space-y-6">
            {/* Success Banner for Series */}
            <div className="relative bg-gradient-to-br from-green-900/50 via-green-800/30 to-gray-900/50 backdrop-blur-xl rounded-2xl p-8 border-2 border-green-500/50 shadow-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent"></div>

              <div className="relative z-10">
                <div className="flex items-start space-x-6 mb-6">
                  <div className="flex-shrink-0">
                    <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                      <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>

                  <div className="flex-1">
                    <h2 className="text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent mb-2">
                      ✅ Série Criada com Sucesso!
                    </h2>
                    <p className="text-xl text-gray-300 mb-4">
                      Agora adicione os episódios da sua série. Você pode adicionar episódios para cada temporada.
                    </p>
                  </div>
                </div>

                {/* Season Selector */}
                <div className="flex items-center space-x-4 mb-6">
                  <label className="text-white font-semibold">Temporada:</label>
                  <select
                    value={currentSeason}
                    onChange={(e) => setCurrentSeason(parseInt(e.target.value))}
                    className="px-4 py-2 bg-gray-900/50 border border-gray-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Array.from({ length: seriesInfo.totalSeasons }, (_, i) => i + 1).map(season => (
                      <option key={season} value={season}>Temporada {season}</option>
                    ))}
                  </select>

                  <button
                    onClick={addEpisode}
                    className="ml-auto px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl font-semibold flex items-center space-x-2 transition-all duration-300 hover:scale-105"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Adicionar Episódio</span>
                  </button>
                </div>

                {/* Queue Statistics */}
                {(queueStats.total > 0) && (
                  <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-white font-semibold flex items-center space-x-2">
                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>Status do Upload em Fila</span>
                      </h4>
                      <div className="text-sm text-gray-400">
                        {queueStats.active > 0 ? (
                          <span className="text-blue-400 animate-pulse">⚡ {queueStats.active} em progresso</span>
                        ) : queueStats.pending > 0 ? (
                          <span className="text-yellow-400">⏳ {queueStats.pending} aguardando</span>
                        ) : (
                          <span className="text-green-400">✓ Concluído</span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-white">{queueStats.total}</div>
                        <div className="text-xs text-gray-400">Total</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-400">{queueStats.completed}</div>
                        <div className="text-xs text-gray-400">Concluídos</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blue-400">{queueStats.active}</div>
                        <div className="text-xs text-gray-400">Em Progresso</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-yellow-400">{queueStats.pending}</div>
                        <div className="text-xs text-gray-400">Na Fila</div>
                      </div>
                    </div>
                    {queueStats.failed > 0 && (
                      <div className="mt-3 p-2 bg-red-900/30 border border-red-500/50 rounded text-red-400 text-sm">
                        ⚠️ {queueStats.failed} episódio(s) falharam
                      </div>
                    )}
                  </div>
                )}

                {/* Episodes List for Current Season */}
                <div className="space-y-4">
                  {episodes
                    .filter(ep => ep.season_number === currentSeason)
                    .sort((a, b) => a.episode_number - b.episode_number)
                    .map((episode) => (
                      <div
                        key={`s${episode.season_number}e${episode.episode_number}`}
                        className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-6 space-y-4"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-white mb-2">
                              S{episode.season_number}E{episode.episode_number}: {episode.title}
                            </h3>
                            <p className="text-gray-400 text-sm mb-2">{episode.description}</p>
                            <p className="text-gray-500 text-xs">Duração: {episode.duration_minutes} minutos</p>
                          </div>

                          <div className="flex items-center space-x-2">
                            {episode.uploaded ? (
                              <span className="px-3 py-1 bg-green-900/30 border border-green-500/50 text-green-400 text-sm rounded-lg flex items-center space-x-1">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span>Enviado</span>
                              </span>
                            ) : episode.uploading ? (
                              <div className="flex items-center space-x-2">
                                <span className="px-3 py-1 bg-blue-900/30 border border-blue-500/50 text-blue-400 text-sm rounded-lg flex items-center space-x-2">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                                  <span>Enviando {episode.uploadProgress || 0}%</span>
                                </span>
                              </div>
                            ) : episode.video_file ? (
                              <span className="px-3 py-1 bg-purple-900/30 border border-purple-500/50 text-purple-400 text-sm rounded-lg flex items-center space-x-1">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                </svg>
                                <span>Pronto</span>
                              </span>
                            ) : (
                              <label className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg cursor-pointer transition-colors">
                                Selecionar Vídeo
                                <input
                                  type="file"
                                  accept="video/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      setEpisodes(prev => prev.map(ep =>
                                        ep.season_number === episode.season_number && ep.episode_number === episode.episode_number
                                          ? { ...ep, video_file: file }
                                          : ep
                                      ));
                                    }
                                  }}
                                />
                              </label>
                            )}

                            <button
                              onClick={() => setEditingEpisode(episode)}
                              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                              title="Editar"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>

                            <button
                              onClick={() => deleteEpisode(episode.season_number, episode.episode_number)}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                              title="Remover"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {episode.error && (
                          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
                            Erro: {episode.error}
                          </div>
                        )}

                        {episode.video_file && !episode.uploaded && (
                          <div className="text-xs text-gray-400 bg-gray-900/30 px-3 py-2 rounded-lg">
                            📹 {episode.video_file.name} ({(episode.video_file.size / 1024 / 1024).toFixed(2)} MB)
                          </div>
                        )}
                      </div>
                    ))}

                  {episodes.filter(ep => ep.season_number === currentSeason).length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                      <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                      </svg>
                      <p className="text-lg">Nenhum episódio adicionado para a Temporada {currentSeason}</p>
                      <p className="text-sm mt-2">Clique em "Adicionar Episódio" para começar</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Episode Form Modal */}
            {editingEpisode && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 max-w-2xl w-full border border-gray-700 shadow-2xl">
                  <h3 className="text-2xl font-bold text-white mb-6">
                    {editingEpisode.id ? 'Editar' : 'Adicionar'} Episódio S{editingEpisode.season_number}E{editingEpisode.episode_number}
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Título do Episódio *</label>
                      <input
                        type="text"
                        value={editingEpisode.title}
                        onChange={(e) => setEditingEpisode({ ...editingEpisode, title: e.target.value })}
                        placeholder="Ex: O Início"
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Descrição *</label>
                      <textarea
                        value={editingEpisode.description}
                        onChange={(e) => setEditingEpisode({ ...editingEpisode, description: e.target.value })}
                        rows={3}
                        placeholder="Descrição do episódio..."
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Duração (minutos) *</label>
                      <input
                        type="number"
                        value={editingEpisode.duration_minutes || ''}
                        onChange={(e) => setEditingEpisode({ ...editingEpisode, duration_minutes: parseInt(e.target.value) || 0 })}
                        min="1"
                        placeholder="45"
                        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Thumbnail (Opcional)</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setEditingEpisode({ ...editingEpisode, thumbnail_file: file });
                          }
                        }}
                        className="w-full px-4 py-3 bg-gray-900/50 border-2 border-dashed border-gray-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="flex gap-4 mt-8">
                    <button
                      onClick={() => setEditingEpisode(null)}
                      className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-semibold transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => saveEpisode(editingEpisode)}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl font-semibold transition-all duration-300 hover:scale-105"
                    >
                      Salvar Episódio
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Finalize Button */}
            <div className="flex gap-4">
              <button
                onClick={finalizeSeries}
                className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-green-900/50 flex items-center justify-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Finalizar e Publicar Série ({episodes.length} episódios)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
