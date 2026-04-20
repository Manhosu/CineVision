'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/Header/Header';
import { Footer } from '@/components/Footer/Footer';
import { MovieCard } from '@/components/MovieCard/MovieCard';
import { LoadingSkeleton } from '@/components/LoadingSkeleton/LoadingSkeleton';
import { WhatsAppGate } from '@/components/WhatsApp/WhatsAppGate';
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
  const [activeTab, setActiveTab] = useState<'content' | 'purchases' | 'requests'>('content');
  const [myContent, setMyContent] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [whatsappJoined, setWhatsappJoined] = useState(true); // default true to avoid flash

  // Redirecionar se não autenticado
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Sync whatsapp_joined from user data
  useEffect(() => {
    if (user) {
      setWhatsappJoined(user.whatsapp_joined ?? false);
    }
  }, [user]);

  // Função para renovar token usando refresh_token
  const refreshAccessToken = async (): Promise<string | null> => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        console.error('[Dashboard] No refresh token found');
        handleAuthExpired();
        return null;
      }

      console.log('[Dashboard] Refreshing access token...');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[Dashboard] Token refreshed successfully');
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('auth_token', data.access_token);
        if (data.refresh_token) {
          localStorage.setItem('refresh_token', data.refresh_token);
        }
        return data.access_token;
      } else {
        console.error('[Dashboard] Failed to refresh token - refresh_token expired');
        handleAuthExpired();
        return null;
      }
    } catch (error) {
      console.error('[Dashboard] Error refreshing token:', error);
      handleAuthExpired();
      return null;
    }
  };

  // Função para lidar com sessão expirada
  const handleAuthExpired = () => {
    console.log('[Dashboard] Session expired, clearing tokens and redirecting...');

    // Limpar todos os tokens
    localStorage.removeItem('access_token');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');

    // Se usuário tem telegram_id, redirecionar para autologin do Telegram
    if (user?.telegram_id) {
      toast.error('Sua sessão expirou. Redirecionando para autenticação...');

      // Redirecionar para Telegram autologin
      const redirectUrl = `/auth/telegram-login?telegram_id=${user.telegram_id}&redirect=/dashboard`;
      setTimeout(() => {
        router.push(redirectUrl);
      }, 1500);
    } else {
      // Se não tem telegram_id, redirecionar para login normal
      toast.error('Sua sessão expirou. Por favor, faça login novamente.');
      setTimeout(() => {
        router.push('/auth/login');
      }, 1500);
    }
  };

  // Função para fazer fetch com auto-refresh
  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    let token = localStorage.getItem('auth_token');

    const makeRequest = async (authToken: string) => {
      return fetch(url, {
        ...options,
        cache: 'no-store', // Always fetch fresh data - reflects admin changes immediately
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${authToken}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
    };

    let response = await makeRequest(token!);

    // Se recebeu 401, tenta renovar o token
    if (response.status === 401) {
      console.log('[Dashboard] Token expired, attempting refresh...');
      const newToken = await refreshAccessToken();

      if (newToken) {
        // Tenta novamente com o novo token
        response = await makeRequest(newToken);
      } else {
        // Se não conseguiu renovar, handleAuthExpired já cuidou do redirecionamento
        throw new Error('Authentication failed');
      }
    }

    return response;
  };

  // Buscar dados do usuário
  useEffect(() => {
    if (!user) return;

    const fetchUserData = async () => {
      try {
        setIsLoading(true);

        console.log('[Dashboard] User data:', {
          id: user.id,
          telegram_id: user.telegram_id,
          email: user.email,
          name: user.name
        });

        // Buscar conteúdo adquirido
        const contentUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/purchases/user/${user.id}/content`;
        console.log('[Dashboard] Fetching content from:', contentUrl);

        const contentRes = await fetchWithAuth(contentUrl);

        console.log('[Dashboard] Response status:', contentRes.status);
        console.log('[Dashboard] Response ok:', contentRes.ok);

        if (contentRes.ok) {
          const contentData = await contentRes.json();
          console.log('[Dashboard] Content data from API:', contentData);
          console.log('[Dashboard] Content data length:', contentData?.length);
          console.log('[Dashboard] First item:', contentData[0]);
          setMyContent(contentData);
        } else {
          const errorText = await contentRes.text();
          console.error('[Dashboard] Error fetching content:', errorText);
        }

        // Buscar histórico de compras
        const purchasesUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/purchases/user/${user.id}`;
        console.log('[Dashboard] Fetching purchases from:', purchasesUrl);

        const purchasesRes = await fetchWithAuth(purchasesUrl);

        console.log('[Dashboard] Purchases response status:', purchasesRes.status);

        if (purchasesRes.ok) {
          const purchasesData = await purchasesRes.json();
          console.log('[Dashboard] Purchases data:', purchasesData);
          console.log('[Dashboard] Purchases count:', purchasesData?.length);
          setPurchases(purchasesData);
        } else {
          const errorText = await purchasesRes.text();
          console.error('[Dashboard] Error fetching purchases:', errorText);
        }

        // Buscar solicitações do usuário
        const requestsUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/requests/user/${user.id}`;
        console.log('[Dashboard] Fetching requests from:', requestsUrl);

        const requestsRes = await fetchWithAuth(requestsUrl);

        console.log('[Dashboard] Requests response status:', requestsRes.status);

        if (requestsRes.ok) {
          const requestsData = await requestsRes.json();
          console.log('[Dashboard] Requests data:', requestsData);
          console.log('[Dashboard] Requests count:', requestsData?.length);
          setRequests(requestsData);
        } else {
          const errorText = await requestsRes.text();
          console.error('[Dashboard] Error fetching requests:', errorText);
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

      <WhatsAppGate
        userId={user.id}
        whatsappJoined={whatsappJoined}
        whatsappLink="https://chat.whatsapp.com/CK5DVQUWQqG3WRrDgjTbgy"
        onConfirmJoined={() => setWhatsappJoined(true)}
      >
      <div className="container mx-auto px-4 lg:px-6 py-8 sm:py-12 mt-16 sm:mt-20">
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

            {/* Solicitar via Telegram */}
            <div className="bg-gray-800/50 rounded-lg p-6 mb-6 text-center">
              <h3 className="text-lg font-semibold text-white mb-3">Solicitar Novo Filme ou Série</h3>
              <p className="text-gray-400 text-sm mb-5">
                Envie uma mensagem no nosso Telegram informando o nome do filme ou série que deseja!
              </p>
              <button
                onClick={() => window.open('https://t.me/m/YAU1-zMrZDcx', '_blank')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                Solicitar via Telegram
              </button>
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
      </div>

      </WhatsAppGate>

      <Footer />
    </div>
  );
}
