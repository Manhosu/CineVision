'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Film,
  Trash2,
  Search,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Upload
} from 'lucide-react';
import { useUpload } from '@/contexts/UploadContext';

interface Content {
  id: string;
  title: string;
  content_type: string;
  poster_url: string;
  total_seasons?: number;
  total_episodes?: number;
  created_at: string;
  status: string;
}

export default function ContentManagePage() {
  const router = useRouter();
  const { addTask, updateTask, tasks } = useUpload();
  const cancelFlagsRef = useRef<Map<string, boolean>>(new Map());
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Content | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

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
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/content`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setContents(data);
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
      const token = localStorage.getItem('token');
      console.log('[Delete Content] Deleting content:', deleteTarget.id, deleteTarget.title);
      console.log('[Delete Content] API URL:', process.env.NEXT_PUBLIC_API_URL);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/content/${deleteTarget.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      console.log('[Delete Content] Response status:', response.status, response.statusText);

      if (response.ok) {
        const result = await response.json();
        console.log('[Delete Content] Success:', result);
        alert(`✅ ${deleteTarget.title} deletado com sucesso!`);
        await fetchContents();
        setShowDeleteConfirm(false);
        setDeleteTarget(null);
      } else {
        const errorText = await response.text();
        console.error('[Delete Content] Error response:', errorText);

        try {
          const errorJson = JSON.parse(errorText);
          alert(`❌ Erro ao deletar: ${errorJson.message || errorText}`);
        } catch {
          alert(`❌ Erro ao deletar: ${response.status} ${response.statusText}\n\n${errorText}`);
        }
      }
    } catch (error) {
      console.error('[Delete Content] Network error:', error);
      alert(`❌ Erro de rede ao deletar conteúdo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  const handlePublish = async (content: Content) => {
    if (!confirm(`Tem certeza que deseja publicar "${content.title}"? O conteúdo ficará visível no site.`)) {
      return;
    }

    try {
      setPublishingId(content.id);
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/content/${content.id}/publish`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        alert('✅ Conteúdo publicado com sucesso! Já está visível no site.');
        await fetchContents();
      } else {
        const errorText = await response.text();
        console.error('Erro ao publicar:', errorText);
        try {
          const errorJson = JSON.parse(errorText);
          alert(`❌ Erro ao publicar: ${errorJson.message || errorText}`);
        } catch {
          alert(`❌ Erro ao publicar: ${errorText}`);
        }
      }
    } catch (error) {
      console.error('Error publishing content:', error);
      alert('❌ Erro ao publicar conteúdo');
    } finally {
      setPublishingId(null);
    }
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
                        {/* Botão Publicar - só aparece se não estiver publicado */}
                        {(content.status === 'DRAFT' || content.status === 'draft') && (
                          <button
                            onClick={() => handlePublish(content)}
                            disabled={publishingId === content.id}
                            className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Publicar conteúdo"
                          >
                            {publishingId === content.id ? (
                              <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4" />
                            )}
                          </button>
                        )}
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
                <li>Todos os episódios (se for série)</li>
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
      </div>
    </div>
  );
}
