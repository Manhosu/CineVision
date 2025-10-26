'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/Header/Header';
import { Footer } from '@/components/Footer/Footer';
import { MovieCard } from '@/components/MovieCard/MovieCard';
import { LoadingSkeleton } from '@/components/LoadingSkeleton/LoadingSkeleton';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';

interface Purchase {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  content: {
    id: string;
    title: string;
    description: string;
    poster_url: string;
    duration_minutes: number;
    release_year: number;
    imdb_rating: number;
    genres: string[];
  };
}

interface ContentRequest {
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
  admin_notes?: string;
}

export default function DashboardPage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'content' | 'purchases' | 'requests' | 'favorites'>('content');
  const [myContent, setMyContent] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Redirecionar se não autenticado
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Buscar dados do usuário
  useEffect(() => {
    if (!user) return;

    const fetchUserData = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem('auth_token');

        // Buscar conteúdo adquirido
        const contentRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/purchases/user/${user.id}/content`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (contentRes.ok) {
          const contentData = await contentRes.json();
          console.log('[Dashboard] Content data from API:', contentData);
          console.log('[Dashboard] First item:', contentData[0]);
          setMyContent(contentData);
        }

        // Buscar histórico de compras
        const purchasesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/purchases/user/${user.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (purchasesRes.ok) {
          const purchasesData = await purchasesRes.json();
          setPurchases(purchasesData);
        }

        // Buscar solicitações do usuário
        const requestsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/requests/user/${user.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (requestsRes.ok) {
          const requestsData = await requestsRes.json();
          setRequests(requestsData);
        }

        // Buscar favoritos do usuário
        const favoritesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/favorites`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (favoritesRes.ok) {
          const favoritesData = await favoritesRes.json();
          setFavorites(favoritesData);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        toast.error('Erro ao carregar seus dados');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();

    // Subscribe to real-time updates for requests
    const requestsSubscription = supabase
      .channel('user-requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'content_requests',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Request updated:', payload);
          // Atualizar lista de requests
          if (payload.eventType === 'INSERT') {
            setRequests(prev => [payload.new as ContentRequest, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setRequests(prev =>
              prev.map(req => req.id === payload.new.id ? payload.new as ContentRequest : req)
            );
            toast.success('Status da solicitação atualizado!');
          } else if (payload.eventType === 'DELETE') {
            setRequests(prev => prev.filter(req => req.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      requestsSubscription.unsubscribe();
    };
  }, [user]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-dark-950">
        <Header />
        <div className="container mx-auto px-4 lg:px-6 py-12">
          <LoadingSkeleton type="section" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null; // Vai redirecionar
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-500/20 text-yellow-400', text: 'Pendente' },
      approved: { color: 'bg-green-500/20 text-green-400', text: 'Aprovado' },
      completed: { color: 'bg-blue-500/20 text-blue-400', text: 'Concluído' },
      rejected: { color: 'bg-red-500/20 text-red-400', text: 'Rejeitado' },
      paid: { color: 'bg-green-500/20 text-green-400', text: 'Pago' },
      failed: { color: 'bg-red-500/20 text-red-400', text: 'Falhou' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-dark-950">
      <Header />

      <div className="container mx-auto px-4 lg:px-6 py-12 mt-20">
        {/* Header do Dashboard */}
        <div className="mb-8 bg-gradient-to-r from-red-900/20 to-purple-900/20 rounded-xl p-6 border border-red-500/20">
          <h1 className="text-4xl font-bold text-white mb-3">🎬 Meu Dashboard</h1>
          <div className="flex flex-col gap-2">
            <p className="text-gray-300 text-lg">
              👤 Bem-vindo, <span className="font-semibold text-red-400">
                {user.name || user.telegram_username || user.email}
              </span>!
            </p>
            {user.telegram_id && (
              <div className="flex items-center gap-4 text-sm">
                <p className="text-gray-400">
                  📱 <span className="font-mono text-red-300">ID: {user.telegram_id}</span>
                </p>
                {user.telegram_username && (
                  <p className="text-gray-400">
                    💬 <span className="text-red-300">@{user.telegram_username}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 mb-8 border-b border-gray-800">
          <button
            onClick={() => setActiveTab('content')}
            className={`pb-4 px-2 font-medium transition-colors ${
              activeTab === 'content'
                ? 'text-red-500 border-b-2 border-red-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Meus Filmes
          </button>
          <button
            onClick={() => setActiveTab('purchases')}
            className={`pb-4 px-2 font-medium transition-colors ${
              activeTab === 'purchases'
                ? 'text-red-500 border-b-2 border-red-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Histórico de Compras
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`pb-4 px-2 font-medium transition-colors ${
              activeTab === 'requests'
                ? 'text-red-500 border-b-2 border-red-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Minhas Solicitações
          </button>
          <button
            onClick={() => setActiveTab('favorites')}
            className={`pb-4 px-2 font-medium transition-colors ${
              activeTab === 'favorites'
                ? 'text-red-500 border-b-2 border-red-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Favoritos
          </button>
        </div>

        {/* Conteúdo das Tabs */}
        {activeTab === 'content' && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Filmes Adquiridos</h2>
            {myContent.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {myContent.map((item) => (
                  <MovieCard key={item.id} movie={item} priority={false} isPurchased={true} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <p className="text-gray-400 mb-4">Você ainda não possui filmes adquiridos</p>
                <button
                  onClick={() => router.push('/')}
                  className="btn-primary"
                >
                  Explorar Catálogo
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'purchases' && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Histórico de Transações</h2>
            {purchases.length > 0 ? (
              <div className="space-y-4">
                {purchases.map((purchase) => (
                  <div
                    key={purchase.id}
                    className="bg-gray-800/50 rounded-lg p-6 flex items-center justify-between hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      {purchase.content.poster_url && (
                        <img
                          src={purchase.content.poster_url}
                          alt={purchase.content.title}
                          className="w-16 h-24 object-cover rounded"
                        />
                      )}
                      <div>
                        <h3 className="font-semibold text-white">{purchase.content.title}</h3>
                        <p className="text-sm text-gray-400">
                          {new Date(purchase.created_at).toLocaleDateString('pt-BR')}
                        </p>
                        <p className="text-sm text-gray-400">
                          R$ {(purchase.amount_cents / 100).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(purchase.status)}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <p className="text-gray-400">Nenhuma transação encontrada</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'requests' && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Minhas Solicitações de Conteúdo</h2>

            {/* Formulário de Nova Solicitação */}
            <div className="bg-gray-800/50 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-white mb-4">Solicitar Novo Filme ou Série</h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const title = (form.elements.namedItem('title') as HTMLInputElement).value;
                const description = (form.elements.namedItem('description') as HTMLTextAreaElement).value;

                try {
                  const token = localStorage.getItem('auth_token');
                  const response = await fetch('http://localhost:3001/api/v1/admin/requests', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      requested_title: title,
                      description,
                      user_id: user?.id,
                      priority: 'medium'
                    })
                  });

                  if (response.ok) {
                    toast.success('Solicitação enviada com sucesso!');
                    form.reset();
                    // Reload requests
                    const requestsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/requests/user/${user?.id}`, {
                      headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (requestsRes.ok) {
                      const requestsData = await requestsRes.json();
                      setRequests(requestsData);
                    }
                  } else {
                    const errorData = await response.json();
                    toast.error(errorData.message || 'Erro ao enviar solicitação');
                  }
                } catch (error) {
                  console.error('Error submitting request:', error);
                  toast.error('Erro ao enviar solicitação');
                }
              }}>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-2">
                      Título do Filme ou Série *
                    </label>
                    <input
                      type="text"
                      id="title"
                      name="title"
                      required
                      placeholder="Ex: Vingadores: Ultimato"
                      className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
                      Descrição ou Comentário (opcional)
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      rows={3}
                      placeholder="Adicione mais informações sobre o conteúdo que deseja..."
                      className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full sm:w-auto px-6 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors"
                  >
                    Enviar Solicitação
                  </button>
                </div>
              </form>
            </div>

            {/* Lista de Solicitações */}
            <h3 className="text-xl font-semibold text-white mb-4">Histórico de Solicitações</h3>
            {requests.length > 0 ? (
              <div className="space-y-4">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className="bg-gray-800/50 rounded-lg p-6 hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-white text-lg">{request.title}</h3>
                      {getStatusBadge(request.status)}
                    </div>
                    <p className="text-gray-400 mb-3">{request.description}</p>
                    {request.admin_notes && (
                      <div className="bg-gray-900/50 rounded p-3 mb-3">
                        <p className="text-sm text-gray-300">
                          <span className="font-medium">Resposta do Admin:</span> {request.admin_notes}
                        </p>
                      </div>
                    )}
                    <p className="text-sm text-gray-500">
                      Solicitado em {new Date(request.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-800/30 rounded-lg">
                <p className="text-gray-400">Você ainda não fez nenhuma solicitação</p>
                <p className="text-sm text-gray-500 mt-1">Use o formulário acima para solicitar um filme ou série</p>
              </div>
            )}
          </div>
        )}

        {/* Tab Favoritos */}
        {activeTab === 'favorites' && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Meus Favoritos</h2>
            {isLoading ? (
              <LoadingSkeleton type="grid" count={4} />
            ) : favorites.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {favorites.map((favorite) => (
                  <MovieCard
                    key={favorite.content_id}
                    movie={{
                      id: favorite.content_id,
                      title: favorite.content?.title || 'Título não disponível',
                      description: favorite.content?.description || '',
                      thumbnail_url: favorite.content?.poster_url || favorite.content?.thumbnail_url || '',
                      poster_url: favorite.content?.poster_url,
                      backdrop_url: favorite.content?.backdrop_url,
                      release_year: favorite.content?.release_year,
                      imdb_rating: favorite.content?.imdb_rating,
                      price_cents: favorite.content?.price_cents || 0
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-800/30 rounded-lg">
                <p className="text-gray-400">Você ainda não tem favoritos</p>
                <p className="text-sm text-gray-500 mt-1">
                  Adicione filmes e séries aos favoritos clicando no ícone de coração
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
