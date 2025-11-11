'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import {
  PaperAirplaneIcon,
  LinkIcon,
  UsersIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowLeftIcon,
  HomeIcon,
} from '@heroicons/react/24/outline';

interface BroadcastHistory {
  id: string;
  message_text: string;
  image_url?: string;
  button_text?: string;
  button_url?: string;
  recipients_count: number;
  sent_at: string;
  recipient_telegram_ids?: string;
}

interface TelegramUser {
  telegram_id: string;
  name?: string;
  telegram_username?: string;
}

export default function BroadcastPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [mounted, setMounted] = useState(false);

  const [messageText, setMessageText] = useState('');
  const [usersCount, setUsersCount] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [history, setHistory] = useState<BroadcastHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Send mode: 'specific' or 'all'
  const [sendMode, setSendMode] = useState<'specific' | 'all'>('all');
  const [telegramIds, setTelegramIds] = useState('');
  const [allUsers, setAllUsers] = useState<TelegramUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Multiple inline buttons support (up to 3)
  const [buttons, setButtons] = useState([
    { text: '', url: '' },
    { text: '', url: '' },
    { text: '', url: '' },
  ]);

  // Mark component as mounted
  useEffect(() => {
    setMounted(true);
  }, []);

  // Debug localStorage tokens
  useEffect(() => {
    if (!mounted) return;

    console.log('=== BROADCAST PAGE LOADED ===');
    console.log('access_token:', localStorage.getItem('access_token') ? 'EXISTS' : 'NOT FOUND');
    console.log('auth_token:', localStorage.getItem('auth_token') ? 'EXISTS' : 'NOT FOUND');
    console.log('user:', localStorage.getItem('user') ? 'EXISTS' : 'NOT FOUND');
    console.log('============================');
  }, [mounted]);

  // Load users count - NO AUTH REDIRECT HERE
  // User coming from /admin is already verified as admin
  useEffect(() => {
    if (!mounted) return;

    // Check if has token, if yes, try to load data
    const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
    if (token) {
      fetchUsersCount();
      fetchAllUsers();
      fetchBroadcastHistory();
    } else {
      console.error('No token found in localStorage - cannot load data');
    }
  }, [mounted]);

  const fetchUsersCount = async () => {
    try {
      // Try access_token first, then fallback to auth_token
      const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');

      console.log('Fetching users count with token:', token ? 'Token exists' : 'NO TOKEN');

      if (!token) {
        console.error('No access token found in localStorage');
        toast.error('Token não encontrado. Por favor, faça login novamente.');
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/broadcast/users-count`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log('Users count response status:', response.status);

      if (response.status === 401) {
        toast.error('Sessão expirada. Por favor, faça logout e login novamente.');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        console.log('Users count data:', data);
        setUsersCount(data.total_users || 0);
      } else {
        console.error('Failed to fetch users count:', response.status);
        const errorData = await response.json().catch(() => ({}));
        console.error('Error data:', errorData);
      }
    } catch (error) {
      console.error('Error fetching users count:', error);
    }
  };

  const fetchAllUsers = async () => {
    try {
      setLoadingUsers(true);
      const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');

      if (!token) {
        console.error('No access token found in localStorage');
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/broadcast/users-list`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        toast.error('Sessão expirada. Por favor, faça logout e login novamente.');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setAllUsers(data.users || []);
      } else {
        console.error('Failed to fetch users list:', response.status);
      }
    } catch (error) {
      console.error('Error fetching users list:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchBroadcastHistory = async () => {
    try {
      setLoadingHistory(true);
      const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');

      console.log('Fetching broadcast history with token:', token ? 'Token exists' : 'NO TOKEN');

      if (!token) {
        console.error('No access token found in localStorage');
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/broadcast/history?limit=10`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log('Broadcast history response status:', response.status);

      if (response.status === 401) {
        toast.error('Sessão expirada. Por favor, faça logout e login novamente.');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        console.log('Broadcast history data:', data);
        setHistory(data.broadcasts || []);
      } else {
        console.error('Failed to fetch broadcast history:', response.status);
        const errorData = await response.json().catch(() => ({}));
        console.error('Error data:', errorData);
      }
    } catch (error) {
      console.error('Error fetching broadcast history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };


  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!messageText.trim()) {
      toast.error('A mensagem não pode estar vazia');
      return;
    }

    // Determine recipients
    let recipientIds: string[] = [];
    if (sendMode === 'all') {
      recipientIds = allUsers.map(u => u.telegram_id);
      if (recipientIds.length === 0) {
        toast.error('Nenhum usuário encontrado');
        return;
      }
    } else {
      recipientIds = telegramIds.split(',').map(id => String(id || '').trim()).filter(id => id);
      if (recipientIds.length === 0) {
        toast.error('Adicione pelo menos um Telegram ID');
        return;
      }
    }

    // Confirm before sending
    const confirmMessage = sendMode === 'all'
      ? `🚨 ATENÇÃO! Tem certeza que deseja enviar esta mensagem para TODOS OS ${recipientIds.length} usuários?\n\nEsta ação não pode ser desfeita!`
      : `Tem certeza que deseja enviar esta mensagem para ${recipientIds.length} usuário(s)?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setIsSending(true);

      // Get auth token
      const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');

      if (!token) {
        throw new Error('Token de autenticação não encontrado. Por favor, faça logout e login novamente.');
      }

      // Filter buttons that have both text and URL
      const validButtons = buttons.filter(b => b.text.trim() && b.url.trim());

      const payload: any = {
        message_text: messageText,
        telegram_ids: recipientIds,
      };

      // Add buttons if any are valid
      if (validButtons.length > 0) {
        payload.inline_buttons = validButtons.map(b => ({
          text: b.text.trim(),
          url: b.url.trim(),
        }));
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/broadcast/send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (response.status === 401) {
        throw new Error('Sessão expirada. Por favor, faça logout e login novamente.');
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Falha ao enviar broadcast');
      }

      const result = await response.json();

      toast.success(
        `Broadcast enviado! ${result.successful_sends} de ${result.total_users} mensagens enviadas com sucesso.`
      );

      // Clear form
      setMessageText('');
      setButtons([
        { text: '', url: '' },
        { text: '', url: '' },
        { text: '', url: '' },
      ]);
      setTelegramIds('');

      // Refresh history
      fetchBroadcastHistory();
    } catch (error: any) {
      console.error('Error sending broadcast:', error);
      toast.error(error.message || 'Erro ao enviar broadcast');
    } finally {
      setIsSending(false);
    }
  };

  // Show loading only briefly during initial mount
  if (!mounted || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    );
  }

  // No auth check here - user coming from /admin is already verified
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-red-500 via-red-600 to-red-700 bg-clip-text text-transparent mb-2">
                Marketing via Telegram
              </h1>
              <p className="text-gray-400 text-lg">
                Envie mensagens de marketing para usuários do Telegram com botões personalizados
              </p>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/admin')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700/50 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                Voltar
              </button>

              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700/50 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                <HomeIcon className="w-5 h-5" />
                Home
              </button>
            </div>
          </div>
        </div>

        {/* Users Count Card */}
        <div className="mb-6">
          <div className="relative bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50 hover:border-gray-600 transition-all duration-300 group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-purple-700 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>

            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 shadow-lg">
                  <UsersIcon className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-400">Usuários cadastrados</p>
                  <p className="text-3xl font-bold text-white">{usersCount}</p>
                </div>
              </div>
              <button
                onClick={fetchUsersCount}
                className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 rounded-lg transition-colors text-sm font-medium"
              >
                Atualizar
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSendBroadcast} className="relative bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50 space-y-6">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <PaperAirplaneIcon className="w-6 h-6 mr-2 text-red-500" />
                Compor Mensagem
              </h2>

              {/* Send Mode Toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Destinatários *
                </label>
                <div className="flex items-center gap-4 p-4 bg-gray-900/30 rounded-lg border border-gray-700/50">
                  <button
                    type="button"
                    onClick={() => setSendMode('all')}
                    className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                      sendMode === 'all'
                        ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-500/30'
                        : 'bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    <UsersIcon className="w-5 h-5 inline-block mr-2" />
                    Todos os Usuários ({allUsers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendMode('specific')}
                    className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                      sendMode === 'specific'
                        ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-500/30'
                        : 'bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    IDs Específicos
                  </button>
                </div>
              </div>

              {/* Specific IDs Input (if sendMode === 'specific') */}
              {sendMode === 'specific' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Telegram IDs *
                  </label>
                  <textarea
                    value={telegramIds}
                    onChange={(e) => setTelegramIds(e.target.value)}
                    placeholder="Digite os Telegram IDs separados por vírgula. Ex: 123456789, 987654321"
                    rows={3}
                    className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                    required
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Separe múltiplos IDs com vírgula
                  </p>
                </div>
              )}

              {/* All Users List (if sendMode === 'all') */}
              {sendMode === 'all' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Usuários que receberão a mensagem
                  </label>
                  <div className="bg-gray-900/30 border border-gray-700/50 rounded-lg p-4 max-h-48 overflow-y-auto">
                    {loadingUsers ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500 mx-auto"></div>
                      </div>
                    ) : allUsers.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">
                        Nenhum usuário encontrado
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {allUsers.map((user, index) => (
                          <div
                            key={user.telegram_id}
                            className="flex items-center gap-2 text-xs text-gray-400 bg-gray-800/30 rounded px-2 py-1"
                          >
                            <span className="text-gray-600">#{index + 1}</span>
                            <span className="font-mono text-gray-300">{user.telegram_id}</span>
                            {user.name && (
                              <span className="text-gray-500 truncate">
                                - {user.name}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-yellow-500 flex items-center">
                    ⚠️ Envio em massa para {allUsers.length} usuários
                  </p>
                </div>
              )}

              {/* Message Text */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Mensagem *
                </label>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Digite a mensagem que será enviada aos usuários..."
                  rows={6}
                  maxLength={4000}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  required
                />
                <p className="mt-2 text-xs text-gray-500">
                  {messageText.length}/4000 caracteres • Suporta Markdown
                </p>
              </div>

              {/* Inline Buttons Configuration */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Botões Inline (Opcional)
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Adicione até 3 botões que serão exibidos abaixo da mensagem
                </p>
                <div className="space-y-3">
                  {buttons.map((button, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-gray-900/30 rounded-lg border border-gray-700/50">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">
                          Botão {index + 1} - Texto
                        </label>
                        <input
                          type="text"
                          value={button.text}
                          onChange={(e) => {
                            const newButtons = [...buttons];
                            newButtons[index].text = e.target.value;
                            setButtons(newButtons);
                          }}
                          placeholder={`Ex: ${index === 0 ? 'Acessar Site' : index === 1 ? 'Ver Catálogo' : 'Suporte'}`}
                          maxLength={50}
                          className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">
                          Botão {index + 1} - URL
                        </label>
                        <input
                          type="url"
                          value={button.url}
                          onChange={(e) => {
                            const newButtons = [...buttons];
                            newButtons[index].url = e.target.value;
                            setButtons(newButtons);
                          }}
                          placeholder="https://..."
                          className="w-full bg-gray-900/50 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Send Button */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                <p className="text-sm text-gray-400">
                  {sendMode === 'all' ? (
                    <>Enviando para <strong className="text-white">{allUsers.length}</strong> usuário(s)</>
                  ) : telegramIds.trim() ? (
                    <>Enviando para <strong className="text-white">{telegramIds.split(',').map(id => String(id || '').trim()).filter(id => id).length}</strong> ID(s) específico(s)</>
                  ) : (
                    <>Nenhum ID especificado</>
                  )}
                </p>
                <button
                  type="submit"
                  disabled={isSending || (sendMode === 'specific' && !telegramIds.trim()) || (sendMode === 'all' && allUsers.length === 0)}
                  className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-lg transition-all duration-300 shadow-lg hover:shadow-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center space-x-2"
                >
                  {isSending ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <PaperAirplaneIcon className="w-5 h-5" />
                      <span>Enviar Marketing</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Sidebar - History */}
          <div className="lg:col-span-1">
            <div className="relative bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50 sticky top-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center">
                  <ClockIcon className="w-5 h-5 mr-2 text-red-500" />
                  Histórico
                </h2>
                <button
                  onClick={fetchBroadcastHistory}
                  className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
                >
                  Atualizar
                </button>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                {loadingHistory ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto"></div>
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-8">
                    <ClockIcon className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">
                      Nenhum broadcast enviado ainda
                    </p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50 hover:border-gray-600 transition-all duration-300 hover:scale-105"
                    >
                      <p className="text-sm text-gray-300 line-clamp-2 mb-3">
                        {item.message_text}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                        <span className="flex items-center">
                          <CheckCircleIcon className="w-3 h-3 mr-1 text-green-500" />
                          {item.recipients_count} enviados
                        </span>
                        <span>
                          {new Date(item.sent_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {item.recipient_telegram_ids && (
                        <div className="text-xs text-gray-600 mb-2 bg-gray-800/50 rounded px-2 py-1">
                          <span className="text-gray-500">IDs: </span>
                          <span className="text-gray-400 font-mono">
                            {item.recipient_telegram_ids}
                          </span>
                        </div>
                      )}
                      {item.button_text && (
                        <div className="flex items-center text-xs text-gray-600">
                          <LinkIcon className="w-3 h-3 mr-1" />
                          {item.button_text}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
