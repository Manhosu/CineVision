'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import Badge from '@/components/ui/Badge';
import Toggle from '@/components/ui/Toggle';
// import AdminApiService, { Order, PaginatedResponse } from '@/services/adminApi';

// Mock data interface for demonstration
interface Order {
  id: string;
  requested_title: string;
  description?: string;
  year?: number;
  imdb_url?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  vote_count: number;
  created_at: string;
  admin_notes?: string;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}

const statusConfig = {
  pending: { variant: 'warning' as const, label: 'Pendente' },
  in_progress: { variant: 'info' as const, label: 'Em Progresso' },
  completed: { variant: 'success' as const, label: 'Concluído' },
  rejected: { variant: 'danger' as const, label: 'Rejeitado' },
  cancelled: { variant: 'default' as const, label: 'Cancelado' },
};

const priorityConfig = {
  low: { variant: 'default' as const, label: 'Baixa', color: 'text-gray-400' },
  medium: { variant: 'warning' as const, label: 'Média', color: 'text-yellow-400' },
  high: { variant: 'primary' as const, label: 'Alta', color: 'text-orange-400' },
  urgent: { variant: 'danger' as const, label: 'Urgente', color: 'text-red-400' },
};

export default function OrdersPage() {
  // Mock data for demonstration
  const mockOrders: Order[] = [
    {
      id: '1',
      requested_title: 'Avengers: Endgame',
      description: 'Último filme dos Vingadores',
      year: 2019,
      imdb_url: 'https://www.imdb.com/title/tt4154796/',
      status: 'pending',
      priority: 'high',
      vote_count: 15,
      created_at: '2024-01-15T10:30:00Z',
      user: {
        id: 'user1',
        email: 'joao@example.com',
        name: 'João Silva'
      }
    },
    {
      id: '2',
      requested_title: 'Dune: Part Two',
      description: 'Continuação do filme Dune',
      year: 2024,
      status: 'in_progress',
      priority: 'urgent',
      vote_count: 23,
      created_at: '2024-01-14T14:20:00Z',
      admin_notes: 'Em processo de aquisição',
      user: {
        id: 'user2',
        email: 'maria@example.com',
        name: 'Maria Santos'
      }
    },
    {
      id: '3',
      requested_title: 'The Batman',
      year: 2022,
      status: 'completed',
      priority: 'medium',
      vote_count: 8,
      created_at: '2024-01-13T09:15:00Z',
      admin_notes: 'Adicionado ao catálogo',
      user: {
        id: 'user3',
        email: 'pedro@example.com'
      }
    },
    {
      id: '4',
      requested_title: 'Spider-Man: No Way Home',
      description: 'Filme do Homem-Aranha com multiverso',
      year: 2021,
      status: 'rejected',
      priority: 'low',
      vote_count: 3,
      created_at: '2024-01-12T16:45:00Z',
      admin_notes: 'Direitos não disponíveis',
      user: {
        id: 'user4',
        email: 'ana@example.com',
        name: 'Ana Costa'
      }
    },
    {
      id: '5',
      requested_title: 'Oppenheimer',
      year: 2023,
      status: 'pending',
      priority: 'medium',
      vote_count: 12,
      created_at: '2024-01-11T11:30:00Z',
      user: {
        id: 'user5',
        email: 'carlos@example.com'
      }
    }
  ];

  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

  // Filter orders based on search and filters
  const filteredOrders = orders.filter(order => {
    const matchesSearch = !searchTerm ||
      order.requested_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.user?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = !statusFilter || order.status === statusFilter;
    const matchesPriority = !priorityFilter || order.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const handleUpdateStatus = (order: Order, newStatus: string) => {
    setOrders(prev => prev.map(o =>
      o.id === order.id
        ? { ...o, status: newStatus as Order['status'] }
        : o
    ));
  };

  const handleMarkAsCompleted = (orderId: string) => {
    setOrders(prev => prev.map(order =>
      order.id === orderId
        ? { ...order, status: 'completed' as const }
        : order
    ));
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

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'in_progress':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      case 'completed':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'rejected':
      case 'cancelled':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
    }
  };

  const getPriorityIcon = (priority: Order['priority']) => {
    switch (priority) {
      case 'urgent':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L15.09 8.26L22 9L17 14L18.18 21L12 17.77L5.82 21L7 14L2 9L8.91 8.26L12 2Z" />
          </svg>
        );
      case 'high':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
          </svg>
        );
      case 'medium':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
          </svg>
        );
      case 'low':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
          </svg>
        );
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-dark-700 rounded w-64 mb-6"></div>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card mb-4">
                <div className="h-20 bg-dark-700 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Gestão de Pedidos</h1>
            <p className="text-gray-400 mt-1">
              Gerencie solicitações de conteúdo dos usuários
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-400">
              {filteredOrders.length} pedidos encontrados
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Buscar por título, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field w-full pl-10"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field w-full"
            >
              <option value="">Todos os Status</option>
              <option value="pending">Pendente</option>
              <option value="in_progress">Em Progresso</option>
              <option value="completed">Concluído</option>
              <option value="rejected">Rejeitado</option>
              <option value="cancelled">Cancelado</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="input-field w-full"
            >
              <option value="">Todas as Prioridades</option>
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>

            <div className="flex items-center text-sm text-gray-400">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
              </svg>
              {filteredOrders.length} resultados
            </div>
          </div>
        </div>

        {/* Orders Grid */}
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const statusConf = statusConfig[order.status];
            const priorityConf = priorityConfig[order.priority];

            return (
              <div
                key={order.id}
                className="bg-dark-800/30 border border-dark-600 rounded-xl p-6 hover:bg-dark-800/50 hover:border-dark-500 transition-all duration-200"
              >
                <div className="flex items-start justify-between">
                  {/* Order Info */}
                  <div className="flex-1">
                    <div className="flex items-start space-x-4">
                      {/* Priority Indicator */}
                      <div className={`flex items-center space-x-2 ${priorityConf.color}`}>
                        {getPriorityIcon(order.priority)}
                        <span className="text-sm font-medium">{priorityConf.label}</span>
                      </div>

                      {/* Main Content */}
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-white">
                            {order.requested_title}
                            {order.year && <span className="text-gray-400 font-normal"> ({order.year})</span>}
                          </h3>
                          <Badge
                            variant={statusConf.variant}
                            icon={getStatusIcon(order.status)}
                            size="sm"
                          >
                            {statusConf.label}
                          </Badge>
                        </div>

                        {order.description && (
                          <p className="text-gray-400 text-sm mb-3">{order.description}</p>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500 mb-1">Solicitado por</p>
                            <p className="text-gray-300">{order.user?.name || order.user?.email || 'Usuário anônimo'}</p>
                            {order.user?.name && order.user?.email && (
                              <p className="text-xs text-gray-500">{order.user.email}</p>
                            )}
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">Votos</p>
                            <div className="flex items-center space-x-2">
                              <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2L15.09 8.26L22 9L17 14L18.18 21L12 17.77L5.82 21L7 14L2 9L8.91 8.26L12 2Z" />
                              </svg>
                              <span className="text-yellow-400 font-medium">{order.vote_count}</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">Data do pedido</p>
                            <p className="text-gray-300">{formatDate(order.created_at)}</p>
                          </div>
                        </div>

                        {order.admin_notes && (
                          <div className="mt-3 p-3 bg-dark-700/50 rounded-lg border border-dark-600">
                            <p className="text-xs text-gray-500 mb-1">Notas do admin:</p>
                            <p className="text-sm text-gray-300">{order.admin_notes}</p>
                          </div>
                        )}

                        {order.imdb_url && (
                          <a
                            href={order.imdb_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-sm text-blue-400 hover:text-blue-300 mt-2"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Ver no IMDb
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-4">
                    {order.status === 'pending' && (
                      <button
                        onClick={() => handleMarkAsCompleted(order.id)}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                        title="Marcar como atendido"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Marcar como Atendido</span>
                      </button>
                    )}

                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedOrder(order);
                          setNewStatus(order.status);
                          setAdminNotes(order.admin_notes || '');
                          setShowModal(true);
                        }}
                        className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded-lg transition-colors"
                        title="Editar pedido"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedOrder(order);
                          setNotificationMessage('');
                          setShowNotificationModal(true);
                        }}
                        className="p-2 text-green-400 hover:text-green-300 hover:bg-green-400/10 rounded-lg transition-colors"
                        title="Notificar usuário"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredOrders.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 bg-dark-700 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-300 mb-2">Nenhum pedido encontrado</h3>
            <p className="text-gray-500">Tente ajustar os filtros de busca.</p>
          </div>
        )}

        {/* Edit Order Modal */}
        {showModal && selectedOrder && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-dark-800 rounded-xl border border-dark-600 w-full max-w-lg">
              <div className="p-6">
                <h3 className="text-xl font-semibold text-white mb-4">
                  Editar Pedido: {selectedOrder.requested_title}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Status
                    </label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="input-field w-full"
                    >
                      <option value="pending">Pendente</option>
                      <option value="in_progress">Em Progresso</option>
                      <option value="completed">Concluído</option>
                      <option value="rejected">Rejeitado</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Notas do Admin
                    </label>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      rows={3}
                      className="input-field w-full resize-none"
                      placeholder="Adicione notas sobre este pedido..."
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setSelectedOrder(null);
                    }}
                    className="btn-secondary"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      if (selectedOrder) {
                        handleUpdateStatus(selectedOrder, newStatus);
                        setOrders(prev => prev.map(o =>
                          o.id === selectedOrder.id
                            ? { ...o, admin_notes: adminNotes }
                            : o
                        ));
                      }
                      setShowModal(false);
                      setSelectedOrder(null);
                    }}
                    className="btn-primary"
                  >
                    Atualizar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notification Modal */}
        {showNotificationModal && selectedOrder && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-dark-800 rounded-xl border border-dark-600 w-full max-w-lg">
              <div className="p-6">
                <h3 className="text-xl font-semibold text-white mb-4">
                  Notificar Usuário: {selectedOrder.user?.email}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Mensagem
                    </label>
                    <textarea
                      value={notificationMessage}
                      onChange={(e) => setNotificationMessage(e.target.value)}
                      rows={4}
                      className="input-field w-full resize-none"
                      placeholder="Digite a mensagem para o usuário..."
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => {
                      setShowNotificationModal(false);
                      setSelectedOrder(null);
                    }}
                    className="btn-secondary"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      // Here you would call the notification API
                      console.log('Sending notification:', notificationMessage);
                      setShowNotificationModal(false);
                      setSelectedOrder(null);
                      setNotificationMessage('');
                    }}
                    disabled={!notificationMessage.trim()}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    <span>Enviar Notificação</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}