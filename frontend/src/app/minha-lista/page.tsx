'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header/Header';
import { Footer } from '@/components/Footer/Footer';
import { MovieCard } from '@/components/MovieCard/MovieCard';
import { LoadingSkeleton } from '@/components/LoadingSkeleton/LoadingSkeleton';
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

export default function MinhaListaPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [myContent, setMyContent] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'content' | 'purchases'>('content');

  // Verificar autenticação via JWT tokens do backend
  useEffect(() => {
    const checkAuth = () => {
      if (typeof window === 'undefined') return;

      const token = localStorage.getItem('access_token');
      const userStr = localStorage.getItem('user');

      if (!token || !userStr) {
        toast.error('Você precisa estar logado para acessar esta página');
        router.push('/');
        return;
      }

      try {
        const userData = JSON.parse(userStr);
        setUser(userData);
      } catch (error) {
        console.error('Error parsing user data:', error);
        router.push('/');
      }
    };

    checkAuth();
  }, [router]);

  // Buscar dados do usuário
  useEffect(() => {
    if (!user) return;

    const fetchUserData = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem('access_token');
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

        // Buscar conteúdo adquirido
        const contentRes = await fetch(`${apiUrl}/api/v1/purchases/user/${user.id}/content`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (contentRes.ok) {
          const contentData = await contentRes.json();
          setMyContent(contentData);
        }

        // Buscar histórico de compras
        const purchasesRes = await fetch(`${apiUrl}/api/v1/purchases/user/${user.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (purchasesRes.ok) {
          const purchasesData = await purchasesRes.json();
          setPurchases(purchasesData);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        toast.error('Erro ao carregar seus dados');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    toast.success('Logout realizado com sucesso');
    router.push('/');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <div className="animate-spin h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950">
      <Header />

      <main className="container mx-auto px-4 py-8 mt-16">
        {/* Header com informações do usuário */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Minha Lista
              </h1>
              <p className="text-gray-400">
                Olá, {user.name || user.email}! Aqui estão seus filmes e compras.
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Sair
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-800">
          <button
            onClick={() => setActiveTab('content')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'content'
                ? 'text-primary-500 border-b-2 border-primary-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Meus Filmes ({myContent.length})
          </button>
          <button
            onClick={() => setActiveTab('purchases')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'purchases'
                ? 'text-primary-500 border-b-2 border-primary-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Histórico de Compras ({purchases.length})
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <LoadingSkeleton count={6} />
        ) : (
          <>
            {/* Meus Filmes Tab */}
            {activeTab === 'content' && (
              <div>
                {myContent.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-gray-400 text-lg mb-4">
                      Você ainda não tem filmes comprados
                    </p>
                    <button
                      onClick={() => router.push('/')}
                      className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                    >
                      Explorar Catálogo
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {myContent.map((content) => (
                      <MovieCard
                        key={content.id}
                        id={content.id}
                        title={content.title}
                        posterUrl={content.poster_url}
                        rating={content.imdb_rating}
                        year={content.release_year}
                        genres={content.genres}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Histórico de Compras Tab */}
            {activeTab === 'purchases' && (
              <div>
                {purchases.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-gray-400 text-lg">
                      Você ainda não fez nenhuma compra
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {purchases.map((purchase) => (
                      <div
                        key={purchase.id}
                        className="bg-dark-900 rounded-lg p-6 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          {purchase.content?.poster_url && (
                            <img
                              src={purchase.content.poster_url}
                              alt={purchase.content.title}
                              className="w-16 h-24 object-cover rounded"
                            />
                          )}
                          <div>
                            <h3 className="text-white font-semibold text-lg">
                              {purchase.content?.title || 'Filme Removido'}
                            </h3>
                            <p className="text-gray-400 text-sm">
                              Comprado em {new Date(purchase.created_at).toLocaleDateString('pt-BR')}
                            </p>
                            <p className="text-gray-500 text-sm">
                              Status: <span className={`font-medium ${
                                purchase.status === 'completed' ? 'text-green-500' :
                                purchase.status === 'pending' ? 'text-yellow-500' :
                                'text-red-500'
                              }`}>
                                {purchase.status === 'completed' ? 'Concluído' :
                                 purchase.status === 'pending' ? 'Pendente' :
                                 'Cancelado'}
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-bold text-xl">
                            R$ {(purchase.amount_cents / 100).toFixed(2)}
                          </p>
                          <p className="text-gray-400 text-sm">
                            {purchase.currency}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
