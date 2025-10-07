'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import ContentTable from '@/components/tables/ContentTable';
import ContentModal from '@/components/modals/ContentModal';
import AdminApiService, { Content } from '@/services/adminApi';

export default function ContentPage() {
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  const fetchContent = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await AdminApiService.getContent({
        page,
        limit,
        search: searchTerm || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        availability: availabilityFilter !== 'ALL' ? availabilityFilter : undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setContents(data.content);
      setTotalPages(Math.ceil(data.total / limit));
    } catch (err) {
      setError('Erro ao carregar conteúdo');
      console.error('Error fetching content:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContent();
  }, [page, searchTerm, statusFilter, availabilityFilter, sortBy, sortOrder]);

  const handleCreateContent = async (contentData: any) => {
    try {
      setModalLoading(true);
      await AdminApiService.createContent(contentData);
      await fetchContent();
      setIsModalOpen(false);
      setSelectedContent(null);
    } catch (error) {
      console.error('Error creating content:', error);
      throw error;
    } finally {
      setModalLoading(false);
    }
  };

  const handleUpdateContent = async (contentData: any) => {
    if (!selectedContent) return;

    try {
      setModalLoading(true);
      await AdminApiService.updateContent(selectedContent.id, contentData);
      await fetchContent();
      setIsModalOpen(false);
      setSelectedContent(null);
    } catch (error) {
      console.error('Error updating content:', error);
      throw error;
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteContent = async (contentId: string) => {
    if (window.confirm('Tem certeza que deseja excluir este conteúdo?')) {
      try {
        await AdminApiService.deleteContent(contentId);
        await fetchContent();
      } catch (error) {
        console.error('Error deleting content:', error);
        alert('Erro ao excluir conteúdo');
      }
    }
  };

  const handleUpdateAvailability = async (contentId: string, availability: string) => {
    try {
      await AdminApiService.updateContent(contentId, { availability });
      await fetchContent();
    } catch (error) {
      console.error('Error updating availability:', error);
      alert('Erro ao atualizar disponibilidade');
    }
  };

  const handleEditContent = (content: Content) => {
    setSelectedContent(content);
    setIsModalOpen(true);
  };

  const handleAddContent = () => {
    setSelectedContent(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedContent(null);
  };

  const handleSaveContent = async (contentData: any) => {
    if (selectedContent) {
      await handleUpdateContent(contentData);
    } else {
      await handleCreateContent(contentData);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-white">Gerenciamento de Conteúdo</h1>
          <button
            onClick={handleAddContent}
            className="btn-primary flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Adicionar Conteúdo</span>
          </button>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Buscar
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Título do conteúdo..."
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="ALL">Todos</option>
                <option value="PUBLISHED">Publicado</option>
                <option value="DRAFT">Rascunho</option>
                <option value="ARCHIVED">Arquivado</option>
                <option value="PROCESSING">Processando</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Disponibilidade
              </label>
              <select
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="ALL">Todos</option>
                <option value="site">Site</option>
                <option value="telegram">Telegram</option>
                <option value="both">Ambos</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Ordenar por
              </label>
              <select
                value={`${sortBy}:${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split(':');
                  setSortBy(field);
                  setSortOrder(order as 'asc' | 'desc');
                }}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="created_at:desc">Mais recente</option>
                <option value="created_at:asc">Mais antigo</option>
                <option value="title:asc">Título (A-Z)</option>
                <option value="title:desc">Título (Z-A)</option>
                <option value="price_cents:desc">Maior preço</option>
                <option value="price_cents:asc">Menor preço</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-300 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Content Table */}
        <ContentTable
          data={contents}
          loading={loading}
          onEdit={handleEditContent}
          onDelete={handleDeleteContent}
          onUpdateAvailability={handleUpdateAvailability}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Página {page} de {totalPages}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-2 bg-dark-700 text-white rounded-lg hover:bg-dark-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-2 bg-dark-700 text-white rounded-lg hover:bg-dark-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Próxima
              </button>
            </div>
          </div>
        )}

        {/* Content Modal */}
        <ContentModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          content={selectedContent}
          onSave={handleSaveContent}
          loading={modalLoading}
        />
      </div>
    </AdminLayout>
  );
}