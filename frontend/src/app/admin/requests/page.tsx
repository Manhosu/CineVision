'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Clock, CheckCircle, XCircle, AlertCircle, Calendar, User as UserIcon } from 'lucide-react';

interface ContentRequest {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  user_id?: string;
  telegram_user_id?: string;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

interface RequestStats {
  total: number;
}

export default function AdminRequestsPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [stats, setStats] = useState<RequestStats>({
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ContentRequest | null>(null);
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('');
  const [adminNotes, setAdminNotes] = useState<string>('');

  useEffect(() => {
    fetchRequests();
    fetchStats();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      const response = await fetch(`${apiUrl}/api/v1/admin/requests?page=1&limit=100`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        throw new Error(`Erro ao buscar pedidos: ${response.statusText}`);
      }

      const data = await response.json();
      setRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch (err) {
      console.error('Erro ao buscar pedidos:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      const response = await fetch(`${apiUrl}/api/v1/admin/requests?page=1&limit=1`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats({ total: data.pagination?.total || 0 });
      }
    } catch (err) {
      console.error('Erro ao buscar estatísticas:', err);
    }
  };

  const handleUpdateRequest = async () => {
    if (!selectedRequest || !newStatus) return;

    try {
      setUpdating(true);
      const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      const response = await fetch(
        `${apiUrl}/api/v1/admin/requests/${selectedRequest.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: newStatus,
            admin_notes: adminNotes,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao atualizar pedido');
      }

      await fetchRequests();
      await fetchStats();
      setSelectedRequest(null);
      setNewStatus('');
      setAdminNotes('');

      // Show success message if status is completed
      if (newStatus === 'completed') {
        alert('Pedido marcado como concluído! Uma notificação foi enviada ao cliente via Telegram.');
      }
    } catch (err) {
      console.error('Erro ao atualizar pedido:', err);
      alert('Erro ao atualizar pedido. Tente novamente.');
    } finally {
      setUpdating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const handleGoHome = () => {
    router.push('/');
  };

  const handleBackToDashboard = () => {
    router.push('/admin');
  };

  const getStatusConfig = (status: string) => {
    const configs = {
      pending: {
        color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
        icon: Clock,
        text: 'Pendente',
      },
      in_progress: {
        color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        icon: AlertCircle,
        text: 'Em Progresso',
      },
      completed: {
        color: 'bg-green-500/20 text-green-300 border-green-500/30',
        icon: CheckCircle,
        text: 'Concluído',
      },
      rejected: {
        color: 'bg-red-500/20 text-red-300 border-red-500/30',
        icon: XCircle,
        text: 'Rejeitado',
      },
      cancelled: {
        color: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
        icon: XCircle,
        text: 'Cancelado',
      },
    };
    return configs[status as keyof typeof configs] || configs.pending;
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: 'text-gray-400',
      medium: 'text-blue-400',
      high: 'text-orange-400',
      urgent: 'text-red-400',
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="mb-6">
                <button
                  onClick={handleBackToDashboard}
                  className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Voltar para Admin
                </button>
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-500 via-yellow-600 to-orange-600 bg-clip-text text-transparent mb-2">
                Gerenciar Pedidos
              </h1>
              <p className="text-gray-400 text-lg">
                Visualize e gerencie solicitações de conteúdo dos usuários
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleGoHome}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700/50 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Home
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sair
              </button>
            </div>
          </div>
        </div>
        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-xl">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-6 mb-8 max-w-xs">
          <div className="relative bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50 hover:border-gray-600 transition-all duration-300 hover:scale-105 group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500 to-orange-500 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
            <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
                  {stats.total}
                </p>
                <p className="text-sm text-gray-400 mt-1">Total de Pedidos</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 shadow-lg">
                <Calendar className="w-6 h-6 text-white" />
              </div>
            </div>
            </div>
          </div>
        </div>

        {/* Requests List */}
        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 overflow-hidden">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-xl font-bold text-white">Lista de Pedidos</h2>
            <p className="text-sm text-gray-400 mt-1">
              {requests.length} {requests.length === 1 ? 'pedido encontrado' : 'pedidos encontrados'}
            </p>
          </div>

          {requests.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">Nenhum pedido encontrado</p>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {requests.map((request) => {
                const statusConfig = getStatusConfig(request.status);
                const StatusIcon = statusConfig.icon;

                return (
                  <div
                    key={request.id}
                    className="p-6 hover:bg-dark-700/30 transition-all duration-200 cursor-pointer"
                    onClick={() => {
                      setSelectedRequest(request);
                      setNewStatus(request.status);
                      setAdminNotes(request.admin_notes || '');
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-white">{request.title}</h3>
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${statusConfig.color}`}
                          >
                            <StatusIcon className="w-3.5 h-3.5" />
                            {statusConfig.text}
                          </span>
                          <span className={`text-xs font-medium ${getPriorityColor(request.priority)}`}>
                            {request.priority.toUpperCase()}
                          </span>
                        </div>

                        {request.description && (
                          <p className="text-gray-300 mb-3 text-sm leading-relaxed">{request.description}</p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <div className="flex items-center gap-1">
                            <UserIcon className="w-3.5 h-3.5" />
                            {request.telegram_user_id ? `Telegram ID: ${request.telegram_user_id}` : 'Anônimo'}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDate(request.created_at)}
                          </div>
                        </div>

                        {request.admin_notes && (
                          <div className="mt-3 p-3 bg-dark-600/50 rounded-lg border border-white/5">
                            <p className="text-sm text-gray-300">
                              <span className="font-medium text-primary-400">Nota do Admin:</span> {request.admin_notes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Update Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Atualizar Pedido</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full bg-dark-700 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="pending">Pendente</option>
                  <option value="in_progress">Em Progresso</option>
                  <option value="completed">Concluído</option>
                  <option value="rejected">Rejeitado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Notas do Admin</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={4}
                  className="w-full bg-dark-700 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  placeholder="Adicione observações sobre este pedido..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setSelectedRequest(null)}
                disabled={updating}
                className="flex-1 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-all duration-200 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdateRequest}
                disabled={updating}
                className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-all duration-200 disabled:opacity-50"
              >
                {updating ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
