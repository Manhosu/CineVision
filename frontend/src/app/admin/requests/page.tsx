'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, Filter, Check, X, Clock, FileText, User } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AdminRequest {
  id: string;
  requested_title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  user_id?: string;
  created_at: string;
  updated_at: string;
  admin_notes?: string;
}

interface RequestStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export default function AdminRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [stats, setStats] = useState<RequestStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<AdminRequest | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
    fetchStats();
  }, [filter]);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = localStorage.getItem('access_token');
      // Temporariamente desabilitado para debug
      // if (!token) {
      //   router.push('/login?redirect=/admin/requests');
      //   return;
      // }

      const statusQuery = filter !== 'all' ? `&status=${filter}` : '';
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/requests?page=1&limit=50${statusQuery}`,
        {
          headers: token ? {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          } : {
            'Content-Type': 'application/json',
          },
        }
      );

      // Temporariamente desabilitado para debug
      // if (response.status === 401) {
      //   localStorage.removeItem('access_token');
      //   router.push('/login?redirect=/admin/requests');
      //   return;
      // }

      if (!response.ok) {
        throw new Error('Failed to fetch requests');
      }

      const data = await response.json();
      setRequests(data.data || []);
    } catch (err) {
      console.error('Error fetching requests:', err);
      setError('Erro ao carregar pedidos');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/requests/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const updateRequestStatus = async (
    requestId: string,
    status: 'completed' | 'rejected',
    adminNotes?: string
  ) => {
    try {
      setActionLoading(requestId);

      const token = localStorage.getItem('access_token');
      // Temporariamente desabilitado para debug
      // if (!token) {
      //   router.push('/login?redirect=/admin/requests');
      //   return;
      // }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/requests/${requestId}?status=${status}&admin_notes=${encodeURIComponent(adminNotes || '')}`, {
        method: 'PUT',
        headers: token ? {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        } : {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to update request');
      }

      // Refresh data
      await fetchRequests();
      await fetchStats();
      setSelectedRequest(null);
    } catch (err) {
      console.error('Error updating request:', err);
      setError('Erro ao atualizar pedido');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredRequests = requests.filter(request =>
    request.requested_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (request.description && request.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { icon: Clock, color: 'bg-yellow-500/20 text-yellow-400', text: 'Pendente' },
      completed: { icon: Check, color: 'bg-green-500/20 text-green-400', text: 'Aprovado' },
      rejected: { icon: X, color: 'bg-red-500/20 text-red-400', text: 'Rejeitado' },
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return null;

    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3" />
        {config.text}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full"></div>
          <span className="text-white text-lg">Carregando pedidos...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Header */}
      <div className="bg-dark-900/50 backdrop-blur-sm border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/admin')}
                className="p-2 text-gray-400 hover:text-white hover:bg-dark-700 rounded-lg transition-all duration-200"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-600/20 rounded-lg">
                  <FileText className="w-6 h-6 text-primary-500" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Gerenciar Pedidos</h1>
                  <p className="text-sm text-gray-400">Aprovar e gerenciar solicitações de conteúdo</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600/20 rounded-lg">
                <FileText className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
                <p className="text-sm text-gray-400">Total</p>
              </div>
            </div>
          </div>

          <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-600/20 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.pending}</p>
                <p className="text-sm text-gray-400">Pendentes</p>
              </div>
            </div>
          </div>

          <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-600/20 rounded-lg">
                <Check className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.approved}</p>
                <p className="text-sm text-gray-400">Aprovados</p>
              </div>
            </div>
          </div>

          <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-600/20 rounded-lg">
                <X className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.rejected}</p>
                <p className="text-sm text-gray-400">Rejeitados</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Buscar por título, descrição ou usuário..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-dark-700 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
              <Filter className="text-gray-400 w-5 h-5" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="px-4 py-3 bg-dark-700 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">Todos</option>
                <option value="pending">Pendentes</option>
                <option value="completed">Aprovados</option>
                <option value="rejected">Rejeitados</option>
              </select>
            </div>
          </div>
        </div>

        {/* Requests List */}
        <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
          {filteredRequests.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Nenhum pedido encontrado</h3>
              <p className="text-gray-400">
                {searchTerm || filter !== 'all'
                  ? 'Tente ajustar os filtros de busca'
                  : 'Ainda não há pedidos de conteúdo'
                }
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {filteredRequests.map((request) => (
                <div key={request.id} className="p-6 hover:bg-dark-700/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-medium text-white">{request.requested_title}</h3>
                        {getStatusBadge(request.status)}
                      </div>

                      {request.description && (
                        <p className="text-gray-300 mb-3 leading-relaxed">
                          {request.description}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {request.user_id ? `Usuário ${request.user_id.substring(0, 8)}` : 'Usuário anônimo'}
                        </div>
                        <div>
                          Criado em {formatDate(request.created_at)}
                        </div>
                      </div>

                      {request.admin_notes && (
                        <div className="mt-3 p-3 bg-dark-600/50 rounded-lg">
                          <p className="text-sm text-gray-300">
                            <span className="font-medium">Nota do admin:</span> {request.admin_notes}
                          </p>
                        </div>
                      )}
                    </div>

                    {request.status === 'pending' && (
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => updateRequestStatus(request.id, 'completed')}
                          disabled={actionLoading === request.id}
                          className="flex items-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          <Check className="w-4 h-4" />
                          Aprovar
                        </button>
                        <button
                          onClick={() => setSelectedRequest(request)}
                          disabled={actionLoading === request.id}
                          className="flex items-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                          Rejeitar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-white/10 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-white mb-4">
              Rejeitar Pedido
            </h3>

            <p className="text-gray-300 mb-4">
              Você está prestes a rejeitar o pedido "{selectedRequest.title}".
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const adminNotes = formData.get('adminNotes') as string;
                updateRequestStatus(selectedRequest.id, 'rejected', adminNotes);
              }}
            >
              <textarea
                name="adminNotes"
                placeholder="Motivo da rejeição (opcional)..."
                rows={3}
                className="w-full p-3 bg-dark-700 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none mb-4"
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedRequest(null)}
                  className="flex-1 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white font-medium rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === selectedRequest.id}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                >
                  {actionLoading === selectedRequest.id ? 'Rejeitando...' : 'Rejeitar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}