'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { ContentLanguageManager } from '@/components/ContentLanguageManager';
import { EpisodeManager } from '@/components/EpisodeManager';
import { uploadImageToSupabase } from '@/lib/supabaseStorage';
import { useUpload } from '@/contexts/UploadContext';
import { Film, Upload, Save, X, Image as ImageIcon } from 'lucide-react';

interface Content {
  id: string;
  title: string;
  description: string;
  synopsis: string;
  release_date: string;
  duration_minutes: number;
  genres: string | string[];
  rating: string;
  director: string;
  cast: string | string[];
  trailer_url: string;
  telegram_group_link: string;
  poster_url: string;
  backdrop_url: string;
  content_type: 'movie' | 'series';
  is_featured: boolean;
  price_cents: number;
  imdb_rating?: number;
  release_year?: number;
  total_seasons?: number;
  total_episodes?: number;
  created_at: string;
  updated_at: string;
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

export default function AdminContentEditPage() {
  const router = useRouter();
  const params = useParams();
  const contentId = params?.id as string;
  const { pendingUploads } = useUpload();

  const posterInputRef = useRef<HTMLInputElement>(null);
  const backdropInputRef = useRef<HTMLInputElement>(null);

  const [content, setContent] = useState<Content | null>(null);
  const [originalContent, setOriginalContent] = useState<Content | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'languages' | 'episodes'>('details');

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [rating, setRating] = useState('');
  const [director, setDirector] = useState('');
  const [cast, setCast] = useState('');
  const [trailerUrl, setTrailerUrl] = useState('');
  const [telegramGroupLink, setTelegramGroupLink] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [priceInput, setPriceInput] = useState('');
  const [imdbRating, setImdbRating] = useState('');
  const [releaseYear, setReleaseYear] = useState('');

  // Image uploads
  const [posterUrl, setPosterUrl] = useState('');
  const [backdropUrl, setBackdropUrl] = useState('');
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [backdropFile, setBackdropFile] = useState<File | null>(null);
  const [posterUploading, setPosterUploading] = useState(false);
  const [backdropUploading, setBackdropUploading] = useState(false);

  useEffect(() => {
    if (contentId) {
      loadContent();
    }
  }, [contentId]);

  const loadContent = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/content/${contentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setContent(data);
        setOriginalContent(data);

        // Populate form fields
        setTitle(data.title || '');
        setDescription(data.description || '');
        setSynopsis(data.synopsis || '');
        setReleaseDate(data.release_date ? data.release_date.split('T')[0] : '');
        setDurationMinutes(data.duration_minutes || 0);

        // Handle genres as string or array
        if (data.genres) {
          const genresArray = Array.isArray(data.genres)
            ? data.genres
            : data.genres.split(',').map((g: string) => g.trim());
          setSelectedGenres(genresArray);
        }

        setRating(data.rating || '');
        setDirector(data.director || '');

        // Handle cast as string or array
        const castStr = Array.isArray(data.cast)
          ? data.cast.join(', ')
          : data.cast || '';
        setCast(castStr);

        setTrailerUrl(data.trailer_url || '');
        setTelegramGroupLink(data.telegram_group_link || '');
        setIsFeatured(data.is_featured || false);
        setPriceInput((data.price_cents / 100).toFixed(2));
        setImdbRating(data.imdb_rating?.toString() || '');
        setReleaseYear(data.release_year?.toString() || '');
        setPosterUrl(data.poster_url || '');
        setBackdropUrl(data.backdrop_url || '');
      } else {
        toast.error('Erro ao carregar conteúdo');
        router.push('/admin/content/manage');
      }
    } catch (error) {
      console.error('Erro ao carregar conteúdo:', error);
      toast.error('Erro ao carregar conteúdo');
      router.push('/admin/content/manage');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePosterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setPosterUploading(true);
      setPosterFile(file);

      const url = await uploadImageToSupabase(file, 'posters');
      setPosterUrl(url);
      toast.success('Pôster enviado com sucesso!');
    } catch (error) {
      console.error('Erro ao fazer upload do pôster:', error);
      toast.error('Erro ao fazer upload do pôster');
      setPosterFile(null);
    } finally {
      setPosterUploading(false);
    }
  };

  const handleBackdropUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setBackdropUploading(true);
      setBackdropFile(file);

      const url = await uploadImageToSupabase(file, 'backdrops');
      setBackdropUrl(url);
      toast.success('Backdrop enviado com sucesso!');
    } catch (error) {
      console.error('Erro ao fazer upload do backdrop:', error);
      toast.error('Erro ao fazer upload do backdrop');
      setBackdropFile(null);
    } finally {
      setBackdropUploading(false);
    }
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('O título é obrigatório');
      return;
    }

    if (selectedGenres.length === 0) {
      toast.error('Selecione pelo menos um gênero');
      return;
    }

    try {
      setIsSaving(true);

      const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');

      const updateData = {
        title: title.trim(),
        description: description.trim(),
        synopsis: synopsis.trim(),
        release_date: releaseDate,
        duration_minutes: Number(durationMinutes),
        genres: selectedGenres.join(', '),
        rating: rating.trim(),
        director: director.trim(),
        cast: cast.trim(),
        trailer_url: trailerUrl.trim(),
        telegram_group_link: telegramGroupLink.trim(),
        poster_url: posterUrl,
        backdrop_url: backdropUrl,
        is_featured: isFeatured,
        price_cents: Math.round(parseFloat(priceInput) * 100),
        imdb_rating: imdbRating ? parseFloat(imdbRating) : undefined,
        release_year: releaseYear ? parseInt(releaseYear) : undefined,
      };

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/content/${contentId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(updateData),
        }
      );

      if (response.ok) {
        toast.success('Conteúdo atualizado com sucesso!');

        // Check if there are pending uploads
        const contentPendingUploads = pendingUploads.filter(u => u.contentId === contentId);

        if (contentPendingUploads.length > 0) {
          // Redirect to manage page to start uploads
          toast.success(`${contentPendingUploads.length} upload(s) pendente(s). Iniciando uploads...`);
          router.push('/admin/content/manage');
        } else {
          // No pending uploads, just reload
          await loadContent();
        }
      } else {
        const error = await response.json();
        toast.error(`Erro ao atualizar: ${error.message || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao atualizar conteúdo:', error);
      toast.error('Erro ao atualizar conteúdo');
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = () => {
    if (!originalContent) return false;

    // Compare arrays
    const originalGenres = originalContent.genres
      ? (Array.isArray(originalContent.genres) ? originalContent.genres : originalContent.genres.split(',').map((g: string) => g.trim()))
      : [];
    const genresChanged = JSON.stringify(selectedGenres.sort()) !== JSON.stringify(originalGenres.sort());

    return (
      title !== (originalContent.title || '') ||
      description !== (originalContent.description || '') ||
      synopsis !== (originalContent.synopsis || '') ||
      releaseDate !== (originalContent.release_date ? originalContent.release_date.split('T')[0] : '') ||
      durationMinutes !== (originalContent.duration_minutes || 0) ||
      genresChanged ||
      rating !== (originalContent.rating || '') ||
      director !== (originalContent.director || '') ||
      cast !== (Array.isArray(originalContent.cast) ? originalContent.cast.join(', ') : (originalContent.cast || '')) ||
      trailerUrl !== (originalContent.trailer_url || '') ||
      telegramGroupLink !== (originalContent.telegram_group_link || '') ||
      posterUrl !== (originalContent.poster_url || '') ||
      backdropUrl !== (originalContent.backdrop_url || '') ||
      isFeatured !== (originalContent.is_featured || false) ||
      priceInput !== ((originalContent.price_cents / 100).toFixed(2)) ||
      imdbRating !== (originalContent.imdb_rating?.toString() || '') ||
      releaseYear !== (originalContent.release_year?.toString() || '')
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Carregando conteúdo...</p>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-white">Conteúdo não encontrado</h1>
          <button
            onClick={() => router.push('/admin/content/manage')}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
          >
            Voltar para Gerenciar Conteúdos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/admin/content/manage')}
                className="p-2 bg-dark-800/50 hover:bg-dark-700 rounded-lg transition-colors border border-white/10"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
                  Editar Conteúdo
                </h1>
                <p className="text-gray-400 mt-1">{content.title}</p>
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={isSaving || !hasChanges()}
              className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors font-semibold"
            >
              {isSaving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Salvar Alterações
                </>
              )}
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setActiveTab('details')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'details'
                  ? 'text-primary-400 border-b-2 border-primary-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4" />
                Detalhes do Conteúdo
              </div>
            </button>
            {content.content_type === 'movie' && (
              <button
                onClick={() => setActiveTab('languages')}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === 'languages'
                    ? 'text-primary-400 border-b-2 border-primary-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Idiomas e Vídeos
                </div>
              </button>
            )}
            {content.content_type === 'series' && (
              <button
                onClick={() => setActiveTab('episodes')}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === 'episodes'
                    ? 'text-primary-400 border-b-2 border-primary-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4" />
                  Episódios
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          {activeTab === 'details' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-6">Informações Básicas</h2>

              {/* Basic Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Título *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
                    placeholder="Digite o título"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Tipo</label>
                  <div className="px-4 py-2 bg-dark-900/50 border border-white/10 rounded-lg text-gray-400">
                    {content.content_type === 'movie' ? 'Filme' : 'Série'} (não editável)
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Diretor</label>
                  <input
                    type="text"
                    value={director}
                    onChange={(e) => setDirector(e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
                    placeholder="Nome do diretor"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Classificação</label>
                  <select
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary-500"
                  >
                    <option value="">Selecione...</option>
                    <option value="L">L - Livre</option>
                    <option value="10">10 anos</option>
                    <option value="12">12 anos</option>
                    <option value="14">14 anos</option>
                    <option value="16">16 anos</option>
                    <option value="18">18 anos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Duração (minutos)</label>
                  <input
                    type="number"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 bg-dark-700 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary-500"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Preço (R$)</label>
                  <input
                    type="text"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary-500"
                    placeholder="19.90"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Data de Lançamento</label>
                  <input
                    type="date"
                    value={releaseDate}
                    onChange={(e) => setReleaseDate(e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Ano de Lançamento</label>
                  <input
                    type="number"
                    value={releaseYear}
                    onChange={(e) => setReleaseYear(e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary-500"
                    placeholder="2024"
                    min="1900"
                    max="2100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Nota IMDb</label>
                  <input
                    type="number"
                    value={imdbRating}
                    onChange={(e) => setImdbRating(e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary-500"
                    placeholder="8.5"
                    step="0.1"
                    min="0"
                    max="10"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">URL do Trailer</label>
                  <input
                    type="url"
                    value={trailerUrl}
                    onChange={(e) => setTrailerUrl(e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
                    placeholder="https://youtube.com/..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Link do Grupo Telegram</label>
                  <input
                    type="url"
                    value={telegramGroupLink}
                    onChange={(e) => setTelegramGroupLink(e.target.value)}
                    className="w-full px-4 py-2 bg-dark-700 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
                    placeholder="https://t.me/..."
                  />
                </div>
              </div>

              {/* Genres */}
              <div>
                <label className="block text-sm font-medium mb-3">Gêneros *</label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_GENRES.map((genre) => (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => toggleGenre(genre)}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        selectedGenres.includes(genre)
                          ? 'bg-primary-600 text-white'
                          : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
                      }`}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
                {selectedGenres.length > 0 && (
                  <p className="text-sm text-gray-400 mt-2">
                    Selecionados: {selectedGenres.join(', ')}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2">Descrição</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 bg-dark-700 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
                  placeholder="Descrição curta do conteúdo"
                />
              </div>

              {/* Synopsis */}
              <div>
                <label className="block text-sm font-medium mb-2">Sinopse</label>
                <textarea
                  value={synopsis}
                  onChange={(e) => setSynopsis(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-2 bg-dark-700 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
                  placeholder="Sinopse completa do conteúdo"
                />
              </div>

              {/* Cast */}
              <div>
                <label className="block text-sm font-medium mb-2">Elenco</label>
                <textarea
                  value={cast}
                  onChange={(e) => setCast(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 bg-dark-700 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
                  placeholder="Nome dos atores separados por vírgula"
                />
              </div>

              {/* Images */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Poster */}
                <div>
                  <label className="block text-sm font-medium mb-2">Pôster</label>
                  {posterUrl && (
                    <div className="relative mb-3">
                      <img
                        src={posterUrl}
                        alt="Poster"
                        className="w-full h-64 object-cover rounded-lg border border-white/10"
                      />
                      <button
                        onClick={() => setPosterUrl('')}
                        className="absolute top-2 right-2 p-1 bg-red-500 hover:bg-red-600 rounded-full transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <input
                    ref={posterInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePosterUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => posterInputRef.current?.click()}
                    disabled={posterUploading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-dark-700 hover:bg-dark-600 border border-white/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {posterUploading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-5 h-5" />
                        {posterUrl ? 'Trocar Pôster' : 'Upload Pôster'}
                      </>
                    )}
                  </button>
                </div>

                {/* Backdrop */}
                <div>
                  <label className="block text-sm font-medium mb-2">Backdrop</label>
                  {backdropUrl && (
                    <div className="relative mb-3">
                      <img
                        src={backdropUrl}
                        alt="Backdrop"
                        className="w-full h-64 object-cover rounded-lg border border-white/10"
                      />
                      <button
                        onClick={() => setBackdropUrl('')}
                        className="absolute top-2 right-2 p-1 bg-red-500 hover:bg-red-600 rounded-full transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <input
                    ref={backdropInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleBackdropUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => backdropInputRef.current?.click()}
                    disabled={backdropUploading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-dark-700 hover:bg-dark-600 border border-white/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {backdropUploading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-5 h-5" />
                        {backdropUrl ? 'Trocar Backdrop' : 'Upload Backdrop'}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Featured Checkbox */}
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="is_featured"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="w-5 h-5 text-primary-600 bg-dark-700 border-gray-600 rounded focus:ring-primary-500"
                />
                <label htmlFor="is_featured" className="text-sm font-medium cursor-pointer">
                  Destacar na página inicial
                </label>
              </div>
            </div>
          )}

          {activeTab === 'languages' && content.content_type === 'movie' && (
            <div>
              <ContentLanguageManager
                contentId={contentId}
                onLanguagesChange={(languages) => {
                  console.log('Idiomas atualizados:', languages);
                }}
              />
            </div>
          )}

          {activeTab === 'episodes' && content.content_type === 'series' && (
            <div>
              <EpisodeManager
                seriesId={contentId}
                totalSeasons={content.total_seasons || 1}
                onEpisodesChange={(episodes) => {
                  console.log('Episódios atualizados:', episodes);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
