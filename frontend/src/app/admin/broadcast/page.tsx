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
  XMarkIcon,
  TrashIcon,
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
    console.log('[Broadcast Debug]', {
      authLoading,
      isAuthenticated,
      userRole: user?.role,
      userEmail: user?.email,
      shouldRedirect: !authLoading && (!isAuthenticated || user?.role !== 'admin')
    });

    if (!authLoading && (!isAuthenticated || user?.role !== 'admin')) {
      console.log('[Broadcast] Redirecting to home - not authenticated or not admin');
      router.push('/');
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
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/broadcast/users-count`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setUsersCount(data.total_users || 0);
      }
    } catch (error) {
      console.error('Error fetching users count:', error);
    }
  };

  const fetchBroadcastHistory = async () => {
    try {
      setLoadingHistory(true);
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/broadcast/history?limit=10`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setHistory(data.broadcasts || []);
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
    const ids = telegramIds.split(',').map(id => id.trim()).filter(id => id);
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

        if (!uploadResponse.ok) {
          throw new Error('Falha ao fazer upload da imagem');
        }

        const uploadData = await uploadResponse.json();
        imageUrl = uploadData.image_url;
        setIsUploading(false);
      }

      // Send broadcast
      const token = localStorage.getItem('access_token');
      const payload: any = {
        message_text: messageText,
        image_url: imageUrl || undefined,
        button_text: buttonText && buttonUrl ? buttonText : undefined,
        button_url: buttonText && buttonUrl ? buttonUrl : undefined,
      };

      // Add telegram_ids (required)
      payload.telegram_ids = telegramIds.split(',').map(id => id.trim()).filter(id => id);

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

      if (!response.ok) {
        const error = await response.json();
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
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-dark-900 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Marketing
          </h1>
          <p className="text-gray-400">
            Envie mensagens para IDs específicos de usuários que iniciaram conversa com o bot
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Users Count Card */}
            <div className="bg-dark-800 rounded-lg border border-white/10 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <UsersIcon className="w-8 h-8 text-primary-500" />
                  <div>
                    <p className="text-sm text-gray-400">Usuários cadastrados</p>
                    <p className="text-2xl font-bold text-white">{usersCount}</p>
                  </div>
                </div>
                <button
                  onClick={fetchUsersCount}
                  className="text-sm text-primary-500 hover:text-primary-400"
                >
                  Atualizar
                </button>
              </div>
            </div>

            {/* Broadcast Form */}
            <form onSubmit={handleSendBroadcast} className="bg-dark-800 rounded-lg border border-white/10 p-6 space-y-6">
              <h2 className="text-xl font-semibold text-white">Compor Mensagem</h2>

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
                  className="w-full bg-dark-900 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
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
                  className="w-full bg-dark-900 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
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
                      className="w-full h-48 object-cover rounded-lg border border-white/10"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 rounded-full transition-colors"
                    >
                      <TrashIcon className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-48 border-2 border-dashed border-white/10 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary-500 hover:bg-primary-500/5 transition-colors"
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
                    className="w-full bg-dark-900 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                    className="w-full bg-dark-900 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Send Button */}
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <p className="text-sm text-gray-400">
                  {telegramIds.trim() ? (
                    <>Enviando para <strong>{telegramIds.split(',').filter(id => id.trim()).length}</strong> ID(s) específico(s)</>
                  ) : (
                    <>Nenhum ID especificado</>
                  )}
                </p>
                <button
                  type="submit"
                  disabled={isSending || isUploading || !telegramIds.trim()}
                  className="btn-primary px-6 py-3 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
            <div className="bg-dark-800 rounded-lg border border-white/10 p-6 sticky top-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center">
                  <ClockIcon className="w-5 h-5 mr-2" />
                  Histórico
                </h2>
                <button
                  onClick={fetchBroadcastHistory}
                  className="text-xs text-primary-500 hover:text-primary-400"
                >
                  Atualizar
                </button>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {loadingHistory ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
                  </div>
                ) : history.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    Nenhum broadcast enviado ainda
                  </p>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      className="bg-dark-900 rounded-lg p-3 border border-white/5 hover:border-white/10 transition-colors"
                    >
                      <p className="text-sm text-gray-300 line-clamp-2 mb-2">
                        {item.message_text}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-500">
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
                        <div className="mt-2 flex items-center text-xs text-gray-600">
                          <PhotoIcon className="w-3 h-3 mr-1" />
                          Com imagem
                        </div>
                      )}
                      {item.button_text && (
                        <div className="mt-2 flex items-center text-xs text-gray-600">
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
