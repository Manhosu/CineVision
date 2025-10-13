'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import AdminApiService, { ContentRequest } from '@/services/adminApi';
import { format } from 'date-fns';

export default function RequestsPage() {
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await AdminApiService.getContentRequests({
        page,
        limit,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      });
      setRequests(data.requests);
      setTotalPages(Math.ceil(data.total / limit));
    } catch (err) {
      setError('Erro ao carregar solicitações');
      console.error('Error fetching requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [page, statusFilter]);


  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { bg: 'bg-yellow-200', text: 'text-yellow-800', label: 'Pendente' },
      approved: { bg: 'bg-green-200', text: 'text-green-800', label: 'Aprovado' },
      rejected: { bg: 'bg-red-200', text: 'text-red-800', label: 'Rejeitado' },
      completed: { bg: 'bg-blue-200', text: 'text-blue-800', label: 'Concluído' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Solicitações de Conteúdo</h1>
          <div className="flex space-x-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-dark-800 text-white border border-dark-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="ALL">Todos os Status</option>
              <option value="pending">Pendente</option>
              <option value="approved">Aprovado</option>
              <option value="rejected">Rejeitado</option>
              <option value="completed">Concluído</option>
            </select>
            <button
              onClick={fetchRequests}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '⟳' : '↻'} Atualizar
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-dark-800 p-4 rounded-lg border border-dark-700">
            <p className="text-gray-400 text-sm">Total</p>
            <p className="text-2xl font-bold text-white">{requests.length}</p>
          </div>
          <div className="bg-dark-800 p-4 rounded-lg border border-dark-700">
            <p className="text-gray-400 text-sm">Pendentes</p>
            <p className="text-2xl font-bold text-yellow-400">
              {requests.filter(r => r.status === 'pending').length}
            </p>
          </div>
          <div className="bg-dark-800 p-4 rounded-lg border border-dark-700">
            <p className="text-gray-400 text-sm">Aprovadas</p>
            <p className="text-2xl font-bold text-green-400">
              {requests.filter(r => r.status === 'approved' || r.status === 'completed').length}
            </p>
          </div>
          <div className="bg-dark-800 p-4 rounded-lg border border-dark-700">
            <p className="text-gray-400 text-sm">Rejeitadas</p>
            <p className="text-2xl font-bold text-red-400">
              {requests.filter(r => r.status === 'rejected').length}
            </p>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-300 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Requests Table */}
        <div className="bg-dark-800 rounded-lg border border-dark-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-300">
              <thead className="text-xs text-gray-400 uppercase bg-dark-700">
                <tr>
                  <th scope="col" className="px-6 py-3">Usuário</th>
                  <th scope="col" className="px-6 py-3">Conteúdo Solicitado</th>
                  <th scope="col" className="px-6 py-3">Status</th>
                  <th scope="col" className="px-6 py-3">Data</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500 mx-auto"></div>
                      <p className="mt-2">Carregando solicitações...</p>
                    </td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                      <svg className="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <p>Nenhuma solicitação encontrada</p>
                    </td>
                  </tr>
                ) : (
                  requests.map((request) => (
                    <tr key={request.id} className="border-b border-dark-700 hover:bg-dark-700/50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-white">
                            {request.user?.name || request.user?.telegram_username || 'Usuário Anônimo'}
                          </p>
                          <p className="text-xs text-gray-400">
                            {request.user?.email || `@${request.user?.telegram_username}`}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-white">{request.content_title}</p>
                          {request.description && (
                            <p className="text-xs text-gray-400 mt-1 max-w-md">
                              {request.description}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(request.status)}
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-xs">
                        {format(new Date(request.created_at), 'dd/MM/yyyy HH:mm')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-dark-700 flex items-center justify-between">
              <div className="text-sm text-gray-400">
                Página {page} de {totalPages}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-1 bg-dark-700 text-white rounded disabled:opacity-50 hover:bg-dark-600"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className="px-3 py-1 bg-dark-700 text-white rounded disabled:opacity-50 hover:bg-dark-600"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </AdminLayout>
  );
}