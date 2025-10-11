'use client';

import React, { useState, useEffect } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { ContentLanguageManager } from '@/components/ContentLanguageManager';

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface ContentFormData {
  title: string;
  description: string;
  synopsis: string;
  content_type: 'movie' | 'series';
  release_date: string;
  duration_minutes: number;
  genre: string;
  rating: string;
  director: string;
  cast: string;
  price_cents: number;
  is_featured: boolean;
  poster_url: string;
  backdrop_url: string;
  trailer_url: string;
}

export default function CreateContentPage() {
  const [formData, setFormData] = useState<ContentFormData>({
    title: '',
    description: '',
    synopsis: '',
    content_type: 'movie',
    release_date: '',
    duration_minutes: 0,
    genre: '',
    rating: '',
    director: '',
    cast: '',
    price_cents: 1990,
    is_featured: false,
    poster_url: '',
    backdrop_url: '',
    trailer_url: '',
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdContentId, setCreatedContentId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Upload de poster
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const [isUploadingPoster, setIsUploadingPoster] = useState(false);

  // Buscar categorias
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/content/categories`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Erro ao buscar categorias:', error);
    }
  };

  const handlePosterChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione uma imagem válida');
      return;
    }

    // Validar tamanho (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 10MB');
      return;
    }

    setPosterFile(file);
    setPosterPreview(URL.createObjectURL(file));

    // Upload imediato
    await uploadPoster(file);
  };

  const uploadPoster = async (file: File) => {
    setIsUploadingPoster(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('type', 'poster');

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/admin/api/images/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: formDataUpload,
      });

      if (response.ok) {
        const data = await response.json();
        setFormData(prev => ({ ...prev, poster_url: data.url }));
      } else {
        throw new Error('Erro ao fazer upload da imagem');
      }
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      alert('Erro ao fazer upload da imagem');
    } finally {
      setIsUploadingPoster(false);
    }
  };

  const getAuthToken = (): string => {
    let token = localStorage.getItem('admin_token') || localStorage.getItem('auth_token');
    if (!token) {
      const supabaseToken = localStorage.getItem('sb-szghyvnbmjlquznxhqum-auth-token');
      if (supabaseToken) {
        try {
          const parsed = JSON.parse(supabaseToken);
          token = parsed.access_token;
        } catch (e) {
          token = supabaseToken;
        }
      }
    }
    return token || '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Validações
      if (!formData.title.trim()) {
        throw new Error('O título é obrigatório');
      }
      if (!formData.description.trim()) {
        throw new Error('A descrição é obrigatória');
      }
      if (!formData.release_date) {
        throw new Error('A data de lançamento é obrigatória');
      }
      if (formData.duration_minutes <= 0) {
        throw new Error('A duração deve ser maior que zero');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/admin/content/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          ...formData,
          cast: formData.cast.split(',').map(c => c.trim()).filter(c => c),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao criar conteúdo');
      }

      const data = await response.json();
      setCreatedContentId(data.id);
      setShowSuccess(true);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAnother = () => {
    setFormData({
      title: '',
      description: '',
      synopsis: '',
      content_type: 'movie',
      release_date: '',
      duration_minutes: 0,
      genre: '',
      rating: '',
      director: '',
      cast: '',
      price_cents: 1990,
      is_featured: false,
      poster_url: '',
      backdrop_url: '',
      trailer_url: '',
    });
    setPosterFile(null);
    setPosterPreview(null);
    setCreatedContentId(null);
    setShowSuccess(false);
    setError(null);
  };

  if (showSuccess && createdContentId) {
    return (
      <AdminLayout>
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Success Message */}
          <div className="bg-gradient-to-r from-green-900/20 to-green-800/20 border border-green-500/30 rounded-xl p-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-2">✅ Conteúdo Criado com Sucesso!</h2>
                <p className="text-gray-300 mb-4">
                  Agora adicione os arquivos de vídeo (.mkv ou .mp4)
                </p>
                <div className="flex items-center space-x-4 text-sm text-gray-400">
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
                    </svg>
                    <strong>📹 Formatos Aceitos:</strong> .mkv e .mp4
                  </span>
                  <span>|</span>
                  <span className="flex items-center">
                    <strong>📦 Tamanho Máximo:</strong> 5GB por arquivo
                  </span>
                  <span>|</span>
                  <span className="flex items-center">
                    <strong>🌍 Multi-idioma:</strong> Dublado, Legendado e Original
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Upload de Vídeos */}
          <ContentLanguageManager
            contentId={createdContentId}
            onLanguagesChange={(languages) => {
              console.log('Idiomas atualizados:', languages);
            }}
          />

          {/* Actions */}
          <div className="flex justify-between items-center bg-dark-800/30 border border-dark-600 rounded-xl p-6">
            <button
              onClick={() => window.location.href = '/admin/content'}
              className="flex items-center space-x-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              <span>Finalizar e Ver Conteúdos</span>
            </button>
            <button
              onClick={handleCreateAnother}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Criar Outro Conteúdo</span>
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">Criar Novo Conteúdo</h1>
          <p className="text-gray-400 mt-1">Adicione um novo filme ou série ao catálogo</p>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações Básicas */}
          <div className="bg-dark-800/30 border border-dark-600 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Informações Básicas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tipo de Conteúdo
                </label>
                <select
                  value={formData.content_type}
                  onChange={(e) => setFormData({ ...formData, content_type: e.target.value as 'movie' | 'series' })}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="movie">Filme</option>
                  <option value="series">Série</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Título *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                required
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Descrição Curta *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                required
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Sinopse Completa
              </label>
              <textarea
                value={formData.synopsis}
                onChange={(e) => setFormData({ ...formData, synopsis: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Detalhes */}
          <div className="bg-dark-800/30 border border-dark-600 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Detalhes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Data de Lançamento *
                </label>
                <input
                  type="date"
                  value={formData.release_date}
                  onChange={(e) => setFormData({ ...formData, release_date: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Duração (minutos) *
                </label>
                <input
                  type="number"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                  min="1"
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Gênero *
                </label>
                <input
                  type="text"
                  value={formData.genre}
                  onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                  placeholder="Ação, Drama, Comédia..."
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Classificação
                </label>
                <input
                  type="text"
                  value={formData.rating}
                  onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                  placeholder="Livre, 12, 14, 16, 18"
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Diretor
                </label>
                <input
                  type="text"
                  value={formData.director}
                  onChange={(e) => setFormData({ ...formData, director: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Elenco
                </label>
                <input
                  type="text"
                  value={formData.cast}
                  onChange={(e) => setFormData({ ...formData, cast: e.target.value })}
                  placeholder="Separado por vírgulas"
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Mídia */}
          <div className="bg-dark-800/30 border border-dark-600 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Mídia</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  URL do Trailer
                </label>
                <input
                  type="url"
                  value={formData.trailer_url}
                  onChange={(e) => setFormData({ ...formData, trailer_url: e.target.value })}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Pôster do Filme *
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePosterChange}
                    className="hidden"
                    id="poster-upload"
                  />
                  <label
                    htmlFor="poster-upload"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors"
                  >
                    Escolher arquivo
                  </label>
                  {isUploadingPoster && (
                    <span className="text-gray-400">Enviando...</span>
                  )}
                  {posterFile && !isUploadingPoster && (
                    <span className="text-green-400">✓ {posterFile.name}</span>
                  )}
                </div>
                {posterPreview && (
                  <div className="mt-4">
                    <img src={posterPreview} alt="Preview" className="w-48 h-auto rounded-lg border border-dark-600" />
                  </div>
                )}
              </div>

              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <h4 className="text-blue-300 font-medium mb-2">📹 Próximo Passo: Upload de Vídeos</h4>
                <p className="text-gray-400 text-sm">
                  Após criar o conteúdo, você poderá adicionar os arquivos de vídeo (.mkv ou .mp4) em diferentes versões:
                </p>
                <ul className="mt-2 space-y-1 text-sm text-gray-400">
                  <li><strong className="text-white">Dublado</strong> (pt-BR) - Áudio em português</li>
                  <li><strong className="text-white">Legendado</strong> (pt-BR) - Áudio original + legendas</li>
                  <li><strong className="text-white">Original</strong> - Idioma original do filme</li>
                </ul>
                <p className="mt-2 text-xs text-gray-500">
                  💡 <strong>Dica:</strong> Arquivos grandes (até 5GB) são suportados com barra de progresso e upload em partes.
                </p>
              </div>
            </div>
          </div>

          {/* Preço e Destaque */}
          <div className="bg-dark-800/30 border border-dark-600 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Preço e Destaque</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Preço (R$) *
                </label>
                <input
                  type="number"
                  value={formData.price_cents / 100}
                  onChange={(e) => setFormData({ ...formData, price_cents: parseFloat(e.target.value) * 100 })}
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Valor em centavos: {formData.price_cents}</p>
              </div>

              <div className="flex items-center">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_featured}
                    onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                    className="w-5 h-5 text-red-600 bg-dark-700 border-dark-600 rounded focus:ring-red-500"
                  />
                  <span className="text-gray-300">Destacar na página inicial</span>
                </label>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => window.location.href = '/admin/content'}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Voltar
            </button>
            <button
              type="submit"
              disabled={isLoading || isUploadingPoster}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Criando...' : 'Criar Conteúdo'}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
