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

interface BotMigrationStats {
  new_bot: number;
  old_bot: number;
  total: number;
  migration_rate: number;
  new_bot_username: string;
}

interface BotUserStat {
  id: string;
  username: string;
  display_name: string | null;
  status: string;
  users_count: number;
}

interface BotUserStats {
  bots: BotUserStat[];
  total_all: number;
  total_unique: number;
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
  const [botMigration, setBotMigration] = useState<BotMigrationStats | null>(null);
  const [botMigrationFlash, setBotMigrationFlash] = useState(false);
  const [botUserStats, setBotUserStats] = useState<BotUserStats | null>(null);
  // Igor (07/05): funcionários online em tempo real (last_active_at <10min).
  const [onlineEmployees, setOnlineEmployees] = useState<Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    telegram_username?: string;
    last_active_at: string;
  }>>([]);

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

  // Bot migration stats — poll a cada 3s para atualização quase instantânea
  useEffect(() => {
    if (!mounted || isEmployee) return;
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('access_token') || localStorage.getItem('auth_token'))
      : null;
    if (!token) return;

    const fetchMigration = async () => {
      try {
        const r = await fetch(`${API_URL}/api/v1/admin/stats/bot-migration`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const data: BotMigrationStats = await r.json();
        setBotMigration((prev) => {
          if (prev && (prev.new_bot !== data.new_bot || prev.old_bot !== data.old_bot)) {
            // Flash when numbers change
            setBotMigrationFlash(true);
            setTimeout(() => setBotMigrationFlash(false), 800);
          }
          return data;
        });
      } catch { /* silent */ }
    };

    fetchMigration();
    const interval = setInterval(fetchMigration, 3000);
    return () => clearInterval(interval);
  }, [mounted, isEmployee]);

  // Distribuição de usuários por bot — carrega uma vez no mount, sem polling agressivo
  useEffect(() => {
    if (!mounted || isEmployee) return;
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('access_token') || localStorage.getItem('auth_token'))
      : null;
    if (!token) return;
    fetch(`${API_URL}/api/v1/admin/bots/user-stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setBotUserStats(d); })
      .catch(() => {});
  }, [mounted, isEmployee]);

  // Igor (07/05): poll funcionários online a cada 30s.
  useEffect(() => {
    if (!mounted || isEmployee) return; // só admin/master vê
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('access_token') || localStorage.getItem('auth_token'))
      : null;
    if (!token) return;

    const loadOnline = async () => {
      try {
        const r = await fetch(`${API_URL}/api/v1/admin/employees/online`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const data = await r.json();
          setOnlineEmployees(Array.isArray(data) ? data : []);
        }
      } catch {
        /* silent */
      }
    };

    loadOnline();
    const interval = setInterval(loadOnline, 30000);
    return () => clearInterval(interval);
  }, [mounted, isEmployee]);

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
      title: 'Banner Hero & Carrosséis',
      description: 'Editar conteúdos do banner do topo e ordem dos carrosséis da home',
      href: '/admin/homepage',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      gradient: 'from-cyan-500 to-blue-600',
      shadow: 'shadow-cyan-500/50'
    },
    {
      title: 'Novidades & Nova Temporada',
      description: 'Ativar ou remover badge de Novidade e Nova Temporada dos títulos',
      href: '/admin/releases',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ),
      gradient: 'from-amber-500 to-orange-600',
      shadow: 'shadow-amber-500/50'
    },
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
      title: 'Grupos (Broadcast)',
      description: 'Enviar e apagar mensagens em todos os grupos de uma vez',
      href: '/admin/broadcast-groups',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      gradient: 'from-teal-600 to-emerald-700',
      shadow: 'shadow-teal-500/50'
    },
    {
      title: 'Bots Telegram',
      description: 'Gerenciar bots rotativos de atendimento e entrega',
      href: '/admin/bots',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      gradient: 'from-sky-600 to-blue-700',
      shadow: 'shadow-sky-500/50'
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
    {
      title: 'Minha Produtividade',
      description: 'Ver conteúdos que você adicionou (com gráfico diário)',
      href: '/employee/productivity',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      gradient: 'from-cyan-600 to-blue-700',
      shadow: 'shadow-cyan-500/50',
    },
  ];

  // Hide cards an employee shouldn't see, based on their permissions.
  // Admins see everything. Employees see only what was explicitly enabled.
  const employeeAllowedHrefs = (() => {
    if (!isEmployee) return null; // null = no filtering (admin)
    const allowed = new Set<string>([
      '/admin/content/manage',
      '/admin/my-edit-requests', // employees can always see their own edits
      // Igor (07/05): produtividade própria sempre disponível pra
      // funcionário ver suas stats sem precisar de permissão extra.
      '/employee/productivity',
    ]);
    if (perms?.can_add_movies || perms?.can_add_series) allowed.add('/admin/content/create');
    if (perms?.can_view_users) allowed.add('/admin/users');
    if (perms?.can_view_purchases) allowed.add('/admin/purchases');
    if (perms?.can_view_top10) allowed.add('/admin/top10');
    if (perms?.can_manage_discounts) allowed.add('/admin/discounts');
    if (perms?.can_add_people_photos) allowed.add('/employee/photos');
    return allowed;
  })();

  // Igor (06/05): "Pessoas sem foto" é exclusivamente um workflow de
  // funcionário. Admin tem o /admin/photos-pending pra aprovar, não
  // precisa do card de submissão. Sempre filtra esse card pra admin.
  const adminHiddenHrefs = new Set<string>([
    '/employee/photos',
  ]);

  const filteredQuickActions = employeeAllowedHrefs
    ? quickActions.filter((a) => employeeAllowedHrefs.has(a.href))
    : quickActions.filter((a) => !adminHiddenHrefs.has(a.href));

  const formatMigrationRate = (rate: number) => {
    if (rate === 0) return '0%';
    if (rate < 1) return `${rate.toFixed(2).replace('.', ',')}%`;
    return `${Math.round(rate)}%`;
  };

  // N13 (Igor 04/05): card "Usuários Ativos" só aparece pra admin/moderator
  // ou pra funcionário com can_view_active_users explicitamente true.
  // Default no backend é false, então a maioria dos funcionários não vê.
  const showActiveUsersCard = !isEmployee || perms?.can_view_active_users === true;

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
    ...(showActiveUsersCard
      ? [
          {
            title: 'Usuários Ativos',
            value: botMigration?.new_bot ?? stats.totalUsers,
            icon: (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            ),
            gradient: 'from-green-500 to-emerald-500',
            change: botMigration ? `${formatMigrationRate(botMigration.migration_rate)} migrados` : stats.usersChange || '0%',
          },
        ]
      : []),
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

        {/* Bot Migration Widget — só admin vê */}
        {!isEmployee && botMigration && botMigration.total > 0 && (
          <div className={`mb-8 rounded-xl border p-6 transition-all duration-300 ${
            botMigrationFlash
              ? 'border-emerald-400/60 bg-gradient-to-br from-emerald-900/20 to-blue-900/15 shadow-[0_0_20px_rgba(52,211,153,0.15)]'
              : 'border-blue-500/20 bg-gradient-to-br from-blue-900/10 to-indigo-900/10'
          }`}>
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-white">
              <span className="text-2xl">🤖</span>
              Migração de Bot
              <span className="ml-2 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-semibold text-blue-300">
                @{botMigration.new_bot_username}
              </span>
            </h2>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="mb-1 flex justify-between text-sm text-gray-400">
                <span>Progresso da migração</span>
                <span className="font-bold text-white">{formatMigrationRate(botMigration.migration_rate)}</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-gray-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-700"
                  style={{ width: `${Math.max(botMigration.migration_rate, botMigration.new_bot > 0 ? 0.5 : 0)}%` }}
                />
              </div>
            </div>

            {/* Counters */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-900/20 p-3">
                <p className="text-2xl font-bold text-emerald-400">{botMigration.new_bot.toLocaleString('pt-BR')}</p>
                <p className="mt-0.5 text-xs text-gray-400">Novo bot</p>
              </div>
              <div className="rounded-lg border border-amber-500/20 bg-amber-900/20 p-3">
                <p className="text-2xl font-bold text-amber-400">{botMigration.old_bot.toLocaleString('pt-BR')}</p>
                <p className="mt-0.5 text-xs text-gray-400">Ainda no antigo</p>
              </div>
              <div className="rounded-lg border border-gray-500/20 bg-gray-800/40 p-3">
                <p className="text-2xl font-bold text-white">{botMigration.total.toLocaleString('pt-BR')}</p>
                <p className="mt-0.5 text-xs text-gray-400">Total com Telegram</p>
              </div>
            </div>
          </div>
        )}

        {/* Widget compacto: distribuição de usuários por bot */}
        {!isEmployee && botUserStats && botUserStats.bots.length > 0 && (
          <div className="mb-8 rounded-xl border border-sky-500/20 bg-gradient-to-br from-sky-900/10 to-blue-900/10 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="flex items-center gap-2 text-base font-bold text-white">
                <span className="text-lg">🤖</span>
                Usuários por Bot
                <span className="ml-1 rounded-full bg-sky-500/20 px-2 py-0.5 text-xs font-semibold text-sky-300">
                  {botUserStats.bots.filter(b => b.status !== 'disabled').length} ativos
                </span>
              </h2>
              <a href="/admin/bots" className="text-xs text-sky-400 hover:text-sky-300 transition-colors">
                Ver detalhes →
              </a>
            </div>

            {/* Grid de bots */}
            <div className="flex flex-wrap gap-2 mb-3">
              {botUserStats.bots.map(bot => (
                <div
                  key={bot.id}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ${
                    bot.status === 'banned_br'
                      ? 'border-red-500/20 bg-red-900/15 text-red-300'
                      : bot.status === 'disabled'
                      ? 'border-gray-600/20 bg-gray-800/30 text-gray-500'
                      : 'border-emerald-500/20 bg-emerald-900/15 text-emerald-300'
                  }`}
                >
                  <span className="font-mono font-semibold">@{bot.username}</span>
                  <span className={`font-bold ${
                    bot.status === 'banned_br' ? 'text-red-200' :
                    bot.status === 'disabled' ? 'text-gray-400' : 'text-white'
                  }`}>
                    {(bot.users_count ?? 0).toLocaleString('pt-BR')}
                  </span>
                  {bot.status === 'banned_br' && (
                    <span className="rounded bg-red-500/30 px-1 text-[9px] font-bold uppercase text-red-300">ban</span>
                  )}
                </div>
              ))}
            </div>

            {/* Totais */}
            <div className="flex items-center gap-4 border-t border-white/5 pt-3 text-xs text-gray-400">
              <span>
                Ativos (soma bots ativos):{' '}
                <strong className="text-white">{(botUserStats.total_all ?? 0).toLocaleString('pt-BR')}</strong>
              </span>
              <span className="text-gray-600">·</span>
              <span>
                Únicos rastreados:{' '}
                <strong className="text-sky-300">{(botUserStats.total_unique ?? 0).toLocaleString('pt-BR')}</strong>
              </span>
            </div>
          </div>
        )}

        {/* Real-time Analytics — escondido pra employees sem permissão.
            "Pessoas Online" é considerado dado sensível na ACL do Igor. */}
        {(!isEmployee || perms?.can_view_online_users) && (
          <div className="mb-8">
            <RealtimeAnalytics />
          </div>
        )}

        {/* Igor (07/05 + 08/05): card de funcionários online em tempo real.
            Só admin/master vê — funcionário não vê outros funcionários.
            N27: card sempre visível (mesmo com 0 online) pra Igor saber
            que tá funcionando, com estado vazio claro. */}
        {!isEmployee && (
          <div className="mb-8 rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-900/10 to-cyan-900/10 p-6">
            <h2 className="mb-4 flex items-center text-xl font-bold text-white">
              <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${
                onlineEmployees.length > 0
                  ? 'animate-pulse bg-emerald-400'
                  : 'bg-zinc-500'
              }`} />
              Funcionários Online ({onlineEmployees.length})
            </h2>
            {onlineEmployees.length === 0 ? (
              <div className="rounded-lg border border-white/5 bg-zinc-900/40 p-4 text-sm text-zinc-400">
                Nenhum funcionário ativo nos últimos 10 minutos. Quando alguém
                acessar o painel, aparece aqui em tempo real.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {onlineEmployees.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 rounded-lg border border-white/5 bg-zinc-900/50 p-3"
                  >
                    <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                      {u.name?.[0]?.toUpperCase() || '?'}
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-zinc-900 bg-emerald-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-white">
                        {u.name}
                      </div>
                      <div className="truncate text-xs text-zinc-400">
                        <span className={`mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          u.role === 'admin' || u.role === 'moderator'
                            ? 'bg-purple-500/20 text-purple-300'
                            : 'bg-cyan-500/20 text-cyan-300'
                        }`}>
                          {u.role}
                        </span>
                        {u.telegram_username
                          ? `@${u.telegram_username}`
                          : u.email}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        Ativo {timeAgo(u.last_active_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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

// Igor (07/05): formata "Ativo há X" pra card de funcionários online.
function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 30) return 'agora';
  if (sec < 60) return 'há menos de 1min';
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  return `há ${h}h`;
}
