'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRequirePermission } from '@/hooks/useRequirePermission';

interface Purchase {
  id: string;
  user_id: string;
  content_id: string;
  order_id?: string | null;
  amount_cents: number;
  status: 'pending' | 'paid' | 'COMPLETED' | 'failed' | 'refunded';
  payment_method: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    email: string;
    name?: string;
    telegram_id?: string;
    telegram_username?: string;
  };
  content?: {
    id: string;
    title: string;
    poster_url?: string;
  };
}

interface PurchaseStats {
  total_purchases: number;
  total_revenue_cents: number;
  pending_purchases: number;
  paid_purchases: number;
  failed_purchases: number;
  refunded_purchases: number;
}

export default function AdminPurchasesPage() {
  const permCheck = useRequirePermission('can_view_purchases');
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [stats, setStats] = useState<PurchaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // Igor (11/07): chips de filtro rápido de data (24h / 7d / 30d).
  const [dateRange, setDateRange] = useState<'all' | '24h' | '7d' | '30d' | 'custom'>('all');
  const applyDateRange = (r: 'all' | '24h' | '7d' | '30d' | 'custom') => {
    setDateRange(r);
    setCurrentPage(1);
    if (r === 'all') { setDateFrom(''); setDateTo(''); return; }
    if (r === 'custom') return;
    const now = new Date();
    const days = ({ '24h': 1, '7d': 7, '30d': 30 } as const)[r];
    const from = new Date(now); from.setDate(now.getDate() - days);
    setDateFrom(from.toISOString().slice(0, 10));
    setDateTo(now.toISOString().slice(0, 10));
  };
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [groupByOrder, setGroupByOrder] = useState(true);
  const router = useRouter();

  // B4 (Igor pediu) — agrupar purchases pela order_id quando o cliente
  // comprou um pacote. Cada grupo vira 1 linha "header" com total de
  // itens e valor; expand mostra os itens. Purchases avulsas (sem
  // order_id, ex: compra direta antiga) ficam soltas no nível raiz.
  type Group =
    | { type: 'group'; orderId: string; purchases: Purchase[]; total: number }
    | { type: 'single'; purchase: Purchase };

  const groupedPurchases: Group[] = (() => {
    if (!groupByOrder) return purchases.map((p) => ({ type: 'single', purchase: p }));
    const byOrder = new Map<string, Purchase[]>();
    const singles: Purchase[] = [];
    for (const p of purchases) {
      if (p.order_id) {
        if (!byOrder.has(p.order_id)) byOrder.set(p.order_id, []);
        byOrder.get(p.order_id)!.push(p);
      } else {
        singles.push(p);
      }
    }
    const groups: Group[] = [];
    for (const [orderId, list] of byOrder.entries()) {
      if (list.length === 1) {
        groups.push({ type: 'single', purchase: list[0] });
      } else {
        const total = list.reduce((sum, p) => sum + p.amount_cents, 0);
        groups.push({ type: 'group', orderId, purchases: list, total });
      }
    }
    for (const p of singles) groups.push({ type: 'single', purchase: p });
    // ordena por created_at DESC do primeiro item do grupo
    groups.sort((a, b) => {
      const aDate = a.type === 'group' ? a.purchases[0].created_at : a.purchase.created_at;
      const bDate = b.type === 'group' ? b.purchases[0].created_at : b.purchase.created_at;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
    return groups;
  })();

  const toggleOrder = (orderId: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const fetchPurchases = async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
      });

      // Get token from localStorage (access_token or auth_token for compatibility)
      const token = typeof window !== 'undefined'
        ? (localStorage.getItem('access_token') || localStorage.getItem('auth_token'))
        : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/purchases/orders?${params}`,
        {
          headers,
          credentials: 'include',
        }
      );

      if (response.status === 401) {
        router.push('/admin/login');
        return;
      }

      if (!response.ok) {
        throw new Error('Erro ao carregar compras');
      }

      const data = await response.json();
      setPurchases(data.purchases || []);
      setCurrentPage(data.currentPage || 1);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar compras');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Get token from localStorage (access_token or auth_token for compatibility)
      const token = typeof window !== 'undefined'
        ? (localStorage.getItem('access_token') || localStorage.getItem('auth_token'))
        : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const statsParams = new URLSearchParams({
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
      });
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/purchases/stats?${statsParams}`,
        {
          headers,
          credentials: 'include',
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err);
    }
  };

  useEffect(() => {
    fetchPurchases(currentPage);
  }, [currentPage, searchTerm, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchStats();
  }, [dateFrom, dateTo]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
      case 'COMPLETED':
        return 'bg-green-900/20 text-green-400 border-green-800/30';
      case 'pending':
        return 'bg-yellow-900/20 text-yellow-400 border-yellow-800/30';
      case 'failed':
        return 'bg-red-900/20 text-red-400 border-red-800/30';
      case 'refunded':
        return 'bg-gray-900/20 text-gray-400 border-gray-800/30';
      default:
        return 'bg-blue-900/20 text-blue-400 border-blue-800/30';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid':
      case 'COMPLETED':
        return 'PAGO';
      case 'pending':
        return 'Pendente';
      case 'failed':
        return 'Falhou';
      case 'refunded':
        return 'Reembolsado';
      default:
        return status;
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(cents / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (permCheck.loading || !permCheck.allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        Verificando permissões...
      </div>
    );
  }

  if (loading && purchases.length === 0) {
    return (
      <div className="min-h-screen bg-dark-950">
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex items-center space-x-3">
            <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full"></div>
            <span className="text-white text-lg">Carregando compras...</span>
          </div>
        </div>
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
                  onClick={() => router.back()}
                  className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Voltar para Admin
                </button>
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-red-500 via-red-600 to-red-700 bg-clip-text text-transparent mb-2">
                Gerenciar Compras
              </h1>
              <p className="text-gray-400 text-lg">
                Acompanhe vendas, receitas e status de pagamentos
              </p>
            </div>
          </div>
        </div>
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="relative bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50 hover:border-gray-600 transition-all duration-300 hover:scale-105 group overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-500 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
              <div className="relative z-10">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400 mb-2">Total de Compras</p>
                  <p className="text-3xl font-bold text-white">{stats.total_purchases}</p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
              </div>
              </div>
            </div>

            <div className="relative bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50 hover:border-gray-600 transition-all duration-300 hover:scale-105 group overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
              <div className="relative z-10">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400 mb-2">Receita Total</p>
                  <p className="text-3xl font-bold text-white">{formatCurrency(stats.total_revenue_cents)}</p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
              </div>
              </div>
            </div>

            <div className="relative bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50 hover:border-gray-600 transition-all duration-300 hover:scale-105 group overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
              <div className="relative z-10">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400 mb-2">Compras Pagas</p>
                  <p className="text-3xl font-bold text-white">{stats.paid_purchases}</p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              </div>
            </div>

            <div className="relative bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50 hover:border-gray-600 transition-all duration-300 hover:scale-105 group overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500 to-orange-500 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
              <div className="relative z-10">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400 mb-2">Pendentes</p>
                  <p className="text-3xl font-bold text-white">{stats.pending_purchases}</p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar por usuário, email ou filme..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-dark-700 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="md:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-3 bg-dark-700 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">Todos os Status</option>
                <option value="paid">Pago</option>
                <option value="pending">Pendente</option>
                <option value="failed">Falhou</option>
                <option value="refunded">Reembolsado</option>
              </select>
            </div>
            {/* Igor (11/07): chips de filtro rápido de data */}
            <div className="flex flex-wrap items-center gap-2">
              {([
                { v: 'all', l: 'Todos' },
                { v: '24h', l: '24h' },
                { v: '7d', l: '7 dias' },
                { v: '30d', l: '30 dias' },
              ] as const).map((chip) => (
                <button
                  key={chip.v}
                  onClick={() => applyDateRange(chip.v)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    dateRange === chip.v
                      ? 'bg-primary-500/20 border-primary-500 text-primary-200'
                      : 'bg-dark-700 border-white/10 text-gray-300 hover:bg-dark-600'
                  }`}
                >
                  {chip.l}
                </button>
              ))}
            </div>

            {/* Date Range Filter */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400">De:</label>
                <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setDateRange('custom'); setCurrentPage(1); }}
                  className="px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400">Até:</label>
                <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setDateRange('custom'); setCurrentPage(1); }}
                  className="px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              {(dateFrom || dateTo) && (
                <button onClick={() => applyDateRange('all')}
                  className="px-3 py-2 bg-red-600/20 text-red-400 rounded-lg text-sm hover:bg-red-600/30 transition-colors">
                  Limpar datas
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Purchases Table */}
        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 overflow-hidden">
          {purchases.length === 0 ? (
            <div className="p-12 text-center">
              <h3 className="text-lg font-medium text-white mb-2">Nenhuma compra encontrada</h3>
              <p className="text-gray-400">
                {searchTerm || statusFilter !== 'all'
                  ? 'Tente ajustar os filtros de busca'
                  : 'Ainda não há compras registradas'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-dark-900/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Compra
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Usuário
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Filme
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Valor
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Data
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {groupedPurchases.map((g) => {
                    if (g.type === 'single') {
                      const purchase = g.purchase;
                      return (
                        <tr key={purchase.id} className="hover:bg-dark-700/30 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm">
                              <div className="text-white font-medium">#{purchase.id.slice(-8)}</div>
                              {purchase.payment_method && purchase.payment_method !== 'unknown' && (
                                <div className="text-gray-400 capitalize">{purchase.payment_method}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm">
                              <div className="text-white">{purchase.user?.name || 'N/A'}</div>
                              {purchase.user?.telegram_id && (
                                <div className="text-xs mt-1">
                                  {purchase.user.telegram_username ? (
                                    <div className="text-blue-400 font-medium">
                                      📱 @{purchase.user.telegram_username}
                                    </div>
                                  ) : (
                                    <div className="text-gray-500 font-mono">
                                      📱 ID: {purchase.user.telegram_id}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {purchase.content?.poster_url && (
                                <img
                                  src={purchase.content.poster_url}
                                  alt={purchase.content.title}
                                  className="w-10 h-14 object-cover rounded mr-3"
                                />
                              )}
                              <div className="text-sm">
                                <div className="text-white font-medium">{purchase.content?.title || 'N/A'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-white font-medium">
                              {formatCurrency(purchase.amount_cents)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(purchase.status)}`}>
                              {getStatusLabel(purchase.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                            {formatDate(purchase.created_at)}
                          </td>
                        </tr>
                      );
                    }

                    // Group header + (optionally) expanded items
                    const first = g.purchases[0];
                    const isOpen = expandedOrders.has(g.orderId);
                    return (
                      <>
                        <tr
                          key={g.orderId}
                          className="cursor-pointer bg-blue-500/5 hover:bg-blue-500/10 transition-colors"
                          onClick={() => toggleOrder(g.orderId)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm">
                              <div className="text-white font-medium">
                                {isOpen ? '▼' : '▶'} Pacote #{g.orderId.slice(-8)}
                              </div>
                              <div className="text-blue-400 text-xs">
                                {g.purchases.length} itens
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm">
                              <div className="text-white">{first.user?.name || 'N/A'}</div>
                              {first.user?.telegram_username && (
                                <div className="text-blue-400 text-xs font-medium">📱 @{first.user.telegram_username}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-zinc-400">
                            {g.purchases.slice(0, 3).map((p) => p.content?.title || '?').join(', ')}
                            {g.purchases.length > 3 && ` +${g.purchases.length - 3}`}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-white font-bold">
                              {formatCurrency(g.total)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(first.status)}`}>
                              {getStatusLabel(first.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                            {formatDate(first.created_at)}
                          </td>
                        </tr>
                        {isOpen &&
                          g.purchases.map((p) => (
                            <tr key={p.id} className="bg-dark-900/40">
                              <td className="px-6 py-3 pl-12 text-xs text-zinc-500">
                                ↳ #{p.id.slice(-8)}
                              </td>
                              <td className="px-6 py-3"></td>
                              <td className="px-6 py-3">
                                <div className="flex items-center text-sm">
                                  {p.content?.poster_url && (
                                    <img
                                      src={p.content.poster_url}
                                      alt={p.content.title}
                                      className="w-8 h-12 object-cover rounded mr-2"
                                    />
                                  )}
                                  <div className="text-zinc-300">{p.content?.title || 'N/A'}</div>
                                </div>
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-sm text-zinc-400">
                                {formatCurrency(p.amount_cents)}
                              </td>
                              <td className="px-6 py-3"></td>
                              <td className="px-6 py-3"></td>
                            </tr>
                          ))}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}
              className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm">
              Anterior
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
              .reduce<(number | string)[]>((acc, page, idx, arr) => {
                if (idx > 0 && page - (arr[idx - 1] as number) > 1) acc.push('...');
                acc.push(page);
                return acc;
              }, [])
              .map((item, idx) =>
                item === '...' ? (
                  <span key={`dots-${idx}`} className="px-2 text-white/30">...</span>
                ) : (
                  <button key={item} onClick={() => setCurrentPage(item as number)}
                    className={`min-w-[40px] h-10 rounded-lg text-sm font-medium transition-all ${
                      currentPage === item ? 'bg-red-600 text-white' : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white'
                    }`}>
                    {item}
                  </button>
                )
              )}
            <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}
              className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm">
              Próxima
            </button>
          </div>
        )}
      </div>
    </div>
  );
}