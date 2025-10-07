'use client';

import { useState, useEffect } from 'react';
import { User } from '@/services/adminApi';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSave?: (userData: any) => Promise<void>;
  loading?: boolean;
}

export default function UserModal({ isOpen, onClose, user, onSave, loading }: UserModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    telegram_username: '',
    status: 'ACTIVE',
    balance_adjustment: 0,
    adjustment_reason: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        telegram_username: user.telegram_username || '',
        status: user.status || 'ACTIVE',
        balance_adjustment: 0,
        adjustment_reason: '',
      });
    } else {
      setFormData({
        name: '',
        email: '',
        telegram_username: '',
        status: 'ACTIVE',
        balance_adjustment: 0,
        adjustment_reason: '',
      });
    }
  }, [user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!onSave) return;

    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving user:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: name === 'balance_adjustment' ? parseFloat(value) || 0 : value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-dark-800 rounded-lg w-full max-w-2xl max-h-screen overflow-y-auto">
        <div className="p-6 border-b border-dark-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">
              {user ? 'Detalhes do Usuário' : 'Novo Usuário'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* User Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Informações Básicas</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nome
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Telegram Username
                </label>
                <input
                  type="text"
                  name="telegram_username"
                  value={formData.telegram_username}
                  onChange={handleInputChange}
                  placeholder="sem @"
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="ACTIVE">Ativo</option>
                  <option value="BLOCKED">Bloqueado</option>
                  <option value="SUSPENDED">Suspenso</option>
                </select>
              </div>
            </div>
          </div>

          {/* User Stats */}
          {user && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Estatísticas</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-dark-700 p-4 rounded-lg">
                  <div className="text-sm text-gray-400">Saldo Atual</div>
                  <div className="text-2xl font-bold text-green-400">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(user.balance || 0)}
                  </div>
                </div>

                <div className="bg-dark-700 p-4 rounded-lg">
                  <div className="text-sm text-gray-400">Total de Compras</div>
                  <div className="text-2xl font-bold text-blue-400">
                    {user.purchase_count || 0}
                  </div>
                </div>

                <div className="bg-dark-700 p-4 rounded-lg">
                  <div className="text-sm text-gray-400">Valor Gasto</div>
                  <div className="text-2xl font-bold text-purple-400">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(user.total_spent || 0)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-dark-700 p-4 rounded-lg">
                  <div className="text-sm text-gray-400">Telegram User ID</div>
                  <div className="text-white font-mono">
                    {user.telegram_user_id || 'N/A'}
                  </div>
                </div>

                <div className="bg-dark-700 p-4 rounded-lg">
                  <div className="text-sm text-gray-400">Último Acesso</div>
                  <div className="text-white">
                    {user.last_active_at
                      ? new Date(user.last_active_at).toLocaleDateString('pt-BR')
                      : 'Nunca'
                    }
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Balance Adjustment */}
          {onSave && (
            <div className="space-y-4 border-t border-dark-700 pt-4">
              <h3 className="text-lg font-semibold text-white">Ajuste de Saldo</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Valor do Ajuste (R$)
                  </label>
                  <input
                    type="number"
                    name="balance_adjustment"
                    value={formData.balance_adjustment}
                    onChange={handleInputChange}
                    step="0.01"
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Valores positivos aumentam o saldo, negativos diminuem
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Motivo do Ajuste
                  </label>
                  <select
                    name="adjustment_reason"
                    value={formData.adjustment_reason}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    <option value="">Selecionar motivo...</option>
                    <option value="refund">Reembolso</option>
                    <option value="bonus">Bônus</option>
                    <option value="correction">Correção</option>
                    <option value="penalty">Penalidade</option>
                    <option value="other">Outro</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-dark-700">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
            >
              {onSave ? 'Cancelar' : 'Fechar'}
            </button>
            {onSave && (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {loading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                <span>Salvar Alterações</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}