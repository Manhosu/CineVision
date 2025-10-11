'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { SimultaneousVideoUpload } from '@/components/SimultaneousVideoUpload';
import { uploadImageToSupabase } from '@/lib/supabaseStorage';

interface ContentFormData {
  title: string;
  description: string;
  synopsis: string;
  release_date: string;
  duration_minutes: number;
  genre: string;
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

interface FileUploadState {
  posterFile: File | null;
  posterUploading: boolean;
  posterUrl: string;
  backdropFile: File | null;
  backdropUploading: boolean;
  backdropUrl: string;
}

export default function AdminContentCreatePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdContentId, setCreatedContentId] = useState<string | null>(null);
  const [showLanguageManager, setShowLanguageManager] = useState(false);
  const [formData, setFormData] = useState<ContentFormData>({
    title: '',
    description: '',
    synopsis: '',
    release_date: '',
    duration_minutes: 0,
    genre: '',
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

    setIsSubmitting(true);

    try {
      // Transformar dados para o formato esperado pelo backend
      const backendData = {
        title: formData.title,
        description: formData.description || undefined,
        synopsis: formData.synopsis || undefined,
        poster_url: formData.poster_url,
        backdrop_url: formData.backdrop_url || undefined,
        trailer_url: formData.trailer_url || undefined,
        type: formData.content_type, // content_type → type
        availability: 'site', // Padrão
        price_cents: formData.price_cents,
        currency: 'BRL',
        is_featured: formData.is_featured,
        genres: formData.genre ? [formData.genre] : undefined, // genre → genres (array)
        director: formData.director || undefined,
        cast: formData.cast || undefined,
        release_year: formData.release_date ? new Date(formData.release_date).getFullYear() : undefined, // release_date → release_year
        duration_minutes: formData.duration_minutes || undefined,
        imdb_rating: formData.rating ? parseFloat(formData.rating) : undefined, // rating → imdb_rating
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/content/create`, {
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
      setShowLanguageManager(true);
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

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Gênero *</label>
                  <input
                    type="text"
                    name="genre"
                    value={formData.genre}
                    onChange={handleChange}
                    placeholder="Ação, Terror, Drama..."
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    required
                  />
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
                      type="number"
                      name="price_reais"
                      value={(formData.price_cents / 100).toFixed(2)}
                      onChange={(e) => {
                        const reaisValue = parseFloat(e.target.value) || 0;
                        const centsValue = Math.round(reaisValue * 100);
                        setFormData(prev => ({ ...prev, price_cents: centsValue }));
                      }}
                      min="0"
                      step="0.01"
                      placeholder="19.90"
                      className="w-full pl-14 pr-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    💰 Valor em centavos: {formData.price_cents}
                  </p>
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
              contentId={createdContentId}
              onUploadComplete={() => {
                toast.success('Vídeos enviados com sucesso!');
              }}
            />

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={() => router.push('/admin/content')}
                className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-green-900/50 flex items-center justify-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Finalizar e Ver Conteúdos</span>
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
                      genre: '',
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
        )}
      </div>
    </div>
  );
}
