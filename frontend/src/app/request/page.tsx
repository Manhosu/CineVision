'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header/Header';
import { Footer } from '@/components/Footer/Footer';
import { FilmIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function RequestPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    type: 'MOVIE' as 'MOVIE' | 'SERIES',
    notes: ''
  });

  // Verificar se o usuário é do Telegram
  const isTelegramUser = isAuthenticated && user?.telegram_id;

  // Redirecionar se não for usuário do Telegram
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !user?.telegram_id)) {
      router.push('/');
    }
  }, [isLoading, isAuthenticated, user, router]);

  // Mostrar loading enquanto verifica autenticação
  if (isLoading || (!isAuthenticated || !user?.telegram_id)) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Por favor, informe o título do filme/série');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');

      const response = await fetch(`${API_URL}/api/v1/content-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          content_type: formData.type,
          notes: formData.notes.trim() || null,
          user_id: user?.id,
          telegram_id: user?.telegram_id
        })
      });

      if (response.ok) {
        setShowSuccess(true);
        setFormData({ title: '', type: 'MOVIE', notes: '' });
        toast.success('Pedido enviado com sucesso!');

        // Redirecionar após 3 segundos
        setTimeout(() => {
          router.push('/');
        }, 3000);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Erro ao enviar pedido');
      }
    } catch (error) {
      console.error('Erro ao enviar pedido:', error);
      toast.error('Erro ao enviar pedido. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <CheckCircleIcon className="w-20 h-20 text-green-500 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-white mb-4">Pedido Enviado!</h1>
            <p className="text-gray-400 mb-6">
              Seu pedido foi recebido e será analisado em breve. Você será notificado quando o conteúdo estiver disponível.
            </p>
            <button
              onClick={() => router.push('/')}
              className="btn-primary"
            >
              Voltar ao Início
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-20 xs:py-24 lg:py-32 max-w-2xl">
        <div className="bg-dark-900 rounded-xl border border-white/10 p-4 xs:p-6 sm:p-8 lg:p-10">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center">
              <FilmIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                Fazer Pedido
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Solicite um filme ou série
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="bg-primary-600/10 border border-primary-600/20 rounded-lg p-4 mb-8">
            <p className="text-sm text-gray-300">
              Não encontrou o que procura? Faça um pedido e nossa equipe trabalhará para disponibilizar o conteúdo o mais rápido possível.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tipo */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tipo de Conteúdo
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'MOVIE' })}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    formData.type === 'MOVIE'
                      ? 'border-primary-600 bg-primary-600/10 text-white'
                      : 'border-white/10 bg-dark-800 text-gray-400 hover:border-white/20'
                  }`}
                >
                  <FilmIcon className="w-6 h-6 mx-auto mb-2" />
                  <span className="text-sm font-medium">Filme</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'SERIES' })}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    formData.type === 'SERIES'
                      ? 'border-primary-600 bg-primary-600/10 text-white'
                      : 'border-white/10 bg-dark-800 text-gray-400 hover:border-white/20'
                  }`}
                >
                  <FilmIcon className="w-6 h-6 mx-auto mb-2" />
                  <span className="text-sm font-medium">Série</span>
                </button>
              </div>
            </div>

            {/* Título */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-2">
                Título <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Breaking Bad, Vingadores: Ultimato"
                className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-600 transition-colors"
                required
              />
            </div>

            {/* Observações */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-300 mb-2">
                Observações (opcional)
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Informações adicionais como temporada, ano de lançamento, etc."
                rows={4}
                className="w-full px-4 py-3 bg-dark-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-600 transition-colors resize-none"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 px-6 py-3 bg-dark-800 text-gray-300 rounded-lg font-medium hover:bg-dark-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Enviando...' : 'Enviar Pedido'}
              </button>
            </div>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}
