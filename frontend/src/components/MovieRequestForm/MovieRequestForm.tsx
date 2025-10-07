'use client';

import React, { useState } from 'react';
import { Send, Film, MessageSquare } from 'lucide-react';

interface MovieRequestFormProps {
  onSubmit?: (request: { movieName: string; comments: string }) => void;
  isLoading?: boolean;
}

export default function MovieRequestForm({ onSubmit, isLoading = false }: MovieRequestFormProps) {
  const [movieName, setMovieName] = useState('');
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!movieName.trim()) return;

    setIsSubmitting(true);
    
    try {
      if (onSubmit) {
        await onSubmit({ movieName: movieName.trim(), comments: comments.trim() });
      }
      
      // Reset form after successful submission
      setMovieName('');
      setComments('');
    } catch (error) {
      console.error('Erro ao enviar pedido:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = movieName.trim().length > 0;
  const isButtonDisabled = !isFormValid || isSubmitting || isLoading;

  return (
    <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-6 shadow-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-red-600/20 rounded-lg">
          <Film className="w-6 h-6 text-red-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">Solicitar Filme</h2>
          <p className="text-gray-400 text-sm">Não encontrou o filme que procura? Solicite aqui!</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Nome do Filme */}
        <div className="space-y-2">
          <label htmlFor="movieName" className="block text-sm font-medium text-gray-300">
            Nome do Filme *
          </label>
          <div className="relative">
            <input
              id="movieName"
              type="text"
              value={movieName}
              onChange={(e) => setMovieName(e.target.value)}
              placeholder="Ex: Nome do Filme"
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
              maxLength={100}
              required
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <Film className="w-5 h-5 text-gray-500" />
            </div>
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Campo obrigatório</span>
            <span>{movieName.length}/100</span>
          </div>
        </div>

        {/* Comentários */}
        <div className="space-y-2">
          <label htmlFor="comments" className="block text-sm font-medium text-gray-300">
            Comentários (opcional)
          </label>
          <div className="relative">
            <textarea
              id="comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Adicione informações extras como ano, diretor, ou por que gostaria de assistir..."
              rows={4}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 resize-none"
              maxLength={500}
            />
            <div className="absolute top-3 right-3">
              <MessageSquare className="w-5 h-5 text-gray-500" />
            </div>
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Ajude-nos a encontrar o filme certo</span>
            <span>{comments.length}/500</span>
          </div>
        </div>

        {/* Botão de Envio */}
        <button
          type="submit"
          disabled={isButtonDisabled}
          className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
            isButtonDisabled
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-red-500/25 transform hover:scale-[1.02]'
          }`}
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Enviando...</span>
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>Enviar Pedido</span>
            </>
          )}
        </button>
      </form>

      {/* Nota informativa */}
      <div className="mt-6 p-4 bg-blue-900/20 border border-blue-800/30 rounded-lg">
        <p className="text-blue-300 text-sm">
          <span className="font-medium">💡 Dica:</span> Pedidos são analisados pela nossa equipe. 
          Filmes populares têm prioridade e podem ser adicionados em até 48 horas.
        </p>
      </div>
    </div>
  );
}