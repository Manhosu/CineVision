'use client';

import { useState } from 'react';
import { User } from '@/services/adminApi';
import { format } from 'date-fns';
import Toggle from '@/components/ui/Toggle';
import Badge from '@/components/ui/Badge';

interface UsersTableProps {
  data: User[];
  loading: boolean;
  onView: (user: User) => void;
  onBlock: (userId: string) => void;
  onUnblock: (userId: string) => void;
  onAdjustBalance: (user: User) => void;
}

export default function UsersTable({
  data,
  loading,
  onView,
  onBlock,
  onUnblock,
  onAdjustBalance
}: UsersTableProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const formatBalance = (balance: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(balance);
  };

  const getStatusVariant = (status: string) => {
    const statusConfig = {
      ACTIVE: { variant: 'success' as const, label: 'Ativo' },
      BLOCKED: { variant: 'danger' as const, label: 'Bloqueado' },
      SUSPENDED: { variant: 'warning' as const, label: 'Suspenso' },
    };

    return statusConfig[status as keyof typeof statusConfig] || statusConfig.ACTIVE;
  };

  const handleToggleUserStatus = async (user: User) => {
    const isActive = user.status === 'ACTIVE';
    if (isActive) {
      await onBlock(user.id);
    } else {
      await onUnblock(user.id);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(data.map(item => item.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedItems(prev => [...prev, userId]);
    } else {
      setSelectedItems(prev => prev.filter(id => id !== userId));
    }
  };

  const handleBulkBlock = () => {
    if (window.confirm(`Deseja bloquear ${selectedItems.length} usuários selecionados?`)) {
      selectedItems.forEach(id => onBlock(id));
      setSelectedItems([]);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-dark-700/30 border border-dark-600 rounded-lg p-4">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-dark-600 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-dark-600 rounded w-3/4"></div>
                    <div className="h-3 bg-dark-600 rounded w-1/2"></div>
                  </div>
                  <div className="flex space-x-2">
                    <div className="h-6 bg-dark-600 rounded w-16"></div>
                    <div className="h-6 bg-dark-600 rounded w-20"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bulk Actions */}
      {selectedItems.length > 0 && (
        <div className="bg-primary-500/10 border border-primary-500/30 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">{selectedItems.length}</span>
            </div>
            <span className="text-white font-medium">
              usuário(s) selecionado(s)
            </span>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleBulkBlock}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
              </svg>
              <span>Bloquear</span>
            </button>
            <button
              onClick={() => setSelectedItems([])}
              className="px-4 py-2 bg-dark-600 hover:bg-dark-500 text-white rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Users Grid */}
      <div className="space-y-4">
        {data.map((user) => {
          const statusConfig = getStatusVariant(user.status);
          const userInitials = (user.name || user.telegram_username || 'N')
            .split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .slice(0, 2);

          return (
            <div
              key={user.id}
              className="bg-dark-800/30 border border-dark-600 rounded-xl p-6 hover:bg-dark-800/50 hover:border-dark-500 transition-all duration-200"
            >
              <div className="flex items-center space-x-4">
                {/* Selection Checkbox */}
                <div className="flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(user.id)}
                    onChange={(e) => handleSelectItem(user.id, e.target.checked)}
                    className="w-4 h-4 rounded border-dark-500 bg-dark-700 text-primary-500 focus:ring-primary-500 focus:ring-offset-dark-800"
                  />
                </div>

                {/* User Avatar */}
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-white font-semibold text-sm">{userInitials}</span>
                  </div>
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-white truncate">
                      {user.name || user.telegram_username || 'Usuário Anônimo'}
                    </h3>
                    <Badge variant={statusConfig.variant} size="sm">
                      {statusConfig.label}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400 mb-1">Email</p>
                      <p className="text-gray-300">{user.email || 'Não informado'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-1">Telegram</p>
                      <p className="text-gray-300">
                        {user.telegram_username ? `@${user.telegram_username}` : 'Não conectado'}
                      </p>
                      {user.telegram_user_id && (
                        <p className="text-xs text-gray-500">ID: {user.telegram_user_id}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-gray-400 mb-1">Saldo</p>
                      <p className="text-green-400 font-semibold">{formatBalance(user.balance || 0)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-1">Compras</p>
                      <p className="text-blue-400 font-semibold">{user.purchase_count || 0}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 text-xs text-gray-500">
                    <div>
                      <span>Último acesso: </span>
                      {user.last_active_at ? format(new Date(user.last_active_at), 'dd/MM/yyyy HH:mm') : 'Nunca'}
                    </div>
                    <div>
                      <span>Registrado em: </span>
                      {format(new Date(user.created_at), 'dd/MM/yyyy')}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex items-center space-x-4">
                  {/* Status Toggle */}
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-400">Ativo</span>
                    <Toggle
                      checked={user.status === 'ACTIVE'}
                      onChange={() => handleToggleUserStatus(user)}
                      size="sm"
                      color={user.status === 'ACTIVE' ? 'success' : 'danger'}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onView(user)}
                      className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded-lg transition-colors"
                      title="Ver detalhes"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onAdjustBalance(user)}
                      className="p-2 text-green-400 hover:text-green-300 hover:bg-green-400/10 rounded-lg transition-colors"
                      title="Ajustar saldo"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
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
      {data.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 bg-dark-700 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-300 mb-2">Nenhum usuário encontrado</h3>
          <p className="text-gray-500">Tente ajustar os filtros de busca ou adicionar novos usuários.</p>
        </div>
      )}
    </div>
  );
}