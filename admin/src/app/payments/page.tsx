'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import AdminApiService, { Payment, PaginatedResponse } from '@/services/adminApi';
import { format } from 'date-fns';

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [providerFilter, setProviderFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError(null);
      const data: PaginatedResponse<Payment> = await AdminApiService.getPayments(
        page,
        limit,
        statusFilter !== 'ALL' ? statusFilter : undefined,
        providerFilter !== 'ALL' ? providerFilter : undefined
      );
      setPayments(data.payments || []);
      setTotal(data.total);
      setTotalPages(Math.ceil(data.total / limit));
    } catch (err) {
      setError('Erro ao carregar pagamentos');
      console.error('Error fetching payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [page, statusFilter, providerFilter]);

  const handleRetryPayment = async (paymentId: string) => {
    if (!window.confirm('Tem certeza que deseja reprocessar este pagamento?')) return;

    try {
      setActionLoading(paymentId);
      await AdminApiService.retryPayment(paymentId);
      await fetchPayments();
      alert('Pagamento reprocessado com sucesso!');
    } catch (error) {
      console.error('Error retrying payment:', error);
      alert('Erro ao reprocessar pagamento');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefundPayment = async (paymentId: string, amount: number) => {
    const refundAmount = prompt(`Valor do reembolso (máximo: R$ ${(amount / 100).toFixed(2)}):`);
    if (!refundAmount) return;

    const refundCents = Math.round(parseFloat(refundAmount) * 100);
    if (refundCents > amount || refundCents <= 0) {
      alert('Valor inválido para reembolso');
      return;
    }

    const reason = prompt('Motivo do reembolso:');
    if (!reason) return;

    try {
      setActionLoading(paymentId);
      await AdminApiService.refundPayment(paymentId, refundCents, reason);
      await fetchPayments();
      alert('Reembolso processado com sucesso!');
    } catch (error) {
      console.error('Error refunding payment:', error);
      alert('Erro ao processar reembolso');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      completed: { bg: 'bg-green-200', text: 'text-green-800', label: 'Concluído' },
      pending: { bg: 'bg-yellow-200', text: 'text-yellow-800', label: 'Pendente' },
      failed: { bg: 'bg-red-200', text: 'text-red-800', label: 'Falhou' },
      refunded: { bg: 'bg-gray-200', text: 'text-gray-800', label: 'Reembolsado' },
      processing: { bg: 'bg-blue-200', text: 'text-blue-800', label: 'Processando' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const getProviderBadge = (provider: string) => {
    const providerConfig = {
      stripe: { bg: 'bg-purple-200', text: 'text-purple-800', label: 'Stripe' },
      pix: { bg: 'bg-green-200', text: 'text-green-800', label: 'PIX' },
      mercadopago: { bg: 'bg-blue-200', text: 'text-blue-800', label: 'Mercado Pago' },
    };

    const config = providerConfig[provider as keyof typeof providerConfig] || 
                   { bg: 'bg-gray-200', text: 'text-gray-800', label: provider };
    
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
          <h1 className="text-3xl font-bold text-white">Gerenciamento de Pagamentos</h1>
          <div className="flex space-x-3">
            <input
              type="text"
              placeholder="Buscar por email ou ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2 bg-dark-800 text-white border border-dark-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-dark-800 text-white border border-dark-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="ALL">Todos os Status</option>
              <option value="completed">Concluído</option>
              <option value="pending">Pendente</option>
              <option value="failed">Falhou</option>
              <option value="refunded">Reembolsado</option>
              <option value="processing">Processando</option>
            </select>
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="px-4 py-2 bg-dark-800 text-white border border-dark-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="ALL">Todos os Provedores</option>
              <option value="stripe">Stripe</option>
              <option value="pix">PIX</option>
              <option value="mercadopago">Mercado Pago</option>
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-dark-800 p-4 rounded-lg border border-dark-700">
            <p className="text-gray-400 text-sm">Total de Pagamentos</p>
            <p className="text-2xl font-bold text-white">{total}</p>
          </div>
          <div className="bg-dark-800 p-4 rounded-lg border border-dark-700">
            <p className="text-gray-400 text-sm">Concluídos</p>
            <p className="text-2xl font-bold text-green-400">
              {payments.filter(p => p.status === 'completed').length}
            </p>
          </div>
          <div className="bg-dark-800 p-4 rounded-lg border border-dark-700">
            <p className="text-gray-400 text-sm">Pendentes</p>
            <p className="text-2xl font-bold text-yellow-400">
              {payments.filter(p => p.status === 'pending').length}
            </p>
          </div>
          <div className="bg-dark-800 p-4 rounded-lg border border-dark-700">
            <p className="text-gray-400 text-sm">Falharam</p>
            <p className="text-2xl font-bold text-red-400">
              {payments.filter(p => p.status === 'failed').length}
            </p>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-300 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Payments Table */}
        <div className="bg-dark-800 rounded-lg border border-dark-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-300">
              <thead className="text-xs text-gray-400 uppercase bg-dark-700">
                <tr>
                  <th scope="col" className="px-6 py-3">ID</th>
                  <th scope="col" className="px-6 py-3">Usuário</th>
                  <th scope="col" className="px-6 py-3">Conteúdo</th>
                  <th scope="col" className="px-6 py-3">Valor</th>
                  <th scope="col" className="px-6 py-3">Provedor</th>
                  <th scope="col" className="px-6 py-3">Status</th>
                  <th scope="col" className="px-6 py-3">Data</th>
                  <th scope="col" className="px-6 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-400">
                      Carregando pagamentos...
                    </td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-400">
                      Nenhum pagamento encontrado
                    </td>
                  </tr>
                ) : (
                  payments.map((payment) => (
                    <tr key={payment.id} className="border-b border-dark-700 hover:bg-dark-700/50">
                      <td className="px-6 py-4 font-mono text-xs">
                        {payment.id.substring(0, 8)}...
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-white">{payment.purchase?.user?.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-white">{payment.purchase?.content?.title}</p>
                      </td>
                      <td className="px-6 py-4 font-medium text-white">
                        R$ {(payment.amount_cents / 100).toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        {getProviderBadge(payment.provider)}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(payment.status)}
                      </td>
                      <td className="px-6 py-4 text-gray-400">
                        {format(new Date(payment.created_at), 'dd/MM/yyyy HH:mm')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex space-x-2">
                          {payment.status === 'failed' && (
                            <button
                              onClick={() => handleRetryPayment(payment.id)}
                              disabled={actionLoading === payment.id}
                              className="text-blue-400 hover:text-blue-300 disabled:opacity-50"
                            >
                              {actionLoading === payment.id ? '⟳' : 'Reprocessar'}
                            </button>
                          )}
                          {payment.status === 'completed' && (
                            <button
                              onClick={() => handleRefundPayment(payment.id, payment.amount_cents)}
                              disabled={actionLoading === payment.id}
                              className="text-yellow-400 hover:text-yellow-300 disabled:opacity-50"
                            >
                              {actionLoading === payment.id ? '⟳' : 'Reembolsar'}
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
                Mostrando {((page - 1) * limit) + 1} a {Math.min(page * limit, total)} de {total} pagamentos
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-1 bg-dark-700 text-white rounded disabled:opacity-50 hover:bg-dark-600"
                >
                  Anterior
                </button>
                <span className="px-3 py-1 text-gray-400">
                  Página {page} de {totalPages}
                </span>
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