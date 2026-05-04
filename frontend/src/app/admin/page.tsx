'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { RealtimeAnalytics } from '@/components/Admin/RealtimeAnalytics';

interface AdminStats {
  totalContent: number;
  totalUsers: number;
  totalRequests: number;
  recentUploads: number;
  contentChange?: string;
  usersChange?: string;
  requestsChange?: string;
  viewsChange?: string;
}

interface ContentItem {
  id: string;
  title: string;
  type: string;
  createdAt: string;
}

interface EmployeePermissions {
  can_add_movies: boolean;
  can_add_series: boolean;
  can_edit_own_content: boolean;
  can_edit_any_content: boolean;
  can_view_users: boolean;
  can_view_purchases: boolean;
  can_view_top10: boolean;
  can_view_online_users: boolean;
  can_view_active_users: boolean;
  can_manage_discounts: boolean;
  can_add_people_photos: boolean;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { logout } = useAuth();
  const [stats, setStats] = useState<AdminStats>({
    totalContent: 0,
    totalUsers: 0,
    totalRequests: 0,
    recentUploads: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentContent, setRecentContent] = useState<ContentItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [perms, setPerms] = useState<EmployeePermissions | null>(null);
  const [isEmployee, setIsEmployee] = useState(false);
  const [pendingEditCount, setPendingEditCount] = useState(0);

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

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const fetchStats = async () => {
      try {
        setLoading(true);

        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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

        // Buscar todas as estatísticas em paralelo
        const [contentRes, usersRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/admin/stats/content`, { headers }),
          fetch(`${API_URL}/api/v1/admin/stats/users`, { headers }),
        ]);

        const contentData = await contentRes.json();
        const usersData = await usersRes.json();

        setStats({
          totalContent: contentData.total || 0,
          totalUsers: usersData.total || 0,
          totalRequests: 0,
          recentUploads: 0,
          contentChange: contentData.contentChange || '0%',
          usersChange: usersData.usersChange || '0%',
          requestsChange: '0%',
          viewsChange: '0%'
        });

        // Buscar conteúdos recentes para a lista
        const recentContentRes = await fetch(`${API_URL}/api/v1/admin/content?limit=5`, { headers });
        const recentContentData = await recentContentRes.json();
        setRecentContent(recentContentData.data || []);
      } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchStats, 30000);

    return () => clearInterval(interval);
  }, [mounted]);

  // Detect if logged user is an employee and fetch their permissions
  useEffect(() => {
    if (!mounted) return;
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('access_token') || localStorage.getItem('auth_token'))
      : null;
    if (!token) return;

    const userJson = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    let role: string | undefined;
    try {
      if (userJson) role = JSON.parse(userJson)?.role;
    } catch {
      /* silent */
    }

    if (role === 'employee') {
      setIsEmployee(true);
      fetch(`${API_URL}/api/v1/admin/employees/me/permissions`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => setPerms(data))
        .catch(() => undefined);
    } else {
      // Admin / moderator: fetch pending edit-request count for the badge
      fetch(`${API_URL}/api/v1/admin/content-edit-requests/pending-count`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : { count: 0 }))
        .then((d) => setPendingEditCount(d?.count || 0))
        .catch(() => undefined);
    }
  }, [mounted]);

  const quickActions = [
    {
      title: 'Gerenciar Conteúdo',
      description: 'Editar e adicionar áudios aos conteúdos',
      href: '/admin/content/manage',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      ),
      gradient: 'from-green-600 to-green-700',
      shadow: 'shadow-green-500/50'
    },
    {
      title: 'Adicionar Conteúdo',
      description: 'Upload de novos filmes e séries',
      href: '/admin/content/create',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
      gradient: 'from-blue-600 to-blue-700',
      shadow: 'shadow-blue-500/50'
    },
    {
      title: 'Gerenciar Usuários',
      description: 'Ver e excluir contas de usuários',
      href: '/admin/users',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      gradient: 'from-purple-600 to-purple-700',
      shadow: 'shadow-purple-500/50'
    },
    {
      title: 'Compras',
      description: 'Gerenciar compras e vendas',
      href: '/admin/purchases',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      gradient: 'from-red-600 to-red-700',
      shadow: 'shadow-red-500/50'
    },
    {
      title: 'Top 10 Semanal',
      description: 'Ranking de vendas semanais',
      href: '/admin/top10',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      gradient: 'from-orange-600 to-amber-700',
      shadow: 'shadow-orange-500/50'
    },
    {
      title: 'Descontos',
      description: 'Gerenciar descontos e promoções relâmpago',
      href: '/admin/discounts',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      ),
      gradient: 'from-pink-600 to-rose-700',
      shadow: 'shadow-pink-500/50'
    },
    {
      title: 'Atores & Diretores',
      description: 'Gerenciar elenco e diretores',
      href: '/admin/people',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      gradient: 'from-cyan-600 to-teal-700',
      shadow: 'shadow-cyan-500/50'
    },
    {
      title: 'Marketing',
      description: 'Enviar mensagens para IDs específicos',
      href: '/admin/broadcast',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
      ),
      gradient: 'from-indigo-600 to-purple-700',
      shadow: 'shadow-indigo-500/50'
    },
    {
      title: 'Carrinho (descontos)',
      description: 'Configurar faixas de desconto progressivo',
      href: '/admin/cart-settings',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4z" />
        </svg>
      ),
      gradient: 'from-emerald-600 to-green-700',
      shadow: 'shadow-emerald-500/50'
    },
    {
      title: 'Recuperar vendas',
      description: 'Monitorar PIX não pago e ofertas de recuperação',
      href: '/admin/pix-recovery',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      gradient: 'from-yellow-600 to-orange-700',
      shadow: 'shadow-yellow-500/50'
    },
    {
      title: 'IA Atendimento',
      description: 'Gerenciar conversas, treinamento e FAQ',
      href: '/admin/ai-chat',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      ),
      gradient: 'from-violet-600 to-fuchsia-700',
      shadow: 'shadow-violet-500/50'
    },
    {
      title: 'Funcionários',
      description: 'Gerenciar contas, permissões e limites',
      href: '/admin/employees',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      gradient: 'from-sky-600 to-blue-700',
      shadow: 'shadow-sky-500/50'
    },
    {
      title: 'Compras órfãs',
      description: 'Recuperar pagamentos web sem Telegram associado',
      href: '/admin/orphan-orders',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l-1 12H6L5 9z" />
        </svg>
      ),
      gradient: 'from-orange-600 to-red-700',
      shadow: 'shadow-orange-500/50'
    },
    {
      title: 'Liberar conteúdo',
      description: 'Dar acesso manual a um usuário',
      href: '/admin/grant-access',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
      gradient: 'from-lime-600 to-green-700',
      shadow: 'shadow-lime-500/50'
    },
    {
      title: pendingEditCount > 0 ? `Edições pendentes (${pendingEditCount})` : 'Edições pendentes',
      description: 'Revisar mudanças propostas por funcionários',
      href: '/admin/edit-requests',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      gradient: 'from-amber-600 to-orange-700',
      shadow: 'shadow-amber-500/50'
    },
    {
      title: 'Minhas edições',
      description: 'Acompanhe edições enviadas para aprovação',
      href: '/admin/my-edit-requests',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      gradient: 'from-teal-600 to-cyan-700',
      shadow: 'shadow-teal-500/50'
    },
    {
      title: 'Fotos pendentes',
      description: 'Aprovar ou rejeitar fotos enviadas por funcionários',
      href: '/admin/photos-pending',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      gradient: 'from-amber-600 to-yellow-700',
      shadow: 'shadow-amber-500/50',
    },
    {
      title: 'Pessoas sem foto',
      description: 'Adicionar fotos a atores e diretores sem foto',
      href: '/employee/photos',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      gradient: 'from-pink-600 to-rose-700',
      shadow: 'shadow-pink-500/50',
    },
  ];

  // Hide cards an employee shouldn't see, based on their permissions.
  // Admins see everything. Employees see only what was explicitly enabled.
  const employeeAllowedHrefs = (() => {
    if (!isEmployee) return null; // null = no filtering (admin)
    const allowed = new Set<string>([
      '/admin/content/manage',
      '/admin/my-edit-requests', // employees can always see their own edits
    ]);
    if (perms?.can_add_movies || perms?.can_add_series) allowed.add('/admin/content/create');
    if (perms?.can_view_users) allowed.add('/admin/users');
    if (perms?.can_view_purchases) allowed.add('/admin/purchases');
    if (perms?.can_view_top10) allowed.add('/admin/top10');
    if (perms?.can_manage_discounts) allowed.add('/admin/discounts');
    if (perms?.can_add_people_photos) allowed.add('/employee/photos');
    return allowed;
  })();

  const filteredQuickActions = employeeAllowedHrefs
    ? quickActions.filter((a) => employeeAllowedHrefs.has(a.href))
    : quickActions;

  const statCards = [
    {
      title: 'Total de Conteúdo',
      value: stats.totalContent,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
        </svg>
      ),
      gradient: 'from-blue-500 to-cyan-500',
      change: stats.contentChange || '0%'
    },
    {
      title: 'Usuários Ativos',
      value: stats.totalUsers,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      gradient: 'from-green-500 to-emerald-500',
      change: stats.usersChange || '0%'
    },
  ];

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-800 rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <div key={i} className="h-32 bg-gray-800 rounded-2xl"></div>
              ))}
            </div>
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
              <h1 className="text-4xl font-bold bg-gradient-to-r from-red-500 via-red-600 to-red-700 bg-clip-text text-transparent mb-2">
                Painel Administrativo
              </h1>
              <p className="text-gray-400 text-lg">
                Gerencie conteúdo, usuários e configurações da plataforma
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {statCards.map((stat, index) => (
            <div
              key={index}
              className="relative bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50 hover:border-gray-600 transition-all duration-300 hover:scale-105 group overflow-hidden"
            >
              {/* Background Gradient Effect */}
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>

              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg`}>
                    {stat.icon}
                  </div>
                  <span className="text-xs font-semibold text-green-400 bg-green-400/10 px-2 py-1 rounded-full">
                    {stat.change}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-400 mb-2">
                  {stat.title}
                </p>
                {loading ? (
                  <div className="animate-pulse bg-gray-700 h-8 w-16 rounded"></div>
                ) : (
                  <p className="text-3xl font-bold text-white">
                    {stat.value}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Real-time Analytics — escondido pra employees sem permissão.
            "Pessoas Online" é considerado dado sensível na ACL do Igor. */}
        {(!isEmployee || perms?.can_view_online_users) && (
          <div className="mb-8">
            <RealtimeAnalytics />
          </div>
        )}

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
            <svg className="w-6 h-6 mr-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Ações Rápidas
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredQuickActions.map((action, index) => (
              <Link
                key={index}
                href={action.href}
                className="group block"
              >
                <div className={`relative bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50 hover:border-gray-600 transition-all duration-300 hover:scale-105 hover:shadow-2xl ${action.shadow} overflow-hidden`}>
                  {/* Animated Background */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 group-hover:opacity-20 transition-opacity duration-300`}></div>

                  <div className="relative z-10">
                    <div className={`inline-flex p-4 rounded-xl bg-gradient-to-br ${action.gradient} shadow-lg mb-4 group-hover:scale-110 transition-transform duration-300`}>
                      {action.icon}
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2 group-hover:text-gray-200">
                      {action.title}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {action.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
