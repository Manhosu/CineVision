'use client';

import { useState } from 'react';
import { Content } from '@/services/adminApi';
import { format } from 'date-fns';

interface ContentTableProps {
  data: Content[];
  loading: boolean;
  onEdit: (content: Content) => void;
  onDelete: (contentId: string) => void;
  onUpdateAvailability: (contentId: string, availability: string) => void;
}

export default function ContentTable({
  data,
  loading,
  onEdit,
  onDelete,
  onUpdateAvailability
}: ContentTableProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      PUBLISHED: { color: 'bg-green-200 text-green-800', label: 'Publicado' },
      DRAFT: { color: 'bg-yellow-200 text-yellow-800', label: 'Rascunho' },
      ARCHIVED: { color: 'bg-gray-200 text-gray-800', label: 'Arquivado' },
      PROCESSING: { color: 'bg-blue-200 text-blue-800', label: 'Processando' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.DRAFT;

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const getAvailabilityBadge = (availability: string) => {
    const availabilityConfig = {
      site: { color: 'bg-blue-200 text-blue-800', label: 'Site' },
      telegram: { color: 'bg-purple-200 text-purple-800', label: 'Telegram' },
      both: { color: 'bg-green-200 text-green-800', label: 'Ambos' },
    };

    const config = availabilityConfig[availability as keyof typeof availabilityConfig] || availabilityConfig.site;

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(data.map(item => item.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (contentId: string, checked: boolean) => {
    if (checked) {
      setSelectedItems(prev => [...prev, contentId]);
    } else {
      setSelectedItems(prev => prev.filter(id => id !== contentId));
    }
  };

  const handleBulkDelete = () => {
    if (window.confirm(`Deseja excluir ${selectedItems.length} itens selecionados?`)) {
      selectedItems.forEach(id => onDelete(id));
      setSelectedItems([]);
    }
  };

  const handleAvailabilityChange = (contentId: string, newAvailability: string) => {
    onUpdateAvailability(contentId, newAvailability);
  };

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex space-x-4">
              <div className="h-4 bg-gray-600 rounded w-8"></div>
              <div className="h-4 bg-gray-600 rounded w-48"></div>
              <div className="h-4 bg-gray-600 rounded w-20"></div>
              <div className="h-4 bg-gray-600 rounded w-16"></div>
              <div className="h-4 bg-gray-600 rounded w-20"></div>
              <div className="h-4 bg-gray-600 rounded w-24"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      {/* Bulk Actions */}
      {selectedItems.length > 0 && (
        <div className="mb-4 p-4 bg-dark-700 rounded-lg flex items-center justify-between">
          <span className="text-white">
            {selectedItems.length} item(s) selecionado(s)
          </span>
          <div className="flex space-x-2">
            <button
              onClick={handleBulkDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Excluir Selecionados
            </button>
            <button
              onClick={() => setSelectedItems([])}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-300">
          <thead className="text-xs text-gray-400 uppercase bg-dark-700">
            <tr>
              <th scope="col" className="px-6 py-3">
                <input
                  type="checkbox"
                  checked={selectedItems.length === data.length && data.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-700 text-red-600"
                />
              </th>
              <th scope="col" className="px-6 py-3">Título</th>
              <th scope="col" className="px-6 py-3">Categorias</th>
              <th scope="col" className="px-6 py-3">Preço</th>
              <th scope="col" className="px-6 py-3">Status</th>
              <th scope="col" className="px-6 py-3">Disponibilidade</th>
              <th scope="col" className="px-6 py-3">Vendas</th>
              <th scope="col" className="px-6 py-3">Receita</th>
              <th scope="col" className="px-6 py-3">Criado</th>
              <th scope="col" className="px-6 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {data.map((content) => (
              <tr key={content.id} className="border-b border-dark-700 hover:bg-dark-800">
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(content.id)}
                    onChange={(e) => handleSelectItem(content.id, e.target.checked)}
                    className="rounded border-gray-600 bg-gray-700 text-red-600"
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-white">{content.title}</div>
                  {content.description && (
                    <div className="text-gray-400 text-xs truncate max-w-xs">
                      {content.description}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {content.categories?.map((category) => (
                      <span
                        key={category.name}
                        className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded"
                      >
                        {category.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 font-semibold">
                  {formatPrice(content.price_cents)}
                </td>
                <td className="px-6 py-4">
                  {getStatusBadge(content.status)}
                </td>
                <td className="px-6 py-4">
                  <select
                    value={content.availability}
                    onChange={(e) => handleAvailabilityChange(content.id, e.target.value)}
                    className="px-2 py-1 text-xs bg-dark-700 text-white border border-dark-600 rounded focus:ring-2 focus:ring-red-500"
                  >
                    <option value="site">Site</option>
                    <option value="telegram">Telegram</option>
                    <option value="both">Ambos</option>
                  </select>
                </td>
                <td className="px-6 py-4">
                  <div className="text-blue-400 font-semibold">
                    {content.purchase_count || 0}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-green-400 font-semibold">
                    {formatPrice((content.total_revenue || 0) * 100)}
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-400 text-xs">
                  {format(new Date(content.created_at), 'dd/MM/yyyy')}
                </td>
                <td className="px-6 py-4">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onEdit(content)}
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => onDelete(content.id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400">
              <svg className="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p>Nenhum conteúdo encontrado</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}