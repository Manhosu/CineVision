'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import UsersTable from '@/components/tables/UsersTable';
import UserModal from '@/components/modals/UserModal';
import AdminApiService, { User } from '@/services/adminApi';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await AdminApiService.getUsers({
        page,
        limit,
        search: searchTerm || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setUsers(data.users);
      setTotalPages(Math.ceil(data.total / limit));
    } catch (err) {
      setError('Erro ao carregar usuários');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, searchTerm, statusFilter, sortBy, sortOrder]);

  const handleViewUser = (user: User) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleBlockUser = async (userId: string) => {
    if (window.confirm('Tem certeza que deseja bloquear este usuário?')) {
      try {
        await AdminApiService.blockUser(userId);
        await fetchUsers();
      } catch (error) {
        console.error('Error blocking user:', error);
        alert('Erro ao bloquear usuário');
      }
    }
  };

  const handleUnblockUser = async (userId: string) => {
    if (window.confirm('Tem certeza que deseja desbloquear este usuário?')) {
      try {
        await AdminApiService.unblockUser(userId);
        await fetchUsers();
      } catch (error) {
        console.error('Error unblocking user:', error);
        alert('Erro ao desbloquear usuário');
      }
    }
  };

  const handleAdjustBalance = (user: User) => {
    setSelectedUser(user);
    setIsBalanceModalOpen(true);
  };

  const handleSaveBalanceAdjustment = async (adjustmentData: any) => {
    if (!selectedUser) return;

    try {
      setModalLoading(true);
      await AdminApiService.adjustUserBalance(selectedUser.id, {
        amount: adjustmentData.balance_adjustment,
        reason: adjustmentData.adjustment_reason,
      });
      await fetchUsers();
      setIsBalanceModalOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error adjusting balance:', error);
      throw error;
    } finally {
      setModalLoading(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
  };

  const handleCloseBalanceModal = () => {
    setIsBalanceModalOpen(false);
    setSelectedUser(null);
  };

  const handleRefresh = () => {
    fetchUsers();
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-white">Gerenciamento de Usuários</h1>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="btn-secondary flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{loading ? 'Atualizando...' : 'Atualizar'}</span>
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
                placeholder="Nome, email ou username..."
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
                <option value="ACTIVE">Ativo</option>
                <option value="BLOCKED">Bloqueado</option>
                <option value="SUSPENDED">Suspenso</option>
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
                <option value="name:asc">Nome (A-Z)</option>
                <option value="name:desc">Nome (Z-A)</option>
                <option value="last_active_at:desc">Último acesso</option>
                <option value="purchase_count:desc">Mais compras</option>
              </select>
            </div>

            <div className="flex items-end">
              <div className="text-sm text-gray-400">
                Total: {users.length} usuários
              </div>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-300 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Users Table */}
        <UsersTable
          data={users}
          loading={loading}
          onView={handleViewUser}
          onBlock={handleBlockUser}
          onUnblock={handleUnblockUser}
          onAdjustBalance={handleAdjustBalance}
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

        {/* User Details Modal */}
        <UserModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          user={selectedUser}
        />

        {/* Balance Adjustment Modal */}
        <UserModal
          isOpen={isBalanceModalOpen}
          onClose={handleCloseBalanceModal}
          user={selectedUser}
          onSave={handleSaveBalanceAdjustment}
          loading={modalLoading}
        />
      </div>
    </AdminLayout>
  );
}