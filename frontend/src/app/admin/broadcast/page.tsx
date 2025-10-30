'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import {
  PaperAirplaneIcon,
  PhotoIcon,
  LinkIcon,
  UsersIcon,
  ClockIcon,
  CheckCircleIcon,
  TrashIcon,
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
}

export default function BroadcastPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [messageText, setMessageText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [buttonText, setButtonText] = useState('Acessar site');
  const [buttonUrl, setButtonUrl] = useState('');
  const [usersCount, setUsersCount] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [history, setHistory] = useState<BroadcastHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Targeted messaging - only specific IDs allowed
  const [telegramIds, setTelegramIds] = useState('');

  // Redirect if not authenticated or not admin
  useEffect(() => {
    // Only redirect after auth has finished loading AND user is confirmed not admin
    if (!authLoading) {
      if (!isAuthenticated) {
        console.log('Not authenticated, redirecting to login');
        router.push('/login');
      } else if (user && user.role !== 'admin') {
        console.log('Not admin, redirecting to home');
        router.push('/');
      }
    }
  }, [isAuthenticated, user, authLoading, router]);

  // Load users count
  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      fetchUsersCount();
      fetchBroadcastHistory();
    }
  }, [isAuthenticated, user]);

  const fetchUsersCount = async () => {
    try {
      const token = localStorage.getItem('access_token');

      if (!token) {
        console.error('No access token found');
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

      if (response.status === 401) {
        toast.error('Sessão expirada. Por favor, faça logout e login novamente.');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setUsersCount(data.total_users || 0);
      } else {
        console.error('Failed to fetch users count:', response.status);
      }
    } catch (error) {
      console.error('Error fetching users count:', error);
    }
  };

  const fetchBroadcastHistory = async () => {
    try {
      setLoadingHistory(true);
      const token = localStorage.getItem('access_token');

      if (!token) {
        console.error('No access token found');
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

      if (response.status === 401) {
        toast.error('Sessão expirada. Por favor, faça logout e login novamente.');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setHistory(data.broadcasts || []);
      } else {
        console.error('Failed to fetch broadcast history:', response.status);
      }
    } catch (error) {
      console.error('Error fetching broadcast history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Por favor, selecione apenas imagens');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Imagem muito grande. Máximo 5MB');
        return;
      }

      setImageFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!messageText.trim()) {
      toast.error('A mensagem não pode estar vazia');
      return;
    }

    // Validate telegram IDs
    const ids = telegramIds.split(',').map(id => String(id || '').trim()).filter(id => id);
    if (ids.length === 0) {
      toast.error('Adicione pelo menos um Telegram ID');
      return;
    }

    // Confirm before sending
    const confirmMessage = `Tem certeza que deseja enviar esta mensagem para ${ids.length} usuário(s)?`;
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setIsSending(true);
      let imageUrl = '';

      // Upload image if provided
      if (imageFile) {
        setIsUploading(true);
        const formData = new FormData();
        formData.append('image', imageFile);

        const token = localStorage.getItem('access_token');

        if (!token) {
          throw new Error('Token de autenticação não encontrado. Por favor, faça logout e login novamente.');
        }

        const uploadResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/broadcast/upload-image`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          }
        );

        if (uploadResponse.status === 401) {
          throw new Error('Sessão expirada. Por favor, faça logout e login novamente.');
        }

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json().catch(() => ({}));
          throw new Error(errorData.message || 'Falha ao fazer upload da imagem');
        }

        const uploadData = await uploadResponse.json();
        imageUrl = uploadData.image_url;
        setIsUploading(false);
      }

      // Send broadcast
      const token = localStorage.getItem('access_token');

      if (!token) {
        throw new Error('Token de autenticação não encontrado. Por favor, faça logout e login novamente.');
      }

      const payload: any = {
        message_text: messageText,
        telegram_ids: telegramIds.split(',').map(id => String(id || '').trim()).filter(id => id),
      };

      // Only add optional fields if they have values
      if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim()) {
        payload.image_url = imageUrl.trim();
      }
      if (buttonText && typeof buttonText === 'string' && buttonText.trim() &&
          buttonUrl && typeof buttonUrl === 'string' && buttonUrl.trim()) {
        payload.button_text = buttonText.trim();
        payload.button_url = buttonUrl.trim();
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
      handleRemoveImage();
      setButtonText('Acessar site');
      setButtonUrl('');
      setTelegramIds('');

      // Refresh history
      fetchBroadcastHistory();
    } catch (error: any) {
      console.error('Error sending broadcast:', error);
      toast.error(error.message || 'Erro ao enviar broadcast');
    } finally {
      setIsSending(false);
      setIsUploading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-red-500 via-red-600 to-red-700 bg-clip-text text-transparent mb-2">
                Marketing
              </h1>
              <p className="text-gray-400 text-lg">
                Envie mensagens para IDs específicos de usuários que iniciaram conversa com o bot
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

              {/* Telegram IDs Input */}
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

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
                  <PhotoIcon className="w-4 h-4 mr-2" />
                  Imagem (opcional)
                </label>

                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-48 object-cover rounded-lg border border-gray-700"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 rounded-full transition-colors shadow-lg"
                    >
                      <TrashIcon className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-48 border-2 border-dashed border-gray-700 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-red-500 hover:bg-red-500/5 transition-all"
                  >
                    <PhotoIcon className="w-12 h-12 text-gray-600 mb-2" />
                    <p className="text-sm text-gray-500">Clique para selecionar imagem</p>
                    <p className="text-xs text-gray-600 mt-1">PNG, JPG até 5MB</p>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>

              {/* Button Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Texto do Botão
                  </label>
                  <input
                    type="text"
                    value={buttonText}
                    onChange={(e) => setButtonText(e.target.value)}
                    placeholder="Ex: Acessar site"
                    maxLength={100}
                    className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
                    <LinkIcon className="w-4 h-4 mr-2" />
                    URL do Botão
                  </label>
                  <input
                    type="url"
                    value={buttonUrl}
                    onChange={(e) => setButtonUrl(e.target.value)}
                    placeholder="https://cine-vision-murex.vercel.app"
                    className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Send Button */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                <p className="text-sm text-gray-400">
                  {telegramIds.trim() ? (
                    <>Enviando para <strong className="text-white">{telegramIds.split(',').map(id => String(id || '').trim()).filter(id => id).length}</strong> ID(s) específico(s)</>
                  ) : (
                    <>Nenhum ID especificado</>
                  )}
                </p>
                <button
                  type="submit"
                  disabled={isSending || isUploading || !telegramIds.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-lg transition-all duration-300 shadow-lg hover:shadow-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center space-x-2"
                >
                  {isSending || isUploading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>{isUploading ? 'Enviando imagem...' : 'Enviando...'}</span>
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
                      {item.image_url && (
                        <div className="flex items-center text-xs text-gray-600 mb-1">
                          <PhotoIcon className="w-3 h-3 mr-1" />
                          Com imagem
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
