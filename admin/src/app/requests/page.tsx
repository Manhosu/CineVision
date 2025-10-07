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

  const handleMarkAsProcessed = async (requestId: string) => {
    try {
      setActionLoading(requestId);
      await AdminApiService.updateContentRequest(requestId, { status: 'PROCESSED' });
      await fetchRequests();
    } catch (error) {
      console.error('Error updating request:', error);
      alert('Erro ao atualizar solicitação');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId: string) => {
    const reason = prompt('Motivo da rejeição (opcional):');
    try {
      setActionLoading(requestId);
      await AdminApiService.updateContentRequest(requestId, {
        status: 'REJECTED',
        admin_notes: reason || 'Solicitação rejeitada pelo administrador',
      });
      await fetchRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('Erro ao rejeitar solicitação');
    } finally {
      setActionLoading(null);
    }
  };

  const handleNotifyUser = async (requestId: string, message?: string) => {
    try {
      setActionLoading(requestId);
      await AdminApiService.notifyUser(requestId, message || 'Sua solicitação foi processada!');
      alert('Usuário notificado com sucesso!');
    } catch (error) {
      console.error('Error notifying user:', error);
      alert('Erro ao notificar usuário');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      PENDING: { bg: 'bg-yellow-200', text: 'text-yellow-800', label: 'Pendente' },
      PROCESSED: { bg: 'bg-green-200', text: 'text-green-800', label: 'Processada' },
      REJECTED: { bg: 'bg-red-200', text: 'text-red-800', label: 'Rejeitada' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      LOW: { bg: 'bg-gray-200', text: 'text-gray-800', label: 'Baixa' },
      MEDIUM: { bg: 'bg-blue-200', text: 'text-blue-800', label: 'Média' },
      HIGH: { bg: 'bg-orange-200', text: 'text-orange-800', label: 'Alta' },
      URGENT: { bg: 'bg-red-200', text: 'text-red-800', label: 'Urgente' },
    };

    const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.MEDIUM;

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
              <option value="PENDING">Pendente</option>
              <option value="PROCESSED">Processada</option>
              <option value="REJECTED">Rejeitada</option>
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
              {requests.filter(r => r.status === 'PENDING').length}
            </p>
          </div>
          <div className="bg-dark-800 p-4 rounded-lg border border-dark-700">
            <p className="text-gray-400 text-sm">Processadas</p>
            <p className="text-2xl font-bold text-green-400">
              {requests.filter(r => r.status === 'PROCESSED').length}
            </p>
          </div>
          <div className="bg-dark-800 p-4 rounded-lg border border-dark-700">
            <p className="text-gray-400 text-sm">Rejeitadas</p>
            <p className="text-2xl font-bold text-red-400">
              {requests.filter(r => r.status === 'REJECTED').length}
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
                  <th scope="col" className="px-6 py-3">Categoria</th>
                  <th scope="col" className="px-6 py-3">Prioridade</th>
                  <th scope="col" className="px-6 py-3">Status</th>
                  <th scope="col" className="px-6 py-3">Data</th>
                  <th scope="col" className="px-6 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500 mx-auto"></div>
                      <p className="mt-2">Carregando solicitações...</p>
                    </td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
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
                            <p className="text-xs text-gray-400 mt-1 max-w-xs truncate">
                              {request.description}
                            </p>
                          )}
                          {request.imdb_url && (
                            <a
                              href={request.imdb_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 text-xs hover:text-blue-300"
                            >
                              Ver no IMDB ↗
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded">
                          {request.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {getPriorityBadge(request.priority || 'MEDIUM')}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(request.status)}
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-xs">
                        {format(new Date(request.created_at), 'dd/MM/yyyy HH:mm')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex space-x-2">
                          {request.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleMarkAsProcessed(request.id)}
                                disabled={actionLoading === request.id}
                                className="text-green-400 hover:text-green-300 text-xs disabled:opacity-50"
                                title="Marcar como processada"
                              >
                                {actionLoading === request.id ? '⟳' : '✓'}
                              </button>
                              <button
                                onClick={() => handleReject(request.id)}
                                disabled={actionLoading === request.id}
                                className="text-red-400 hover:text-red-300 text-xs disabled:opacity-50"
                                title="Rejeitar solicitação"
                              >
                                {actionLoading === request.id ? '⟳' : '✗'}
                              </button>
                            </>
                          )}
                          {request.status === 'PROCESSED' && (
                            <button
                              onClick={() => handleNotifyUser(request.id)}
                              disabled={actionLoading === request.id}
                              className="text-blue-400 hover:text-blue-300 text-xs disabled:opacity-50"
                              title="Notificar usuário"
                            >
                              {actionLoading === request.id ? '⟳' : '📢'}
                            </button>
                          )}
                        </div>
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

        {/* Quick Actions */}
        <div className="bg-dark-800 rounded-lg border border-dark-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Ações Rápidas</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-dark-700 p-4 rounded-lg">
              <h3 className="font-medium text-white mb-2">Processar em Lote</h3>
              <p className="text-sm text-gray-400 mb-3">
                Marcar múltiplas solicitações como processadas
              </p>
              <button className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700">
                Processar Pendentes
              </button>
            </div>

            <div className="bg-dark-700 p-4 rounded-lg">
              <h3 className="font-medium text-white mb-2">Notificar Usuários</h3>
              <p className="text-sm text-gray-400 mb-3">
                Enviar notificações para solicitações processadas
              </p>
              <button className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
                Notificar Todos
              </button>
            </div>

            <div className="bg-dark-700 p-4 rounded-lg">
              <h3 className="font-medium text-white mb-2">Exportar Relatório</h3>
              <p className="text-sm text-gray-400 mb-3">
                Baixar relatório de solicitações
              </p>
              <button className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700">
                Exportar CSV
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}