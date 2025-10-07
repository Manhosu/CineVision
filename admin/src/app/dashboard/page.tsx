'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import StatsCard from '@/components/charts/StatsCard';
import TopContentChart from '@/components/charts/TopContentChart';
import { LazyRevenueChart, LazyUserAnalyticsChart, LazyRealTimeMetrics } from '@/components/ui/LazyChart';
import AdminApiService, { MetricsResponse } from '@/services/adminApi';
import { format } from 'date-fns';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('30d');

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await AdminApiService.getMetrics(selectedPeriod);
      setMetrics(data);
    } catch (err) {
      setError('Erro ao carregar métricas');
      console.error('Error fetching metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    // Auto refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [selectedPeriod]);

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
  };

  // Prepare user analytics data
  const userAnalyticsData = metrics?.user_analytics || [];
  const userStatusData = [
    { name: 'Ativos', value: metrics?.active_users_count || 0, color: '#10B981' },
    { name: 'Novos', value: metrics?.new_users_count || 0, color: '#3B82F6' },
    { name: 'Bloqueados', value: metrics?.blocked_users_count || 0, color: '#EF4444' },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <div className="flex items-center space-x-4">
            <select
              value={selectedPeriod}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="px-4 py-2 bg-dark-800 text-white border border-dark-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="90d">Últimos 90 dias</option>
              <option value="month">Este mês</option>
              <option value="year">Este ano</option>
            </select>
            <p className="text-gray-400">{format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
            <button
              onClick={fetchMetrics}
              className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              disabled={loading}
            >
              {loading ? '⟳' : '↻'} Atualizar
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-300 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Real-Time Metrics */}
        <LazyRealTimeMetrics loading={loading} />

        {/* Main Stats Grid */}
        <div className="stats-grid">
          <StatsCard
            title="Total Usuários"
            value={metrics?.total_users || 0}
            loading={loading}
            color="info"
            change={{
              value: 12.5,
              type: 'increase'
            }}
            description="Usuários cadastrados na plataforma"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
          />

          <StatsCard
            title="Total Conteúdo"
            value={metrics?.total_content || 0}
            loading={loading}
            color="purple"
            change={{
              value: 8.2,
              type: 'increase'
            }}
            description="Filmes e séries disponíveis"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h4a1 1 0 011 1v2m0 0V3a1 1 0 011 1v2.586A1 1 0 0114.293 7L16 8.707A1 1 0 0117.414 8L19 6.414A1 1 0 0120.707 7L22 8.293A1 1 0 0122 9v9a3 3 0 01-3 3H5a3 3 0 01-3-3V9a1 1 0 01.293-.707L4 6.586A1 1 0 015.414 6L7 7.414A1 1 0 008.293 7L10 5.586A1 1 0 0010 5V4z" />
              </svg>
            }
          />

          <StatsCard
            title="Receita Total"
            value={metrics?.total_revenue || 0}
            loading={loading}
            color="success"
            change={{
              value: 23.1,
              type: 'increase'
            }}
            description="Vendas acumuladas"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            }
          />

          <StatsCard
            title="Streams Ativos"
            value={metrics?.concurrent_streams || 0}
            loading={loading}
            color="primary"
            change={{
              value: 5.7,
              type: 'decrease'
            }}
            description="Usuários assistindo agora"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            }
          />
        </div>

        {/* Secondary Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatsCard
            title="Compras Ativas"
            value={metrics?.active_purchases || 0}
            loading={loading}
            color="warning"
            change={{
              value: 15.3,
              type: 'increase'
            }}
            description="Transações em andamento"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            }
          />

          <StatsCard
            title="Taxa de Conversão"
            value={`${(metrics?.conversion_rate || 0).toFixed(1)}%`}
            loading={loading}
            color="success"
            change={{
              value: 3.2,
              type: 'increase'
            }}
            description="Visitantes que compraram"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
          />

          <StatsCard
            title="Storage"
            value={`${(metrics?.storage_usage_gb || 0).toFixed(1)}GB`}
            loading={loading}
            color="info"
            change={{
              value: 7.8,
              type: 'increase'
            }}
            description="Espaço utilizado em disco"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
            }
          />
        </div>

        {/* User Analytics */}
        <LazyUserAnalyticsChart
          data={userAnalyticsData}
          statusData={userStatusData}
          loading={loading}
        />

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Chart */}
          <div className="lg:col-span-2 card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Receita ao Longo do Tempo</h2>
              <div className="text-sm text-gray-400">
                Última atualização: {format(new Date(), 'HH:mm')}
              </div>
            </div>
            <LazyRevenueChart
              data={metrics?.revenue_series || []}
              loading={loading}
            />
          </div>

          {/* Top Content */}
          <div className="card">
            <TopContentChart
              data={metrics?.top_content || []}
              loading={loading}
            />
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4">Pagamentos</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Bem-sucedidos</span>
                <span className="text-green-400 font-semibold">
                  {metrics?.successful_payments || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Falharam</span>
                <span className="text-red-400 font-semibold">
                  {metrics?.failed_payments || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Pendentes</span>
                <span className="text-yellow-400 font-semibold">
                  {metrics?.pending_payments || 0}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4">Usuários</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Novos usuários</span>
                <span className="text-blue-400 font-semibold">
                  {metrics?.new_users_count || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Usuários ativos</span>
                <span className="text-green-400 font-semibold">
                  {metrics?.active_users_count || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Bloqueados</span>
                <span className="text-red-400 font-semibold">
                  {metrics?.blocked_users_count || 0}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4">Performance</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Taxa de erro</span>
                <span className="text-red-400 font-semibold">
                  {(metrics?.error_rate || 0).toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Duração média</span>
                <span className="text-blue-400 font-semibold">
                  {Math.floor((metrics?.average_session_duration || 0) / 60)}m
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Reembolsos</span>
                <span className="text-yellow-400 font-semibold">
                  R$ {(metrics?.refunded_amount || 0).toFixed(0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}