'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

interface TelegramContent {
  id: string;
  title: string;
  description: string;
  poster_url?: string;
  purchased_at: string;
  telegram_file_id?: string;
}

interface TelegramContentSectionProps {
  userId: string;
}

export const TelegramContentSection: React.FC<TelegramContentSectionProps> = ({ userId }) => {
  const [telegramContent, setTelegramContent] = useState<TelegramContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [botUsername, setBotUsername] = useState('');

  useEffect(() => {
    const fetchTelegramContent = async () => {
      try {
        const token = localStorage.getItem('auth_token');

        // Buscar conteúdo adquirido via Telegram
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/purchases/telegram/${userId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          setTelegramContent(data);
        }

        // Buscar username do bot
        const botResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/telegram/bot-info`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (botResponse.ok) {
          const botData = await botResponse.json();
          setBotUsername(botData.username || 'cinevision_bot');
        }
      } catch (error) {
        console.error('Error fetching Telegram content:', error);
        toast.error('Erro ao carregar conteúdo do Telegram');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTelegramContent();
  }, [userId]);

  const handleOpenTelegram = () => {
    const telegramLink = `https://t.me/${botUsername}`;
    window.open(telegramLink, '_blank');
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-700 rounded w-1/3 mb-6"></div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-12 pt-8 border-t border-gray-800">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <svg className="w-8 h-8 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.223-.548.223l.188-2.85 5.18-4.68c.223-.198-.054-.308-.346-.11l-6.4 4.03-2.76-.918c-.6-.183-.612-.6.125-.89l10.782-4.156c.5-.183.943.112.78.89z"/>
            </svg>
            Filmes via Telegram
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Conteúdo entregue diretamente no seu Telegram
          </p>
        </div>

        <button
          onClick={handleOpenTelegram}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.223-.548.223l.188-2.85 5.18-4.68c.223-.198-.054-.308-.346-.11l-6.4 4.03-2.76-.918c-.6-.183-.612-.6.125-.89l10.782-4.156c.5-.183.943.112.78.89z"/>
          </svg>
          Abrir Telegram
        </button>
      </div>

      {telegramContent.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {telegramContent.map((item) => (
            <div
              key={item.id}
              className="group relative bg-gray-800/50 rounded-lg overflow-hidden hover:bg-gray-800 transition-all cursor-pointer"
              onClick={handleOpenTelegram}
            >
              {item.poster_url ? (
                <img
                  src={item.poster_url}
                  alt={item.title}
                  className="w-full h-64 object-cover"
                />
              ) : (
                <div className="w-full h-64 bg-gray-700 flex items-center justify-center">
                  <svg
                    className="w-16 h-16 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                    />
                  </svg>
                </div>
              )}

              <div className="p-4">
                <h3 className="font-semibold text-white line-clamp-1 group-hover:text-blue-400 transition-colors">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  Adquirido em {new Date(item.purchased_at).toLocaleDateString('pt-BR')}
                </p>
              </div>

              {/* Overlay com ícone do Telegram */}
              <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/20 transition-colors flex items-center justify-center">
                <svg
                  className="w-16 h-16 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.223-.548.223l.188-2.85 5.18-4.68c.223-.198-.054-.308-.346-.11l-6.4 4.03-2.76-.918c-.6-.183-.612-.6.125-.89l10.782-4.156c.5-.183.943.112.78.89z"/>
                </svg>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-800/30 rounded-lg border-2 border-dashed border-gray-700">
          <svg
            className="w-16 h-16 text-gray-600 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <p className="text-gray-400 mb-4">
            Você ainda não possui filmes entregues via Telegram
          </p>
          <button
            onClick={handleOpenTelegram}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.223-.548.223l.188-2.85 5.18-4.68c.223-.198-.054-.308-.346-.11l-6.4 4.03-2.76-.918c-.6-.183-.612-.6.125-.89l10.782-4.156c.5-.183.943.112.78.89z"/>
            </svg>
            Conversar com o Bot
          </button>
        </div>
      )}
    </div>
  );
};

export default TelegramContentSection;
