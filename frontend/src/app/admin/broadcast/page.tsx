'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { uploadImageToSupabase } from '@/lib/supabaseStorage';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface BroadcastProgress {
  id: string;
  status: 'sending' | 'completed' | 'failed';
  total_users: number;
  successful_sends: number;
  failed_sends: number;
  progress_percent: number;
}

interface BroadcastHistory {
  id: string;
  message_text: string;
  image_url?: string;
  button_text?: string;
  button_url?: string;
  recipients_count: number;
  total_users?: number;
  successful_sends?: number;
  failed_sends?: number;
  status?: string;
  sent_at: string;
}

function getHeaders() {
  const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export default function BroadcastPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [messageText, setMessageText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [buttons, setButtons] = useState([{ text: '', url: '' }]);
  const [sendMode, setSendMode] = useState<'all' | 'specific'>('all');
  const [telegramIds, setTelegramIds] = useState('');

  // Data state
  const [usersCount, setUsersCount] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [activeBroadcast, setActiveBroadcast] = useState<BroadcastProgress | null>(null);
  const [sendStartTime, setSendStartTime] = useState<number | null>(null);
  const [history, setHistory] = useState<BroadcastHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Load initial data
  useEffect(() => {
    if (!mounted) return;
    const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
    if (token) {
      fetchUsersCount();
      fetchHistory();
    }
  }, [mounted]);

  // Poll broadcast progress
  useEffect(() => {
    if (!activeBroadcast || activeBroadcast.status !== 'sending') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/admin/broadcast/progress/${activeBroadcast.id}`, {
          headers: getHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setActiveBroadcast(data);
          if (data.status !== 'sending') {
            clearInterval(interval);
            if (data.status === 'completed') {
              toast.success(`Broadcast concluído! ${data.successful_sends} enviados com sucesso.`);
            } else {
              toast.error(`Broadcast falhou. ${data.successful_sends} enviados, ${data.failed_sends} falharam.`);
            }
            fetchHistory();
          }
        }
      } catch (err) {
        console.error('Error polling progress:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeBroadcast?.id, activeBroadcast?.status]);

  const fetchUsersCount = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/broadcast/users-count`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setUsersCount(data.total_users || 0);
      }
    } catch (err) {
      console.error('Error fetching users count:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await fetch(`${API_URL}/api/v1/admin/broadcast/history?limit=10`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.broadcasts || []);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx. 10MB)');
      return;
    }

    // Show local preview
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);

    // Upload to Supabase Storage (same as posters/backdrops - always works)
    setUploadingImage(true);
    try {
      const result = await uploadImageToSupabase(file, 'cinevision-capas', 'broadcast');

      if (result.error || !result.publicUrl) {
        toast.error(`Falha ao enviar imagem: ${result.error || 'Erro desconhecido'}`);
        setImagePreview('');
      } else {
        setImageUrl(result.publicUrl);
        toast.success('Imagem carregada');
      }
    } catch (err: any) {
      console.error('Upload exception:', err);
      toast.error(`Erro ao enviar imagem: ${err.message || 'Verifique sua conexão'}`);
      setImagePreview('');
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = () => {
    setImageUrl('');
    setImagePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addButton = () => {
    if (buttons.length < 3) {
      setButtons([...buttons, { text: '', url: '' }]);
    }
  };

  const removeButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) {
      toast.error('Escreva a mensagem');
      return;
    }

    // Get recipient IDs
    let recipientIds: string[];
    if (sendMode === 'all') {
      recipientIds = ['all'];
    } else {
      recipientIds = telegramIds.split(',').map(id => id.trim()).filter(Boolean);
      if (recipientIds.length === 0) {
        toast.error('Adicione pelo menos um Telegram ID');
        return;
      }
    }

    const targetCount = sendMode === 'all' ? usersCount : recipientIds.length;
    if (!confirm(`Enviar para ${targetCount} usuário(s)?\n\nEsta ação não pode ser desfeita.`)) return;

    setIsSending(true);
    try {
      const validButtons = buttons.filter(b => b.text.trim() && b.url.trim());
      const payload: any = {
        message_text: messageText,
        telegram_ids: recipientIds,
      };
      if (imageUrl) payload.image_url = imageUrl;
      if (validButtons.length > 0) {
        payload.inline_buttons = validButtons.map(b => ({ text: b.text.trim(), url: b.url.trim() }));
      }

      const res = await fetch(`${API_URL}/api/v1/admin/broadcast/send`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Falha ao enviar');
      }

      const result = await res.json();
      toast.success(`Broadcast iniciado para ${result.total_users} usuários`);

      // Start polling progress
      setSendStartTime(Date.now());
      setActiveBroadcast({
        id: result.broadcast_id,
        status: 'sending',
        total_users: result.total_users,
        successful_sends: 0,
        failed_sends: 0,
        progress_percent: 0,
      });

      // Clear form
      setMessageText('');
      removeImage();
      setButtons([{ text: '', url: '' }]);
      setTelegramIds('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar');
    } finally {
      setIsSending(false);
    }
  };

  // Format message preview (Markdown-like)
  const formatPreview = (text: string) => {
    return text
      .replace(/\*([^*]+)\*/g, '<b>$1</b>')
      .replace(/_([^_]+)_/g, '<i>$1</i>')
      .replace(/\n/g, '<br/>');
  };

  if (!mounted || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500" />
      </div>
    );
  }

  const validButtonsCount = buttons.filter(b => b.text.trim() && b.url.trim()).length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Marketing Telegram</h1>
            <p className="text-sm text-gray-500 mt-1">
              {usersCount} usuários disponíveis
            </p>
          </div>
          <button
            onClick={() => router.push('/admin')}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          >
            Voltar
          </button>
        </div>

        {/* Progress Bar (when sending) */}
        {activeBroadcast && (
          <div className="mb-6 bg-[#111] rounded-xl border border-gray-800 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {activeBroadcast.status === 'sending' ? (
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                ) : activeBroadcast.status === 'completed' ? (
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                )}
                <span className="text-sm font-medium text-white">
                  {activeBroadcast.status === 'sending' ? 'Enviando...' :
                   activeBroadcast.status === 'completed' ? 'Concluído' : 'Falhou'}
                </span>
              </div>
              <span className="text-sm text-gray-400">
                {activeBroadcast.successful_sends} / {activeBroadcast.total_users}
                {activeBroadcast.failed_sends > 0 && (
                  <span className="text-red-400 ml-2">({activeBroadcast.failed_sends} falhas)</span>
                )}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  activeBroadcast.status === 'completed' ? 'bg-green-500' :
                  activeBroadcast.status === 'failed' ? 'bg-red-500' :
                  'bg-blue-500'
                }`}
                style={{ width: `${activeBroadcast.progress_percent}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
              <span>{activeBroadcast.progress_percent}%</span>
              {activeBroadcast.status === 'sending' && sendStartTime && (() => {
                const elapsed = (Date.now() - sendStartTime) / 1000;
                const sent = activeBroadcast.successful_sends + activeBroadcast.failed_sends;
                const rate = sent > 0 ? sent / elapsed : 0;
                const remaining = activeBroadcast.total_users - sent;
                const estSeconds = rate > 0 ? remaining / rate : 0;
                const formatTime = (s: number) => {
                  if (s < 60) return `${Math.round(s)}s`;
                  if (s < 3600) return `${Math.floor(s / 60)}min ${Math.round(s % 60)}s`;
                  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}min`;
                };
                return (
                  <div className="flex items-center gap-4">
                    <span>~{rate.toFixed(1)} msg/seg</span>
                    <span>Decorrido: {formatTime(elapsed)}</span>
                    {rate > 0 && <span>Restante: ~{formatTime(estSeconds)}</span>}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Form — 3/5 */}
          <form onSubmit={handleSend} className="lg:col-span-3 space-y-5">

            {/* Recipients */}
            <div className="bg-[#111] rounded-xl border border-gray-800 p-5">
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Destinatários</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSendMode('all')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    sendMode === 'all'
                      ? 'bg-red-600 text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  Todos ({usersCount})
                </button>
                <button
                  type="button"
                  onClick={() => setSendMode('specific')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    sendMode === 'specific'
                      ? 'bg-red-600 text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  IDs Específicos
                </button>
              </div>
              {sendMode === 'specific' && (
                <textarea
                  value={telegramIds}
                  onChange={(e) => setTelegramIds(e.target.value)}
                  placeholder="IDs separados por vírgula: 123456, 789012..."
                  rows={2}
                  className="w-full mt-3 bg-black/30 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-red-500/50"
                />
              )}
            </div>

            {/* Image Upload */}
            <div className="bg-[#111] rounded-xl border border-gray-800 p-5">
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                Imagem (opcional)
              </label>
              {imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="Preview" className="w-full max-h-48 object-cover rounded-lg" />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/70 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-colors"
                  >
                    ✕
                  </button>
                  {uploadingImage && (
                    <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-8 border-2 border-dashed border-gray-700 rounded-lg hover:border-gray-600 transition-colors flex flex-col items-center gap-2 text-gray-500 hover:text-gray-400"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm">Clique para adicionar imagem</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                }}
              />
            </div>

            {/* Message */}
            <div className="bg-[#111] rounded-xl border border-gray-800 p-5">
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Mensagem</label>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Escreva sua mensagem aqui...&#10;&#10;Use *negrito* e _itálico_ para formatação"
                rows={6}
                maxLength={4000}
                className="w-full bg-black/30 border border-gray-700/50 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-red-500/50 resize-none"
                required
              />
              <p className="text-xs text-gray-600 mt-2 text-right">{messageText.length}/4000</p>
            </div>

            {/* Inline Buttons */}
            <div className="bg-[#111] rounded-xl border border-gray-800 p-5">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Botões (opcional)</label>
                {buttons.length < 3 && (
                  <button
                    type="button"
                    onClick={addButton}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    + Adicionar
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {buttons.map((btn, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={btn.text}
                      onChange={(e) => {
                        const next = [...buttons];
                        next[i].text = e.target.value;
                        setButtons(next);
                      }}
                      placeholder="Texto do botão"
                      maxLength={50}
                      className="flex-1 bg-black/30 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-red-500/50"
                    />
                    <input
                      type="url"
                      value={btn.url}
                      onChange={(e) => {
                        const next = [...buttons];
                        next[i].url = e.target.value;
                        setButtons(next);
                      }}
                      placeholder="https://..."
                      className="flex-1 bg-black/30 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-red-500/50"
                    />
                    {buttons.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeButton(i)}
                        className="px-2 text-gray-600 hover:text-red-400 transition-colors"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Send Button */}
            <button
              type="submit"
              disabled={isSending || !messageText.trim() || uploadingImage || (activeBroadcast?.status === 'sending')}
              className="w-full py-3.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {isSending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Enviando...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Enviar Broadcast
                </>
              )}
            </button>
          </form>

          {/* Sidebar — 2/5: Preview + History */}
          <div className="lg:col-span-2 space-y-6">

            {/* Preview */}
            <div className="bg-[#111] rounded-xl border border-gray-800 p-5">
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Preview</label>
              <div className="bg-[#1a2332] rounded-xl overflow-hidden max-w-sm mx-auto">
                {/* Image preview */}
                {imagePreview && (
                  <img src={imagePreview} alt="Preview" className="w-full max-h-40 object-cover" />
                )}
                {/* Message */}
                <div className="p-3">
                  {messageText ? (
                    <p
                      className="text-sm text-white leading-relaxed break-words"
                      dangerouslySetInnerHTML={{ __html: formatPreview(messageText) }}
                    />
                  ) : (
                    <p className="text-sm text-gray-600 italic">Sua mensagem aparecerá aqui...</p>
                  )}
                </div>
                {/* Buttons preview */}
                {validButtonsCount > 0 && (
                  <div className="px-3 pb-3 space-y-1">
                    {buttons.filter(b => b.text.trim()).map((btn, i) => (
                      <div
                        key={i}
                        className="w-full py-2 bg-[#2b5278] text-[#64b5ef] text-sm text-center rounded font-medium"
                      >
                        {btn.text}
                      </div>
                    ))}
                  </div>
                )}
                {/* Timestamp */}
                <div className="px-3 pb-2 text-right">
                  <span className="text-[10px] text-gray-500">
                    {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>

            {/* History */}
            <div className="bg-[#111] rounded-xl border border-gray-800 p-5">
              <div className="flex items-center justify-between mb-4">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Histórico</label>
                <button
                  onClick={fetchHistory}
                  className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
                >
                  Atualizar
                </button>
              </div>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {loadingHistory ? (
                  <div className="text-center py-6">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500 mx-auto" />
                  </div>
                ) : history.length === 0 ? (
                  <p className="text-center text-sm text-gray-600 py-6">Nenhum envio ainda</p>
                ) : (
                  history.map((item) => (
                    <div key={item.id} className="bg-black/30 rounded-lg p-3 border border-gray-800/50">
                      {item.image_url && (
                        <img src={item.image_url} alt="" className="w-full h-20 object-cover rounded mb-2" />
                      )}
                      <p className="text-xs text-gray-300 line-clamp-2 mb-2">{item.message_text}</p>
                      <div className="flex items-center justify-between text-[10px] text-gray-500">
                        <span className="flex items-center gap-1">
                          {item.status === 'completed' ? (
                            <span className="text-green-500">●</span>
                          ) : item.status === 'sending' ? (
                            <span className="text-blue-500 animate-pulse">●</span>
                          ) : item.status === 'failed' ? (
                            <span className="text-red-500">●</span>
                          ) : (
                            <span className="text-gray-500">●</span>
                          )}
                          {item.successful_sends ?? item.recipients_count} enviados
                          {item.failed_sends ? ` · ${item.failed_sends} falhas` : ''}
                        </span>
                        <span>
                          {new Date(item.sent_at).toLocaleDateString('pt-BR', {
                            day: '2-digit', month: '2-digit',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>
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
