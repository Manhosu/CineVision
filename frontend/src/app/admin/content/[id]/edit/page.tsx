'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { ContentLanguageManager } from '@/components/ContentLanguageManager';

interface Content {
  id: string;
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
  created_at: string;
  updated_at: string;
}

export default function AdminContentEditPage() {
  const router = useRouter();
  const params = useParams();
  const contentId = params.id as string;

  const [content, setContent] = useState<Content | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'languages'>('details');

  useEffect(() => {
    if (contentId) {
      loadContent();
    }
  }, [contentId]);

  const loadContent = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/content/${contentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setContent(data);
      } else {
        toast.error('Erro ao carregar conteúdo');
        router.push('/admin/content');
      }
    } catch (error) {
      console.error('Erro ao carregar conteúdo:', error);
      toast.error('Erro ao carregar conteúdo');
      router.push('/admin/content');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4">Carregando conteúdo...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Conteúdo não encontrado</h1>
            <button
              onClick={() => router.push('/admin/content')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Voltar para Conteúdos
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.push('/admin/content')}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-3xl font-bold">Editar Conteúdo</h1>
              <p className="text-gray-400">{content.title}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab('details')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'details'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Detalhes do Conteúdo
            </button>
            <button
              onClick={() => setActiveTab('languages')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'languages'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Idiomas e Vídeos
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="bg-gray-800 rounded-lg p-6">
          {activeTab === 'details' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-4">Informações Básicas</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Título</label>
                  <div className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg">
                    {content.title}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Tipo</label>
                  <div className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg">
                    {content.content_type === 'movie' ? 'Filme' : 'Série'}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Gênero</label>
                  <div className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg">
                    {content.genre}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Classificação</label>
                  <div className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg">
                    {content.rating}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Duração</label>
                  <div className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg">
                    {content.duration_minutes} minutos
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Preço</label>
                  <div className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg">
                    R$ {(content.price_cents / 100).toFixed(2)}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Data de Lançamento</label>
                  <div className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg">
                    {new Date(content.release_date).toLocaleDateString('pt-BR')}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Diretor</label>
                  <div className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg">
                    {content.director}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Descrição</label>
                <div className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg min-h-[100px]">
                  {content.description}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Sinopse</label>
                <div className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg min-h-[120px]">
                  {content.synopsis}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Elenco</label>
                <div className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg">
                  {content.cast}
                </div>
              </div>

              {content.poster_url && (
                <div>
                  <label className="block text-sm font-medium mb-2">Pôster</label>
                  <img
                    src={content.poster_url}
                    alt={content.title}
                    className="w-48 h-72 object-cover rounded-lg border border-gray-600"
                  />
                </div>
              )}

              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={content.is_featured}
                    disabled
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
                  />
                  <label className="ml-2 text-sm">Destacado na página inicial</label>
                </div>
              </div>

              <div className="pt-4">
                <p className="text-sm text-gray-400">
                  Para editar essas informações, use a funcionalidade de edição completa do conteúdo.
                  Esta página foca no gerenciamento de idiomas e vídeos.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'languages' && (
            <div>
              <ContentLanguageManager
                contentId={contentId}
                onLanguagesChange={(languages) => {
                  console.log('Idiomas atualizados:', languages);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}