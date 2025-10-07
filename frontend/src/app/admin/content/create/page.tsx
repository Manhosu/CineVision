'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { ContentLanguageManager } from '@/components/ContentLanguageManager';
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
    <div className="min-h-screen bg-gray-900 text-white py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Criar Novo Conteúdo</h1>
          <p className="text-gray-400">Adicione um novo filme ou série ao catálogo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-gray-800 p-6 rounded-lg">
          {/* Basic Information */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold border-b border-gray-700 pb-2">Informações Básicas</h2>

            <div>
              <label className="block text-sm font-medium mb-2">Tipo de Conteúdo</label>
              <select
                name="content_type"
                value={formData.content_type}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="movie">Filme</option>
                <option value="series">Série</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Título *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Descrição Curta *</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={2}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Sinopse Completa</label>
              <textarea
                name="synopsis"
                value={formData.synopsis}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Media Information */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold border-b border-gray-700 pb-2">Detalhes</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Data de Lançamento *</label>
                <input
                  type="date"
                  name="release_date"
                  value={formData.release_date}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Duração (minutos) *</label>
                <input
                  type="number"
                  name="duration_minutes"
                  value={formData.duration_minutes}
                  onChange={handleChange}
                  min="1"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Gênero *</label>
                <input
                  type="text"
                  name="genre"
                  value={formData.genre}
                  onChange={handleChange}
                  placeholder="Ação, Drama, Comédia..."
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Classificação</label>
                <input
                  type="text"
                  name="rating"
                  value={formData.rating}
                  onChange={handleChange}
                  placeholder="Livre, 12, 14, 16, 18"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Diretor</label>
                <input
                  type="text"
                  name="director"
                  value={formData.director}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Elenco</label>
                <input
                  type="text"
                  name="cast"
                  value={formData.cast}
                  onChange={handleChange}
                  placeholder="Separado por vírgulas"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* URLs */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold border-b border-gray-700 pb-2">Mídia</h2>

            <div>
              <label className="block text-sm font-medium mb-2">URL do Trailer</label>
              <input
                type="url"
                name="trailer_url"
                value={formData.trailer_url}
                onChange={handleChange}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Pôster do Filme *</label>
              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePosterFileChange}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                  disabled={fileUpload.posterUploading}
                />
                {fileUpload.posterUploading && (
                  <div className="flex items-center text-blue-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400 mr-2"></div>
                    Fazendo upload do pôster...
                  </div>
                )}
                {fileUpload.posterUrl && (
                  <div className="flex items-center text-green-400">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Pôster enviado com sucesso!
                  </div>
                )}
                {fileUpload.posterFile && (
                  <div className="text-sm text-gray-400">
                    Arquivo: {fileUpload.posterFile.name} ({(fileUpload.posterFile.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Backdrop do Filme (Opcional)</label>
              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBackdropFileChange}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                  disabled={fileUpload.backdropUploading}
                />
                {fileUpload.backdropUploading && (
                  <div className="flex items-center text-blue-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400 mr-2"></div>
                    Fazendo upload do backdrop...
                  </div>
                )}
                {fileUpload.backdropUrl && (
                  <div className="flex items-center text-green-400">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Backdrop enviado com sucesso!
                  </div>
                )}
                {fileUpload.backdropFile && (
                  <div className="text-sm text-gray-400">
                    Arquivo: {fileUpload.backdropFile.name} ({(fileUpload.backdropFile.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/40 rounded-lg">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <svg className="w-12 h-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-bold text-blue-300 mb-2">📹 Próximo Passo: Upload de Vídeos</h4>
                  <p className="text-sm text-gray-300 mb-3">
                    Após criar o conteúdo, você poderá adicionar os arquivos de vídeo (.mkv ou .mp4) em diferentes versões:
                  </p>
                  <ul className="space-y-2 text-sm text-gray-400">
                    <li className="flex items-center">
                      <svg className="w-4 h-4 mr-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span><strong className="text-blue-300">Dublado</strong> (pt-BR) - Áudio em português</span>
                    </li>
                    <li className="flex items-center">
                      <svg className="w-4 h-4 mr-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span><strong className="text-blue-300">Legendado</strong> (pt-BR) - Áudio original + legendas</span>
                    </li>
                    <li className="flex items-center">
                      <svg className="w-4 h-4 mr-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span><strong className="text-blue-300">Original</strong> - Idioma original do filme</span>
                    </li>
                  </ul>
                  <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded">
                    <p className="text-xs text-blue-200">
                      💡 <strong>Dica:</strong> Arquivos grandes (até 5GB) são suportados com barra de progresso e upload em partes.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold border-b border-gray-700 pb-2">Preço e Destaque</h2>

            <div>
              <label className="block text-sm font-medium mb-2">Preço (R$) *</label>
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
                placeholder="0.00"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="text-sm text-gray-400 mt-1">
                Valor em centavos: {formData.price_cents}
              </p>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                name="is_featured"
                checked={formData.is_featured}
                onChange={handleChange}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
              />
              <label className="ml-2 text-sm font-medium">Destacar na página inicial</label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={() => router.push('/admin')}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Voltar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || fileUpload.posterUploading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {isSubmitting ? 'Criando...' : 'Criar Conteúdo'}
            </button>
          </div>
        </form>

        {/* Language Manager - shown after content creation */}
        {showLanguageManager && createdContentId && (
          <div className="mt-8 p-8 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl border-2 border-green-500/50 shadow-2xl">
            <div className="mb-8">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0 w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mr-4">
                  <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-green-400 mb-1">✅ Conteúdo Criado com Sucesso!</h2>
                  <p className="text-lg text-gray-300">
                    Agora adicione os arquivos de vídeo (.mkv ou .mp4)
                  </p>
                </div>
              </div>

              <div className="p-4 bg-blue-900/20 border-l-4 border-blue-500 rounded">
                <p className="text-sm text-blue-200">
                  <strong>📹 Formatos Aceitos:</strong> .mkv e .mp4 |
                  <strong className="ml-3">📦 Tamanho Máximo:</strong> 5GB por arquivo |
                  <strong className="ml-3">🌍 Multi-idioma:</strong> Dublado, Legendado e Original
                </p>
              </div>
            </div>

            <ContentLanguageManager
              contentId={createdContentId}
              onLanguagesChange={(languages) => {
                console.log('Idiomas atualizados:', languages);
              }}
            />

            <div className="mt-6 flex gap-4">
              <button
                onClick={() => router.push('/admin/content')}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Finalizar e Ver Conteúdos
              </button>
              <button
                onClick={() => {
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
                  });
                }}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Criar Outro Conteúdo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
