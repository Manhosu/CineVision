'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      router.push('/dashboard');
      return;
    }

    const redirectToTelegram = async () => {
      try {
        // Try movies endpoint first
        let response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/content/movies/${id}`,
          { cache: 'no-store' }
        );

        if (!response.ok && response.status === 404) {
          // Try series endpoint
          response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/v1/content/series/${id}`,
            { cache: 'no-store' }
          );
        }

        if (response.ok) {
          const content = await response.json();
          if (content.telegram_group_link) {
            window.location.href = content.telegram_group_link;
            return;
          }
        }
      } catch (error) {
        console.error('Error fetching content for redirect:', error);
      }

      // If no telegram link found, show fallback
      setLoading(false);
    };

    redirectToTelegram();
  }, [id, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-white text-lg">Redirecionando para o Telegram...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto p-6">
        <svg className="w-16 h-16 text-blue-500 mx-auto mb-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
        <h1 className="text-2xl font-bold text-white mb-3">
          Conteudo disponivel pelo Telegram
        </h1>
        <p className="text-gray-400 mb-6">
          Todo o conteudo agora e entregue exclusivamente pelo Telegram para uma melhor experiencia.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'cinevisionv2bot';
              window.open(`https://t.me/${botUsername}`, '_blank');
            }}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
            Abrir Telegram
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full px-6 py-3 bg-dark-800 hover:bg-dark-700 text-white rounded-lg border border-white/10 transition-colors"
          >
            Voltar para o Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
