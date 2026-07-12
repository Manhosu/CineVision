'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { uploadImageToSupabase } from '@/lib/supabaseStorage';
import { supabase } from '@/lib/supabase';

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
  inline_buttons?: Array<{ text: string; url: string }>;
  recipients_count: number;
  total_users?: number;
  successful_sends?: number;
  failed_sends?: number;
  progress_percent?: number;
  status?: string;
  sent_at: string;
  failed_telegram_ids?: string;
}

function formatBrDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatTime(s: number) {
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min ${Math.round(s % 60)}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}min`;
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

  // Channel state
  const [channel, setChannel] = useState<'telegram' | 'whatsapp'>('telegram');
  const [waUsersCount, setWaUsersCount] = useState(0);
  const [waConfigured, setWaConfigured] = useState<boolean | null>(null);

  // Data state
  const [usersCount, setUsersCount] = useState(0);
  // Igor (12/05): detalhamento da diferença 402/217 (registered vs eligible).
  const [broadcastStats, setBroadcastStats] = useState<{
    total_registered: number;
    broadcast_eligible: number;
    whatsapp_eligible: number;
    gap: number;
  } | null>(null);
  // Igor (11/07): breakdown oficial/promocional/whatsapp/total (endpoint /users-breakdown)
  const [breakdown, setBreakdown] = useState<{
    official: number;
    promotional: number;
    whatsapp: number;
    total: number;
  } | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [activeBroadcast, setActiveBroadcast] = useState<BroadcastProgress | null>(null);
  const [sendStartTime, setSendStartTime] = useState<number | null>(null);
  const [history, setHistory] = useState<BroadcastHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [selectedBroadcast, setSelectedBroadcast] = useState<BroadcastHistory | null>(null);
  const [modalLive, setModalLive] = useState<BroadcastHistory | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // Load initial data
  useEffect(() => {
    if (!mounted) return;
    const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
    if (token) {
      fetchUsersCount();
      fetchBroadcastStats();
      fetchBreakdown();
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

  // Supabase Realtime: subscribe to broadcast updates when modal is open
  useEffect(() => {
    if (!selectedBroadcast) { setModalLive(null); return; }
    setModalLive(selectedBroadcast);

    // If already completed/failed, no need for realtime
    if (selectedBroadcast.status !== 'sending') return;

    const channel = supabase
      .channel(`broadcast-${selectedBroadcast.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'broadcasts', filter: `id=eq.${selectedBroadcast.id}` },
        (payload: any) => {
          const row = payload.new;
          setModalLive(prev => prev ? { ...prev, ...row } : prev);
          // Also update in history list
          setHistory(h => h.map(item => item.id === row.id ? { ...item, ...row } : item));
          if (row.status === 'completed') {
            toast.success(`Broadcast concluído! ${row.successful_sends} enviados.`);
            fetchHistory();
          } else if (row.status === 'failed') {
            toast.error(`Broadcast falhou.`);
            fetchHistory();
          }
        }
      )
      .subscribe();

    // Also poll as fallback (realtime may not be enabled)
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/admin/broadcast/progress/${selectedBroadcast.id}`, { headers: getHeaders() });
        if (res.ok) {
          const data = await res.json();
          setModalLive(prev => prev ? { ...prev, ...data } : prev);
          setHistory(h => h.map(item => item.id === data.id ? { ...item, ...data } : item));
          if (data.status !== 'sending') {
            clearInterval(pollInterval);
            if (data.status === 'completed') fetchHistory();
          }
        }
      } catch {}
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [selectedBroadcast?.id]);

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

  // Igor (11/07): breakdown oficial/promocional/whatsapp/total.
  const fetchBreakdown = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/broadcast/users-breakdown`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBreakdown({
          official: data.official || 0,
          promotional: data.promotional || 0,
          whatsapp: data.whatsapp || 0,
          total: data.total || 0,
        });
      }
    } catch (err) {
      console.error('Error fetching breakdown:', err);
    }
  };

  // Igor (12/05): busca estatísticas detalhadas para mostrar a diferença
  // entre cadastrados e disponíveis para broadcast com tooltip explicativo.
  const fetchBroadcastStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/broadcast/users-stats`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBroadcastStats({
          total_registered: data.total_registered || 0,
          broadcast_eligible: data.broadcast_eligible || 0,
          whatsapp_eligible: data.whatsapp_eligible || 0,
          gap: data.gap || 0,
        });
      }
    } catch (err) {
      console.error('Error fetching broadcast stats:', err);
    }
  };

  const fetchWaUsersCount = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/broadcast/users-count?channel=whatsapp`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setWaUsersCount(data.total_users || 0);
        // If we got data, Evolution API may or may not be configured — check separately
      }
    } catch (err) {
      console.error('Error fetching WA users count:', err);
    }
  };

  // Fetch WA count when channel switches to whatsapp
  useEffect(() => {
    if (channel === 'whatsapp' && waUsersCount === 0) fetchWaUsersCount();
  }, [channel]);

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

    const targetCount = channel === 'whatsapp'
      ? waUsersCount
      : (sendMode === 'all' ? usersCount : recipientIds.length);
    if (!confirm(`Enviar ${channel === 'whatsapp' ? 'WhatsApp' : 'Telegram'} para ${targetCount} usuário(s)?\n\nEsta ação não pode ser desfeita.`)) return;

    setIsSending(true);
    try {
      const validButtons = buttons.filter(b => b.text.trim() && b.url.trim());
      const payload: any = {
        message_text: messageText,
        telegram_ids: channel === 'whatsapp' ? ['all'] : recipientIds,
        channel,
      };
      if (channel === 'telegram') {
        if (imageUrl) payload.image_url = imageUrl;
        if (validButtons.length > 0) {
          payload.inline_buttons = validButtons.map(b => ({ text: b.text.trim(), url: b.url.trim() }));
        }
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
            <h1 className="text-2xl font-bold text-white">Marketing</h1>
            <p className="text-sm text-gray-500 mt-1">
              {channel === 'whatsapp'
                ? `${waUsersCount} usuários com WhatsApp`
                : `${usersCount} usuários Telegram disponíveis`}
            </p>
          </div>
          <button
            onClick={() => router.push('/admin')}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          >
            Voltar
          </button>
        </div>

        {/* Igor (12/05): contadores duplos com tooltip explicativo
            (cadastrados vs disponíveis para broadcast). Resolve a confusão
            "402 ativos vs 217 no marketing". */}
        {broadcastStats && (
          <div className="mb-6 bg-[#111] rounded-xl border border-gray-800 p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white/[0.03] rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Cadastrados</p>
                <p className="text-2xl font-bold text-white mt-1">{broadcastStats.total_registered}</p>
                <p className="text-xs text-gray-500 mt-1">usuários com Telegram ID</p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs text-blue-400 uppercase tracking-wide font-medium">Telegram broadcast</p>
                  <div className="group relative">
                    <svg className="w-3.5 h-3.5 text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-900 border border-white/10 rounded-lg p-3 text-xs text-gray-300 invisible group-hover:visible z-50 shadow-xl pointer-events-none">
                      O Telegram só permite enviar mensagens para quem iniciou conversa com o bot (/start no @CineVisionBot).
                      Os <span className="font-bold text-white">{broadcastStats.gap}</span> usuários restantes estão
                      cadastrados mas não ativaram o bot ainda — alcance-os via WhatsApp ou peça para iniciarem o bot.
                    </div>
                  </div>
                </div>
                <p className="text-2xl font-bold text-blue-400 mt-1">{broadcastStats.broadcast_eligible}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {broadcastStats.gap > 0 && `gap: ${broadcastStats.gap} não ativaram o bot`}
                </p>
              </div>
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <p className="text-xs text-green-400 uppercase tracking-wide font-medium">WhatsApp broadcast</p>
                <p className="text-2xl font-bold text-green-400 mt-1">{broadcastStats.whatsapp_eligible}</p>
                <p className="text-xs text-gray-500 mt-1">com número cadastrado</p>
              </div>
            </div>
          </div>
        )}

        {/* Igor (11/07): breakdown de alcance por tipo de bot + card
            explicativo de anti-spam. Antes ele achava que broadcast ia
            duplicar msg pra quem tem chat em vários bots (não vai —
            users.telegram_id é UNIQUE, 1 pessoa = 1 mensagem). */}
        {breakdown && (
          <div className="mb-6 bg-[#111] rounded-xl border border-gray-800 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">📊 Alcance por tipo</h3>
              <span className="text-xs text-gray-500">Cada cliente recebe UMA mensagem, mesmo estando em vários bots</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Bots Oficiais</p>
                <p className="text-xl font-bold text-blue-400 mt-1">{breakdown.official.toLocaleString('pt-BR')}</p>
              </div>
              <div className="bg-amber-500/5 rounded-lg p-3 border border-amber-500/20">
                <p className="text-[10px] text-amber-400 uppercase tracking-wide">🎟 Promocionais</p>
                <p className="text-xl font-bold text-amber-400 mt-1">{breakdown.promotional.toLocaleString('pt-BR')}</p>
              </div>
              <div className="bg-green-500/5 rounded-lg p-3 border border-green-500/20">
                <p className="text-[10px] text-green-400 uppercase tracking-wide">WhatsApp</p>
                <p className="text-xl font-bold text-green-400 mt-1">{breakdown.whatsapp.toLocaleString('pt-BR')}</p>
              </div>
              <div className="bg-primary-500/10 rounded-lg p-3 border border-primary-500/30">
                <p className="text-[10px] text-primary-400 uppercase tracking-wide">Total único</p>
                <p className="text-xl font-bold text-white mt-1">{breakdown.total.toLocaleString('pt-BR')}</p>
              </div>
            </div>
            <details className="mt-3">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">
                💡 Como funciona o anti-spam?
              </summary>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                Cada cliente aparece <strong>uma única vez</strong> na base — o campo <code className="bg-white/5 px-1 rounded">telegram_id</code> é único.
                Mesmo que ele tenha dado /start em 10 bots diferentes, ele recebe UMA mensagem, enviada pelo último bot em que ele deu /start.
                Sistema não duplica mensagens.
              </p>
            </details>
          </div>
        )}

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

            {/* Channel Selector */}
            <div className="bg-[#111] rounded-xl border border-gray-800 p-5">
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Canal</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setChannel('telegram')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    channel === 'telegram' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.18 13.402l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.968.957z" />
                  </svg>
                  Telegram
                </button>
                <button
                  type="button"
                  onClick={() => setChannel('whatsapp')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    channel === 'whatsapp' ? 'bg-[#25D366] text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  WhatsApp
                </button>
              </div>
              {channel === 'whatsapp' && (
                <p className="mt-3 text-xs text-amber-400/80">
                  Só texto — sem imagem ou botões. Rate: 1 msg/s. Requer Evolution API configurada no servidor.
                </p>
              )}
            </div>

            {/* Recipients */}
            <div className="bg-[#111] rounded-xl border border-gray-800 p-5">
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Destinatários</label>
              {channel === 'whatsapp' ? (
                <p className="text-sm text-gray-300">
                  Todos com WhatsApp cadastrado <span className="text-[#25D366] font-semibold">({waUsersCount})</span>
                </p>
              ) : (
                <>
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
                </>
              )}
            </div>

            {/* Image Upload — Telegram only */}
            {channel === 'telegram' && <div className="bg-[#111] rounded-xl border border-gray-800 p-5">
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
            </div>}

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

            {/* Inline Buttons — Telegram only */}
            {channel === 'telegram' && <div className="bg-[#111] rounded-xl border border-gray-800 p-5">
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
            </div>}

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
                    <div
                      key={item.id}
                      onClick={() => setSelectedBroadcast(item)}
                      className="bg-black/30 rounded-lg p-3 border border-gray-800/50 cursor-pointer hover:border-gray-600 hover:bg-black/50 transition-all"
                    >
                      {item.image_url && (
                        <img src={item.image_url} alt="" className="w-full h-20 object-cover rounded mb-2" />
                      )}
                      <p className="text-xs text-gray-300 line-clamp-2 mb-2">{item.message_text}</p>
                      {/* Mini progress bar for sending items */}
                      {item.status === 'sending' && (
                        <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden mb-2">
                          <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: `${item.progress_percent || 0}%` }} />
                        </div>
                      )}
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
                        <span>{formatBrDate(item.sent_at)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedBroadcast && modalLive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedBroadcast(null)}>
          <div className="bg-[#111] border border-gray-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-lg font-bold text-white">Detalhes do Envio</h3>
              <button onClick={() => setSelectedBroadcast(null)} className="text-gray-500 hover:text-white transition-colors text-xl">✕</button>
            </div>

            {/* Status Badge + Date */}
            <div className="px-5 pt-4 flex items-center justify-between">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                modalLive.status === 'completed' ? 'bg-green-500/10 text-green-400 border border-green-500/30' :
                modalLive.status === 'sending' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' :
                modalLive.status === 'failed' ? 'bg-red-500/10 text-red-400 border border-red-500/30' :
                'bg-gray-500/10 text-gray-400 border border-gray-500/30'
              }`}>
                {modalLive.status === 'sending' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
                {modalLive.status === 'completed' && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}
                {modalLive.status === 'failed' && <span className="w-1.5 h-1.5 rounded-full bg-red-400" />}
                {modalLive.status === 'sending' ? 'Em Andamento' : modalLive.status === 'completed' ? 'Concluído' : modalLive.status === 'failed' ? 'Falhou' : 'Pendente'}
              </span>
              <span className="text-xs text-gray-500">{formatBrDate(modalLive.sent_at)}</span>
            </div>

            {/* Progress Bar */}
            <div className="px-5 pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Progresso</span>
                <span className="text-sm font-mono text-white">{modalLive.progress_percent ?? 0}%</span>
              </div>
              <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    modalLive.status === 'completed' ? 'bg-green-500' :
                    modalLive.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${modalLive.progress_percent ?? 0}%` }}
                />
              </div>
            </div>

            {/* Stats Grid */}
            <div className="px-5 pt-4 grid grid-cols-3 gap-3">
              <div className="bg-black/30 rounded-lg p-3 text-center border border-gray-800/50">
                <p className="text-lg font-bold text-green-400">{modalLive.successful_sends ?? 0}</p>
                <p className="text-[10px] text-gray-500 uppercase mt-0.5">Enviados</p>
              </div>
              <div className="bg-black/30 rounded-lg p-3 text-center border border-gray-800/50">
                <p className="text-lg font-bold text-red-400">{modalLive.failed_sends ?? 0}</p>
                <p className="text-[10px] text-gray-500 uppercase mt-0.5">Falhas</p>
              </div>
              <div className="bg-black/30 rounded-lg p-3 text-center border border-gray-800/50">
                <p className="text-lg font-bold text-white">{modalLive.total_users ?? 0}</p>
                <p className="text-[10px] text-gray-500 uppercase mt-0.5">Total</p>
              </div>
            </div>

            {/* ETA for sending broadcasts */}
            {modalLive.status === 'sending' && (() => {
              const sentAt = new Date(modalLive.sent_at).getTime();
              const elapsed = (Date.now() - sentAt) / 1000;
              const sent = (modalLive.successful_sends ?? 0) + (modalLive.failed_sends ?? 0);
              const rate = sent > 0 ? sent / elapsed : 0;
              const remaining = (modalLive.total_users ?? 0) - sent;
              const eta = rate > 0 ? remaining / rate : 0;
              return (
                <div className="px-5 pt-4">
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-4 text-blue-300">
                      <span>~{rate.toFixed(1)} msg/seg</span>
                      <span>Decorrido: {formatTime(elapsed)}</span>
                    </div>
                    {rate > 0 && <span className="text-blue-400 font-medium">ETA: ~{formatTime(eta)}</span>}
                  </div>
                </div>
              );
            })()}

            {/* Image */}
            {modalLive.image_url && (
              <div className="px-5 pt-4">
                <img src={modalLive.image_url} alt="" className="w-full max-h-48 object-cover rounded-lg" />
              </div>
            )}

            {/* Message */}
            <div className="px-5 pt-4">
              <label className="text-[10px] text-gray-500 uppercase tracking-wider">Mensagem</label>
              <div className="mt-1.5 bg-black/30 rounded-lg p-3 border border-gray-800/50">
                <p className="text-sm text-gray-300 whitespace-pre-wrap break-words"
                   dangerouslySetInnerHTML={{ __html: formatPreview(modalLive.message_text) }}
                />
              </div>
            </div>

            {/* Buttons used */}
            {modalLive.inline_buttons && modalLive.inline_buttons.length > 0 && (
              <div className="px-5 pt-3">
                <label className="text-[10px] text-gray-500 uppercase tracking-wider">Botões</label>
                <div className="mt-1.5 space-y-1">
                  {modalLive.inline_buttons.map((btn, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-blue-400">{btn.text}</span>
                      <span className="text-gray-600">→</span>
                      <span className="text-gray-500 truncate">{btn.url}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Failed IDs summary */}
            {(modalLive.failed_sends ?? 0) > 0 && (
              <div className="px-5 pt-3">
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 text-xs text-red-300/70">
                  <p className="font-medium text-red-400 mb-1">{modalLive.failed_sends} falhas no envio</p>
                  <p className="text-red-300/50">Essas falhas acontecem quando o usuário bloqueou o bot ou deletou a conta do Telegram. A API do Telegram não diferencia entre os dois casos — ambos retornam o mesmo erro. Esses usuários são removidos automaticamente da lista para os próximos envios.</p>
                </div>
              </div>
            )}

            {/* Close button */}
            <div className="p-5">
              <button
                onClick={() => setSelectedBroadcast(null)}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-sm transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
