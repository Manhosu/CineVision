'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/Header/Header';
import { Footer } from '@/components/Footer/Footer';

interface PurchaseDetails {
  id: string;
  purchase_token: string;
  status: string;
  amount_cents: number;
  payment_method: string;
  content: {
    id: string;
    title: string;
    poster_url?: string;
    description?: string;
  };
  created_at: string;
}

function PurchaseSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [purchase, setPurchase] = useState<PurchaseDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const purchaseToken = searchParams.get('token');
  const purchaseId = searchParams.get('purchase_id');

  useEffect(() => {
    const fetchPurchaseDetails = async () => {
      try {
        if (!purchaseToken && !purchaseId) {
          setError('Token de compra não fornecido');
          setLoading(false);
          return;
        }

        const endpoint = purchaseToken
          ? `/api/v1/purchases/token/${purchaseToken}`
          : `/api/v1/purchases/${purchaseId}`;

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Erro ao buscar detalhes da compra');
        }

        const data = await response.json();
        setPurchase(data);
      } catch (err: any) {
        console.error('Error fetching purchase:', err);
        setError(err.message || 'Erro ao carregar detalhes da compra');
      } finally {
        setLoading(false);
      }
    };

    fetchPurchaseDetails();
  }, [purchaseToken, purchaseId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950">
        <Header />
        <main className="relative pt-20 flex items-center justify-center min-h-[calc(100vh-80px)]">
          <div className="flex items-center space-x-3">
            <div className="animate-spin w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full"></div>
            <span className="text-white text-lg">Carregando...</span>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !purchase) {
    return (
      <div className="min-h-screen bg-dark-950">
        <Header />
        <main className="relative pt-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="max-w-2xl mx-auto text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-white mb-4">Erro</h1>
              <p className="text-gray-400 mb-8">{error || 'Não foi possível carregar os detalhes da compra'}</p>
              <Link
                href="/"
                className="inline-flex items-center px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                Voltar para Home
              </Link>
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
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-3xl mx-auto">
            {/* Success Icon */}
            <div className="text-center mb-8">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg className="w-12 h-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-4xl font-bold text-white mb-3">Compra Realizada com Sucesso!</h1>
              <p className="text-xl text-gray-300">Obrigado pela sua compra</p>
            </div>

            {/* Purchase Details Card */}
            <div className="bg-dark-900/50 backdrop-blur-sm border border-white/10 rounded-2xl p-8 mb-6">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Movie Poster */}
                {purchase.content.poster_url && (
                  <div className="flex-shrink-0">
                    <img
                      src={purchase.content.poster_url}
                      alt={purchase.content.title}
                      className="w-32 h-48 object-cover rounded-lg"
                    />
                  </div>
                )}

                {/* Details */}
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-white mb-2">{purchase.content.title}</h2>

                  {purchase.content.description && (
                    <p className="text-gray-400 mb-4 line-clamp-2">{purchase.content.description}</p>
                  )}

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Status do Pagamento:</span>
                      <span className={`font-medium ${
                        purchase.status === 'paid' ? 'text-green-400' : 'text-yellow-400'
                      }`}>
                        {purchase.status === 'paid' ? 'Confirmado' : 'Processando'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Valor:</span>
                      <span className="text-white font-medium">
                        R$ {(purchase.amount_cents / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Método de Pagamento:</span>
                      <span className="text-white font-medium capitalize">
                        {purchase.payment_method === 'pix' ? 'PIX' :
                         purchase.payment_method === 'credit_card' ? 'Cartão de Crédito' :
                         purchase.payment_method}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Data:</span>
                      <span className="text-white font-medium">
                        {new Date(purchase.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Next Steps */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6 mb-6">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Próximos Passos
              </h3>
              <ul className="space-y-2 text-gray-300">
                <li className="flex items-start">
                  <span className="text-blue-400 mr-2">1.</span>
                  <span>Você receberá uma notificação no Telegram com o link para assistir</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-400 mr-2">2.</span>
                  <span>Também pode acessar através da página "Minha Lista"</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-400 mr-2">3.</span>
                  <span>Para baixar o filme, use o bot do Telegram</span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href={`/watch/${purchase.content.id}`}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-all duration-300 hover:scale-105"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Assistir Agora
              </Link>

              <Link
                href="/my-list"
                className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-dark-800 text-white font-medium rounded-xl hover:bg-dark-700 border border-white/10 transition-all duration-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                Minha Lista
              </Link>
            </div>

            {/* Additional Info */}
            <div className="mt-8 text-center text-sm text-gray-400">
              <p>Em caso de dúvidas, entre em contato através do nosso Telegram</p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function PurchaseSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="animate-spin w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full"></div>
          <span className="text-white text-lg">Carregando...</span>
        </div>
      </div>
    }>
      <PurchaseSuccessContent />
    </Suspense>
  );
}
