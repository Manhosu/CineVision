'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface User {
  id: string;
  name?: string;
  role: string;
  blocked?: boolean;
  telegram_id: string;
  telegram_username?: string;
  telegram_chat_id?: string;
  created_at: string;
}

interface UserStats {
  totalUsers: number;
  totalAdmins: number;
  totalBlocked: number;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { logout } = useAuth();

  // Data
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'blocked'>('all');

  // Action state
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'block' | 'unblock' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const ITEMS_PER_PAGE = 50;

  const getToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('access_token') || localStorage.getItem('auth_token');
  };

  const getHeaders = () => {
    const token = getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const fetchUsers = useCallback(async (page: number, search: string, tab: 'all' | 'blocked') => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: ITEMS_PER_PAGE.toString(),
      });
      if (search.trim()) params.set('search', search.trim());
      if (tab === 'blocked') params.set('blocked', 'true');

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/users?${params}`,
        { headers: getHeaders() }
      );

      if (response.status === 401) {
        router.push('/admin/login');
        return;
      }

      if (!response.ok) throw new Error(`Erro ao buscar usuarios: ${response.statusText}`);

      const data = await response.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error('Erro ao buscar usuarios:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [router]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/users/stats`,
        { headers: getHeaders() }
      );
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Erro ao buscar estatisticas:', err);
    }
  }, []);

  // Fetch users on page/search/tab change
  useEffect(() => {
    fetchUsers(currentPage, searchTerm, activeTab);
  }, [currentPage, activeTab, fetchUsers]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchUsers(1, searchTerm, activeTab);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch stats once
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleBlockUnblock = async () => {
    if (!actionUserId || !actionType) return;

    try {
      setActionLoading(true);
      const endpoint = actionType === 'block' ? 'block' : 'unblock';
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/users/${actionUserId}/${endpoint}`,
        { method: 'PUT', headers: getHeaders() }
      );

      if (!response.ok) throw new Error(`Erro ao ${actionType === 'block' ? 'bloquear' : 'desbloquear'} usuario`);

      // Update local state
      setUsers(prev => prev.map(u =>
        u.id === actionUserId ? { ...u, blocked: actionType === 'block' } : u
      ));

      // Refresh stats
      fetchStats();

      // If on "blocked" tab and we unblocked, remove from list
      if (activeTab === 'blocked' && actionType === 'unblock') {
        setUsers(prev => prev.filter(u => u.id !== actionUserId));
      }

      setActionUserId(null);
      setActionType(null);
    } catch (err) {
      console.error('Erro:', err);
      alert(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setActionLoading(false);
    }
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

  const getRoleColor = (role: string) => {
    return role === 'admin'
      ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
      : 'bg-blue-500/20 text-blue-300 border-blue-500/30';
  };

  const getRoleName = (role: string) => {
    return role === 'admin' ? 'Admin' : 'Usuario';
  };

  // Build pagination numbers
  const getPaginationNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);

      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="mb-6">
                <button
                  onClick={() => router.push('/admin')}
                  className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Voltar para Admin
                </button>
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-500 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                Gerenciamento de Usuarios
              </h1>
              <p className="text-gray-400 text-lg">
                Gerencie contas de usuarios e permissoes
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700/50 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Home
              </button>
              <button
                onClick={async () => { await logout(); router.push('/'); }}
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Users */}
          <div className="relative bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50 hover:border-gray-600 transition-all duration-300 hover:scale-105 group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-purple-600 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-medium mb-1">Total de Usuarios</p>
                  <p className="text-3xl font-bold text-purple-300">{stats?.totalUsers ?? '-'}</p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Admins */}
          <div className="relative bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50 hover:border-gray-600 transition-all duration-300 hover:scale-105 group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-500 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-medium mb-1">Administradores</p>
                  <p className="text-3xl font-bold text-blue-300">{stats?.totalAdmins ?? '-'}</p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Blocked */}
          <div className="relative bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50 hover:border-gray-600 transition-all duration-300 hover:scale-105 group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-red-600 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-medium mb-1">Bloqueados</p>
                  <p className="text-3xl font-bold text-red-300">{stats?.totalBlocked ?? '-'}</p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-red-500 to-red-600 shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search + Tabs */}
        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            {/* Search */}
            <div className="flex-1 w-full">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar por nome, Telegram ID ou @username..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Tabs */}
            <div className="flex rounded-lg overflow-hidden border border-gray-700/50">
              <button
                onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
                className={`px-5 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'all'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => { setActiveTab('blocked'); setCurrentPage(1); }}
                className={`px-5 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'blocked'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                Banidos
              </button>
            </div>

            {/* Refresh */}
            <button
              onClick={() => { fetchUsers(currentPage, searchTerm, activeTab); fetchStats(); }}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white rounded-lg transition-colors"
            >
              <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Atualizar
            </button>
          </div>
        </div>

        {/* Results info */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-400">
            {total > 0
              ? `Mostrando ${((currentPage - 1) * ITEMS_PER_PAGE) + 1}-${Math.min(currentPage * ITEMS_PER_PAGE, total)} de ${total} usuarios`
              : 'Nenhum usuario encontrado'}
          </p>
        </div>

        {/* Users Table */}
        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 overflow-hidden">
          {loading && users.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 max-w-md mx-auto">
                <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-red-300 mb-2">Erro ao carregar usuarios</h3>
                <p className="text-red-400 mb-4">{error}</p>
                <button
                  onClick={() => fetchUsers(currentPage, searchTerm, activeTab)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Tentar Novamente
                </button>
              </div>
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-lg">
                {searchTerm
                  ? `Nenhum usuario encontrado para "${searchTerm}"`
                  : activeTab === 'blocked'
                    ? 'Nenhum usuario bloqueado'
                    : 'Nenhum usuario encontrado'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900/50 border-b border-gray-700/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Nome</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Telegram ID</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Username</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Funcao</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Criado em</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                      {/* Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                            {(user.name || user.telegram_username || 'U').charAt(0).toUpperCase()}
                          </div>
                          <span className="text-gray-200 font-medium truncate max-w-[200px]">
                            {user.name || user.telegram_username || `User ${user.telegram_id?.slice(-4) || '?'}`}
                          </span>
                        </div>
                      </td>

                      {/* Telegram ID */}
                      <td className="px-6 py-4">
                        <span className="text-gray-200 font-mono text-sm">{user.telegram_id || '-'}</span>
                      </td>

                      {/* Username */}
                      <td className="px-6 py-4">
                        {user.telegram_username ? (
                          <span className="text-blue-400 text-sm">@{user.telegram_username}</span>
                        ) : (
                          <span className="text-gray-500 text-sm italic">-</span>
                        )}
                      </td>

                      {/* Role */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getRoleColor(user.role)}`}>
                          {user.role === 'admin' ? (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          )}
                          {getRoleName(user.role)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        {user.blocked ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/30">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                            Bloqueado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-300 border border-green-500/30">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Ativo
                          </span>
                        )}
                      </td>

                      {/* Created At */}
                      <td className="px-6 py-4 text-gray-400 text-sm whitespace-nowrap">{formatDate(user.created_at)}</td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        {user.blocked ? (
                          <button
                            onClick={() => { setActionUserId(user.id); setActionType('unblock'); }}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-300 text-sm rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                            </svg>
                            Desbloquear
                          </button>
                        ) : (
                          <button
                            onClick={() => { setActionUserId(user.id); setActionType('block'); }}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 text-sm rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                            Bloquear
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 bg-gray-800/50 border border-gray-700/50 text-gray-300 rounded-lg hover:bg-gray-700/50 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {getPaginationNumbers().map((item, idx) =>
              item === '...' ? (
                <span key={`dots-${idx}`} className="px-3 py-2 text-gray-500">...</span>
              ) : (
                <button
                  key={item}
                  onClick={() => setCurrentPage(item as number)}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === item
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800/50 border border-gray-700/50 text-gray-300 hover:bg-gray-700/50 hover:text-white'
                  }`}
                >
                  {item}
                </button>
              )
            )}

            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 bg-gray-800/50 border border-gray-700/50 text-gray-300 rounded-lg hover:bg-gray-700/50 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* Confirmation Modal */}
        {actionUserId && actionType && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <div className="text-center">
                {actionType === 'block' ? (
                  <div className="mx-auto w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                    <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </div>
                ) : (
                  <div className="mx-auto w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                    <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}

                <h3 className="text-xl font-semibold text-white mb-2">
                  {actionType === 'block' ? 'Bloquear Usuario' : 'Desbloquear Usuario'}
                </h3>
                <p className="text-gray-400 mb-2">
                  {actionType === 'block'
                    ? 'Tem certeza que deseja bloquear este usuario?'
                    : 'Tem certeza que deseja desbloquear este usuario?'}
                </p>
                {(() => {
                  const targetUser = users.find(u => u.id === actionUserId);
                  return targetUser ? (
                    <p className="text-sm text-gray-500 mb-6">
                      {targetUser.name || targetUser.telegram_username || targetUser.telegram_id}
                    </p>
                  ) : null;
                })()}

                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => { setActionUserId(null); setActionType(null); }}
                    disabled={actionLoading}
                    className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleBlockUnblock}
                    disabled={actionLoading}
                    className={`px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50 text-white font-medium ${
                      actionType === 'block'
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {actionLoading
                      ? 'Processando...'
                      : actionType === 'block'
                        ? 'Bloquear'
                        : 'Desbloquear'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
