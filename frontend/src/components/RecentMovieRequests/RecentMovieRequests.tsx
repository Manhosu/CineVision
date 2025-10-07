'use client';

import React from 'react';
import { Clock, Film, MessageSquare, User, Calendar, TrendingUp } from 'lucide-react';

export interface MovieRequest {
  id: string;
  movieName: string;
  comments?: string;
  userName?: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'added';
  votes?: number;
}

interface RecentMovieRequestsProps {
  requests: MovieRequest[];
  isLoading?: boolean;
  onVote?: (requestId: string) => void;
}

export default function RecentMovieRequests({ 
  requests, 
  isLoading = false,
  onVote 
}: RecentMovieRequestsProps) {
  const getStatusColor = (status: MovieRequest['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-900/20 text-yellow-400 border-yellow-800/30';
      case 'approved':
        return 'bg-blue-900/20 text-blue-400 border-blue-800/30';
      case 'added':
        return 'bg-green-900/20 text-green-400 border-green-800/30';
      case 'rejected':
        return 'bg-red-900/20 text-red-400 border-red-800/30';
      default:
        return 'bg-gray-900/20 text-gray-400 border-gray-800/30';
    }
  };

  const getStatusText = (status: MovieRequest['status']) => {
    switch (status) {
      case 'pending':
        return 'Pendente';
      case 'approved':
        return 'Aprovado';
      case 'added':
        return 'Adicionado';
      case 'rejected':
        return 'Rejeitado';
      default:
        return 'Desconhecido';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Agora mesmo';
    } else if (diffInHours < 24) {
      return `${diffInHours}h atrás`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays === 1) {
        return 'Ontem';
      } else if (diffInDays < 7) {
        return `${diffInDays} dias atrás`;
      } else {
        return date.toLocaleDateString('pt-BR', { 
          day: '2-digit', 
          month: '2-digit',
          year: 'numeric'
        });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-600/20 rounded-lg">
            <Clock className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Pedidos Recentes</h2>
            <p className="text-gray-400 text-sm">Carregando pedidos...</p>
          </div>
        </div>
        
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-800/30 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-700 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-6 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/20 rounded-lg">
            <Clock className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Pedidos Recentes</h2>
            <p className="text-gray-400 text-sm">
              {requests.length} {requests.length === 1 ? 'pedido' : 'pedidos'} da comunidade
            </p>
          </div>
        </div>
        
        {requests.length > 0 && (
          <div className="text-xs text-gray-500 bg-gray-800/50 px-3 py-1 rounded-full">
            Atualizado agora
          </div>
        )}
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-12">
          <div className="p-4 bg-gray-800/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <Film className="w-8 h-8 text-gray-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-300 mb-2">Nenhum pedido ainda</h3>
          <p className="text-gray-500 text-sm">
            Seja o primeiro a solicitar um filme para a comunidade!
          </p>
        </div>
      ) : (
        <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
          {requests.map((request) => (
            <div
              key={request.id}
              className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-4 hover:bg-gray-800/50 transition-all duration-200 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Film className="w-4 h-4 text-gray-400" />
                    <h3 className="font-medium text-white group-hover:text-red-400 transition-colors">
                      {request.movieName}
                    </h3>
                  </div>
                  
                  {request.userName && (
                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                      <User className="w-3 h-3" />
                      <span>Por {request.userName}</span>
                    </div>
                  )}
                </div>
                
                <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                  {getStatusText(request.status)}
                </div>
              </div>

              {request.comments && (
                <div className="mb-3 p-3 bg-gray-900/30 rounded-lg border-l-2 border-gray-600">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {request.comments}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDate(request.createdAt)}</span>
                  </div>
                  
                  {request.votes !== undefined && (
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      <span>{request.votes} votos</span>
                    </div>
                  )}
                </div>

                {onVote && request.status === 'pending' && (
                  <button
                    onClick={() => onVote(request.id)}
                    className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                  >
                    👍 Apoiar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Nota sobre transparência */}
      <div className="mt-6 p-4 bg-purple-900/20 border border-purple-800/30 rounded-lg">
        <p className="text-purple-300 text-sm">
          <span className="font-medium">🔍 Transparência:</span> Todos os pedidos são públicos 
          para que a comunidade possa ver e apoiar os filmes mais desejados.
        </p>
      </div>
    </div>
  );
}