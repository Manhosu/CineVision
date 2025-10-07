'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Film, Users, TrendingUp, Star, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header/Header';
import { Footer } from '@/components/Footer/Footer';
import { LoadingSkeleton } from '@/components/LoadingSkeleton/LoadingSkeleton';
import MovieRequestForm from '@/components/MovieRequestForm';
import RecentMovieRequests, { MovieRequest } from '@/components/RecentMovieRequests';

interface RequestStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

interface ApiRequest {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected';
  requester_telegram_first_name?: string;
  requester_telegram_username?: string;
  created_at: string;
  admin_notes?: string;
}

export default function MovieRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<MovieRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<RequestStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  });

  // Fetch requests and stats from API
  useEffect(() => {
    fetchRequests();
    fetchStats();
  }, []);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/requests?limit=20&page=1`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // For public endpoint, just show empty state if no access
        if (response.status === 401 || response.status === 403) {
          setRequests([]);
          setIsLoading(false);
          return;
        }
        throw new Error('Failed to fetch requests');
      }

      const data = await response.json();
      const apiRequests: ApiRequest[] = data.requests || [];

      // Convert API requests to MovieRequest format
      const movieRequests: MovieRequest[] = apiRequests.map(req => ({
        id: req.id,
        movieName: req.title,
        comments: req.description || '',
        userName: req.requester_telegram_first_name || req.requester_telegram_username || 'Usuário Anônimo',
        createdAt: req.created_at,
        status: req.status,
        votes: 0, // We don't have votes in the current system
        adminNotes: req.admin_notes,
      }));

      setRequests(movieRequests);
    } catch (err) {
      console.error('Error fetching requests:', err);
      setError('Erro ao carregar pedidos. Mostrando dados de exemplo.');
      // Show example data on error
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/requests/stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats({
          total: data.total || 0,
          pending: data.pending || 0,
          approved: data.approved || 0,
          rejected: data.rejected || 0,
        });
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
      // Keep default stats on error
    }
  };

  const handleNewRequest = async (request: { movieName: string; comments: string }) => {
    const { movieName, comments } = request;
    try {
      setSubmitLoading(true);
      setError(null);

      const token = localStorage.getItem('access_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/requests`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: movieName,
          description: comments,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Erro ao enviar pedido');
      }

      const newRequest = await response.json();

      // Add to local state for immediate feedback
      const movieRequest: MovieRequest = {
        id: newRequest.id,
        movieName: newRequest.title,
        comments: newRequest.description || '',
        userName: 'Você',
        createdAt: newRequest.created_at,
        status: 'pending',
        votes: 0,
      };

      setRequests(prev => [movieRequest, ...prev]);

      // Update stats
      setStats(prev => ({
        ...prev,
        total: prev.total + 1,
        pending: prev.pending + 1,
      }));

      // Optionally refresh data from server
      setTimeout(() => {
        fetchRequests();
        fetchStats();
      }, 1000);

    } catch (err) {
      console.error('Error submitting request:', err);
      setError(err instanceof Error ? err.message : 'Erro ao enviar pedido');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleVote = (requestId: string) => {
    // Voting functionality can be implemented later
    // For now, just show a message
    console.log('Voting feature coming soon for request:', requestId);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-950">
        <Header />
        <main className="relative pt-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <LoadingSkeleton type="section" />
            <div className="mt-8">
              <LoadingSkeleton type="section" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950">
      <Header />

      <main className="relative pt-20">
        {/* Hero section */}
        <div className="relative bg-gradient-to-b from-dark-900 to-dark-950 py-20">
          <div className="absolute inset-0 bg-gradient-to-r from-red-600/10 to-transparent"></div>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="max-w-4xl">
              <h1 className="text-4xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                Pedidos de Filmes
              </h1>
              <p className="text-xl lg:text-2xl text-gray-300 mb-8 leading-relaxed">
                Solicite filmes para o catálogo e acompanhe o status dos pedidos da comunidade
              </p>
            </div>
          </div>
        </div>

        {/* Content section */}
        <div className="relative z-10 -mt-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="bg-dark-900/30 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-600/20 rounded-lg">
                      <Film className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{stats.total}</p>
                      <p className="text-sm text-gray-400">Total de Pedidos</p>
                    </div>
                  </div>
                </div>

                <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-600/20 rounded-lg">
                      <Clock className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{stats.pending}</p>
                      <p className="text-sm text-gray-400">Pendentes</p>
                    </div>
                  </div>
                </div>

                <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-600/20 rounded-lg">
                      <Star className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{stats.approved}</p>
                      <p className="text-sm text-gray-400">Aprovados</p>
                    </div>
                  </div>
                </div>

                <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-600/20 rounded-lg">
                      <Users className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{stats.rejected}</p>
                      <p className="text-sm text-gray-400">Rejeitados</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Content */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Formulário de Pedido */}
                <div className="space-y-6">
                  <MovieRequestForm onSubmit={handleNewRequest} isLoading={submitLoading} />

                  {/* Informações Adicionais */}
                  <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-red-500" />
                      Como Funciona
                    </h3>
                    <div className="space-y-3 text-sm text-gray-300">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-red-600/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-red-400 text-xs font-bold">1</span>
                        </div>
                        <p>Faça seu pedido preenchendo o formulário ao lado</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-red-600/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-red-400 text-xs font-bold">2</span>
                        </div>
                        <p>A comunidade pode apoiar seu pedido com votos</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-red-600/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-red-400 text-xs font-bold">3</span>
                        </div>
                        <p>Administradores analisam e adicionam ao catálogo</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lista de Pedidos Recentes */}
                <div>
                  <RecentMovieRequests
                    requests={requests}
                    isLoading={false}
                    onVote={handleVote}
                  />
                </div>
              </div>

              {/* Footer Info */}
              <div className="mt-12 text-center">
                <div className="bg-dark-800/30 border border-white/10 rounded-xl p-6 max-w-2xl mx-auto">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    💡 Dica da Comunidade
                  </h3>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    Pedidos com mais detalhes e justificativas têm maior chance de serem aprovados.
                    Considere mencionar por que o filme seria uma boa adição ao catálogo e se há
                    demanda da comunidade.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}