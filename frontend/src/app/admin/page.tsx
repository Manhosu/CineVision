'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  PlusIcon, 
  FilmIcon, 
  DocumentTextIcon,
  ChartBarIcon,
  CogIcon,
  UserGroupIcon,
  EyeIcon,
  ShoppingCartIcon
} from '@heroicons/react/24/outline';

interface AdminStats {
  totalContent: number;
  totalUsers: number;
  totalRequests: number;
  recentUploads: number;
}

interface ContentItem {
  id: string;
  title: string;
  type: string;
  createdAt: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats>({
    totalContent: 0,
    totalUsers: 0,
    totalRequests: 0,
    recentUploads: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentContent, setRecentContent] = useState<ContentItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    const fetchStats = async () => {
      try {
        setLoading(true);
        
        // Buscar dados reais da API
        const contentResponse = await fetch('http://localhost:3001/api/v1/admin/content');
        const contentData = await contentResponse.json();
        
        // Por enquanto, usar dados básicos até implementar endpoints específicos
        setStats({
          totalContent: contentData.data?.length || 0,
          totalUsers: 0, // Implementar endpoint de usuários
          totalRequests: 0, // Implementar endpoint de solicitações
          recentUploads: 0 // Implementar endpoint de uploads recentes
        });

        setRecentContent(contentData.data || []);
      } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
        // Manter valores zerados em caso de erro
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [mounted]);

  const quickActions = [
    {
      title: 'Adicionar Conteúdo',
      description: 'Upload de novos filmes e séries',
      href: '/admin/content/create',
      icon: PlusIcon,
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      title: 'Gerenciar Uploads',
      description: 'Acompanhar uploads em andamento',
      href: '/admin/upload',
      icon: FilmIcon,
      color: 'bg-green-500 hover:bg-green-600'
    },
    {
      title: 'Solicitações',
      description: 'Ver solicitações de usuários',
      href: '/admin/requests',
      icon: DocumentTextIcon,
      color: 'bg-yellow-500 hover:bg-yellow-600'
    },
    {
      title: 'Compras',
      description: 'Gerenciar compras e vendas',
      href: '/admin/purchases',
      icon: ShoppingCartIcon,
      color: 'bg-red-500 hover:bg-red-600'
    },
    {
      title: 'Configurações',
      description: 'Configurações do sistema',
      href: '/admin/settings',
      icon: CogIcon,
      color: 'bg-purple-500 hover:bg-purple-600'
    }
  ];

  const statCards = [
    {
      title: 'Total de Conteúdo',
      value: stats.totalContent,
      icon: FilmIcon,
      color: 'text-blue-600'
    },
    {
      title: 'Usuários Ativos',
      value: stats.totalUsers,
      icon: UserGroupIcon,
      color: 'text-green-600'
    },
    {
      title: 'Solicitações Pendentes',
      value: stats.totalRequests,
      icon: DocumentTextIcon,
      color: 'text-yellow-600'
    },
    {
      title: 'Visualizações',
      value: stats.recentUploads,
      icon: EyeIcon,
      color: 'text-purple-600'
    }
  ];

  // Evita problemas de hidratação
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Painel Administrativo</h1>
            <p className="text-gray-600">Gerencie conteúdo, usuários e configurações da plataforma</p>
          </div>
          
          {/* Loading skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6">
                <div className="animate-pulse">
                  <div className="h-12 w-12 bg-gray-300 rounded-lg mb-4"></div>
                  <div className="h-4 bg-gray-300 rounded mb-2"></div>
                  <div className="h-8 bg-gray-300 rounded w-16"></div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="animate-pulse">
                <div className="h-6 bg-gray-300 rounded mb-4"></div>
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-4 bg-gray-300 rounded"></div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="animate-pulse">
                <div className="h-6 bg-gray-300 rounded mb-4"></div>
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-4 bg-gray-300 rounded"></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Painel Administrativo
          </h1>
          <p className="text-gray-600 mt-2">
            Gerencie conteúdo, usuários e configurações da plataforma
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((stat, index) => (
            <div key={index} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className={`p-3 rounded-lg ${stat.color} bg-opacity-10`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">
                    {stat.title}
                  </p>
                  {loading ? (
                    <div className="flex items-center">
                      <div className="animate-pulse bg-gray-300 h-8 w-16 rounded"></div>
                    </div>
                  ) : (
                    <p className="text-2xl font-bold text-gray-900">
                      {stat.value}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Ações Rápidas
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {quickActions.map((action, index) => (
              <Link
                key={index}
                href={action.href}
                className="group block"
              >
                <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6">
                  <div className={`inline-flex p-3 rounded-lg ${action.color} transition-colors`}>
                    <action.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="mt-4 text-lg font-medium text-gray-900 group-hover:text-gray-600">
                    {action.title}
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    {action.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              Conteúdo Recente
            </h2>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Carregando...</span>
              </div>
            ) : recentContent.length > 0 ? (
              <div className="space-y-4">
                {recentContent.slice(0, 5).map((content, index) => (
                  <div key={content.id || index} className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <FilmIcon className="h-4 w-4 text-blue-600" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">
                        {content.title || `Conteúdo ${index + 1}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {content.type || 'Tipo não especificado'} • {content.createdAt ? new Date(content.createdAt).toLocaleDateString('pt-BR') : 'Data não disponível'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FilmIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum conteúdo</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Comece adicionando seu primeiro filme ou série.
                </p>
                <div className="mt-6">
                  <Link
                    href="/admin/content/create"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                    Adicionar Conteúdo
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}