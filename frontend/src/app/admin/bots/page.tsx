'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Bot {
  id: string;
  username: string;
  display_name: string | null;
  custom_display_name?: string | null;
  roles: string[];
  status: 'active' | 'banned_br' | 'disabled';
  is_default_attendance: boolean;
  attendance_weight: number;
  users_count: number;
  last_seen_ok_at: string | null;
  // Igor (13/07): novos campos do healthcheck deep
  webhook_configured_at?: string | null;
  webhook_url_reported?: string | null;
  last_webhook_check_at?: string | null;
  // Eduardo (16/07): sinais reais de saúde vindos do Telegram
  consecutive_getme_failures?: number;
  last_failure_at?: string | null;
  last_failure_reason?: string | null;
  webhook_pending_count?: number | null;
  webhook_last_error_date?: string | null;
  webhook_last_error_message?: string | null;
  last_update_received_at?: string | null;
  auto_quarantined_at?: string | null;
  created_at: string;
  is_promotional?: boolean;
  promotional_content_id?: string | null;
  promotional_target_url?: string | null;
  promotional_start_count?: number;
  notes?: string | null;
}

// Eduardo (16/07): computeBotHealth agora usa sinais REAIS que o Telegram
// dá via getWebhookInfo (pending_update_count, last_error_date, last_error_message)
// + consecutive_getme_failures + auto_quarantined_at. Antes só olhava
// last_seen_ok_at e mismatch — bot bloqueado só no BR (getMe global retorna ok)
// ficava verde eternamente. Agora vira vermelho na hora que Telegram acumula
// updates sem entregar.
function computeBotHealth(bot: Bot, expectedBase: string): { level: 'green' | 'yellow' | 'red' | 'unknown'; label: string } {
  const now = Date.now();
  const lastOk = bot.last_seen_ok_at ? now - new Date(bot.last_seen_ok_at).getTime() : Infinity;
  const errDateAgo = bot.webhook_last_error_date ? now - new Date(bot.webhook_last_error_date).getTime() : Infinity;
  const expectedUrl = `${expectedBase}/api/v1/telegrams/webhook/${bot.id}`;
  const webhookMismatch = bot.webhook_url_reported && bot.webhook_url_reported !== expectedUrl;
  const failures = bot.consecutive_getme_failures ?? 0;
  const pending = bot.webhook_pending_count ?? 0;

  // RED — sinais fortes de morto
  if (failures >= 3) return { level: 'red', label: `auto-quarantine (${failures} falhas)` };
  if (bot.auto_quarantined_at) return { level: 'red', label: 'em quarentena automática' };
  if (webhookMismatch) return { level: 'red', label: 'webhook URL errada' };
  if (pending > 100) return { level: 'red', label: `${pending} mensagens acumuladas` };
  if (lastOk > 15 * 60_000) return { level: 'red', label: `offline >${Math.round(lastOk / 60_000)}min` };

  // YELLOW — deteriorando (ver o erro recente antes de virar vermelho)
  if (failures > 0) return { level: 'yellow', label: `${failures} falha(s) recente(s)` };
  if (pending > 50) return { level: 'yellow', label: `${pending} mensagens pendentes` };
  if (errDateAgo < 30 * 60_000) return { level: 'yellow', label: `erro webhook há ${Math.round(errDateAgo / 60_000)}min` };
  if (!bot.webhook_configured_at) return { level: 'yellow', label: 'webhook não configurado' };
  if (lastOk > 10 * 60_000) return { level: 'yellow', label: 'ping antigo' };

  return { level: 'green', label: 'OK' };
}

function getHeaders() {
  const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

function formatRelativeBr(dateStr: string | null) {
  if (!dateStr) return 'nunca';
  const d = new Date(dateStr);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  banned_br: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  disabled: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  banned_br: 'Banido BR',
  disabled: 'Desativado',
};

export default function AdminBotsPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useAuth();

  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newToken, setNewToken] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [adding, setAdding] = useState(false);
  // Igor (04/07): tab "Oficiais" x "Promocionais"
  const [activeTab, setActiveTab] = useState<'official' | 'promotional'>('official');
  // Igor (04/07): campos extras pro cadastro de bot promocional
  const [newIsPromotional, setNewIsPromotional] = useState(false);
  const [newPromoContentId, setNewPromoContentId] = useState('');
  // Igor (09/07): trocou o campo UUID por busca por nome de filme.
  // Cliente digita "Superman" → autocomplete mostra os matches → seleciona.
  const [newPromoContentSearch, setNewPromoContentSearch] = useState('');
  const [newPromoContentTitle, setNewPromoContentTitle] = useState('');
  const [contentSearchResults, setContentSearchResults] = useState<Array<{ id: string; title: string; poster_url?: string; content_type?: string }>>([]);
  // Igor (09/07): cache de conteúdos vinculados aos bots promocionais
  // (id → { title, poster_url }) pra renderizar poster no card.
  const [contentCache, setContentCache] = useState<Record<string, { title: string; poster_url?: string; content_type?: string }>>({});
  // Igor (09/07): edit inline do custom_display_name na tabela promocional.
  const [editingNameBotId, setEditingNameBotId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  // Igor (09/07): métricas 24h dos bots promo (starts, unique users, first starts)
  const [promoMetrics, setPromoMetrics] = useState<Record<string, any>>({});
  const [newCustomDisplayName, setNewCustomDisplayName] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // N25: popup WhatsApp config
  const [popupEnabled, setPopupEnabled] = useState(false);
  const [popupLink, setPopupLink] = useState('');
  const [savingPopup, setSavingPopup] = useState(false);

  // Igor (14/06 noite): PIX manual fallback
  const [pixEnabled, setPixEnabled] = useState(true);
  const [pixKey, setPixKey] = useState('');
  const [pixKeyLabel, setPixKeyLabel] = useState('E-mail');
  const [pixWhatsapp, setPixWhatsapp] = useState('');
  const [pixTelegramUsername, setPixTelegramUsername] = useState('');
  const [savingPix, setSavingPix] = useState(false);

  // N30: estatísticas de usuários por bot
  const [userStats, setUserStats] = useState<{ bots: any[]; total_all: number; total_unique: number } | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/admin/settings/whatsapp-popup`, { headers: getHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setPopupEnabled(d.whatsapp_popup_enabled); setPopupLink(d.whatsapp_popup_link || ''); } })
      .catch(() => {});
    fetch(`${API_URL}/api/v1/admin/settings/manual-pix`, { headers: getHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setPixEnabled(d.enabled);
          setPixKey(d.pix_key || '');
          setPixKeyLabel(d.pix_key_label || 'E-mail');
          setPixWhatsapp(d.whatsapp || '');
          setPixTelegramUsername(d.telegram_username || '');
        }
      })
      .catch(() => {});
    fetch(`${API_URL}/api/v1/admin/bots/user-stats`, { headers: getHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setUserStats(d); })
      .catch(() => {});
  }, []);

  const savePopupSettings = async () => {
    setSavingPopup(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/settings/whatsapp-popup`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ whatsapp_popup_enabled: popupEnabled, whatsapp_popup_link: popupLink }),
      });
      if (!res.ok) throw new Error('Falha ao salvar');
      toast.success('Configurações do popup salvas!');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingPopup(false);
    }
  };

  const saveManualPix = async () => {
    setSavingPix(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/settings/manual-pix`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ enabled: pixEnabled, pix_key: pixKey, pix_key_label: pixKeyLabel, whatsapp: pixWhatsapp, telegram_username: pixTelegramUsername }),
      });
      if (!res.ok) throw new Error('Falha ao salvar');
      toast.success('PIX manual salvo!');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingPix(false);
    }
  };

  const loadBots = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/bots?type=${activeTab}`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Falha ao carregar bots');
      const data = await res.json();
      setBots(data.bots || []);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar bots');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { if (!authLoading) loadBots(); }, [authLoading, loadBots]);

  // Igor (09/07): pra cada bot promocional com promotional_content_id
  // preenchido, carrega o content (title + poster) e cacheia. Assim
  // conseguimos renderizar o poster do filme no card do bot.
  useEffect(() => {
    if (activeTab !== 'promotional') return;
    const idsToLoad = Array.from(new Set(
      bots
        .filter((b) => b.promotional_content_id && !contentCache[b.promotional_content_id])
        .map((b) => b.promotional_content_id as string)
    ));
    if (!idsToLoad.length) return;
    (async () => {
      const entries: Array<[string, { title: string; poster_url?: string; content_type?: string }]> = [];
      // Batch em paralelo — 1 fetch por id (endpoint público de content)
      await Promise.all(idsToLoad.map(async (id) => {
        try {
          const r = await fetch(`${API_URL}/api/v1/content/by-id/${id}`);
          if (r.ok) {
            const d = await r.json();
            entries.push([id, { title: d.title || 'Filme', poster_url: d.poster_url, content_type: d.content_type }]);
          }
        } catch { /* silent */ }
      }));
      if (entries.length) {
        setContentCache((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      }
    })();
  }, [bots, activeTab, contentCache]);

  // Igor (09/07): carrega métricas 24h de cada bot promocional no card
  useEffect(() => {
    if (activeTab !== 'promotional' || !bots.length) return;
    const idsToFetch = bots.filter((b) => !promoMetrics[b.id]).map((b) => b.id);
    if (!idsToFetch.length) return;
    (async () => {
      const results = await Promise.all(idsToFetch.map(async (id) => {
        try {
          const r = await fetch(`${API_URL}/api/v1/admin/bots/${id}/promotional-metrics`, { headers: getHeaders() });
          if (r.ok) return [id, await r.json()] as const;
        } catch { /* silent */ }
        return null;
      }));
      const next = { ...promoMetrics };
      results.forEach((r) => {
        if (r) next[r[0]] = r[1];
      });
      setPromoMetrics(next);
    })();
  }, [bots, activeTab, promoMetrics]);

  // Igor (09/07): salva nome customizado editado inline na tabela.
  const handleSaveName = async (botId: string) => {
    const val = editingNameValue.trim();
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/bots/${botId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ custom_display_name: val || null }),
      });
      if (!res.ok) throw new Error('Falha ao renomear');
      setEditingNameBotId(null);
      setEditingNameValue('');
      toast.success('Nome atualizado');
      await loadBots();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao renomear');
    }
  };

  // Igor (09/07): refetch getMe pra atualizar display_name/username quando
  // Igor renomear o bot no BotFather.
  const handleRenameFromTelegram = async (botId: string) => {
    const t = toast.loading('Puxando dados atualizados do Telegram...');
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/bots/${botId}/rename-from-telegram`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const body = await res.json();
      toast.dismiss(t);
      if (!res.ok) throw new Error(body?.message || 'Falha ao atualizar');
      const changed = body.old_username !== body.new_username;
      toast.success(changed
        ? `Atualizado: @${body.old_username} → @${body.new_username}`
        : `Bot @${body.new_username} atualizado.`);
      await loadBots();
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e.message || 'Erro');
    }
  };

  // Igor (09/07): busca autocomplete de filme quando cadastrando bot
  // promocional. Debounce 400ms + só busca >= 2 chars.
  useEffect(() => {
    const q = newPromoContentSearch.trim();
    if (q.length < 2) { setContentSearchResults([]); return; }
    // Se o campo bate exatamente com o filme já selecionado, não busca de novo
    if (q === newPromoContentTitle) return;
    const h = setTimeout(async () => {
      try {
        const [rMovies, rSeries] = await Promise.all([
          fetch(`${API_URL}/api/v1/content/movies?search=${encodeURIComponent(q)}&limit=8`),
          fetch(`${API_URL}/api/v1/content/series?search=${encodeURIComponent(q)}&limit=5`),
        ]);
        const dMovies = rMovies.ok ? await rMovies.json() : {};
        const dSeries = rSeries.ok ? await rSeries.json() : {};
        const listMovies = (Array.isArray(dMovies) ? dMovies : dMovies.movies || dMovies.data || [])
          .map((m: any) => ({ id: m.id, title: m.title, poster_url: m.poster_url, content_type: 'movie' }));
        const listSeries = (Array.isArray(dSeries) ? dSeries : dSeries.series || dSeries.data || [])
          .map((s: any) => ({ id: s.id, title: s.title, poster_url: s.poster_url, content_type: 'series' }));
        setContentSearchResults([...listMovies, ...listSeries].slice(0, 10));
      } catch { setContentSearchResults([]); }
    }, 400);
    return () => clearTimeout(h);
  }, [newPromoContentSearch, newPromoContentTitle]);

  const handleAdd = async () => {
    if (!newToken.trim()) { toast.error('Cole o token do bot.'); return; }
    setAdding(true);
    try {
      const payload: any = {
        token: newToken.trim(),
        display_name: newDisplayName.trim() || undefined,
      };
      // Igor (04/07): campos extras se for bot promocional
      if (newIsPromotional || activeTab === 'promotional') {
        payload.is_promotional = true;
        payload.promotional_content_id = newPromoContentId.trim() || undefined;
        payload.custom_display_name = newCustomDisplayName.trim() || undefined;
        payload.notes = newNotes.trim() || undefined;
      }
      const res = await fetch(`${API_URL}/api/v1/admin/bots`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message || 'Falha ao adicionar bot');
      toast.success(`Bot @${body.username} cadastrado.`);
      setShowAddModal(false);
      setNewToken('');
      setNewDisplayName('');
      setNewIsPromotional(false);
      setNewPromoContentId('');
      setNewPromoContentSearch('');
      setNewPromoContentTitle('');
      setContentSearchResults([]);
      setNewCustomDisplayName('');
      setNewNotes('');
      await loadBots();
      // Igor (13/07): removido confirm(). createBot já configura webhook
      // automaticamente. Se falhar, backend grava warning em notes e
      // retorna webhook_ok=false — mostra toast dedicado pra Igor saber.
      if (body.webhook_ok === false) {
        toast.error(
          `⚠️ Webhook FALHOU: ${body.webhook_error || 'erro'}. Clique 🔗 no card.`,
          { duration: 8000 },
        );
      } else if (body.webhook_ok === true) {
        toast.success(`Webhook configurado automaticamente.`, { duration: 3000 });
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleSetupWebhook = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/bots/${id}/setup-webhook`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message || 'Falha no setWebhook');
      toast.success(`Webhook configurado pro @${body.bot_username}.`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleHealthcheck = async (id: string) => {
    const t = toast.loading('Testando bot...');
    try {
      // Igor (13/07): deep healthcheck — valida getMe + getWebhookInfo
      const res = await fetch(`${API_URL}/api/v1/admin/bots/${id}/healthcheck-deep`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const body = await res.json();
      toast.dismiss(t);
      if (body.ok) {
        toast.success('OK — token + webhook batendo.');
      } else if (body.webhook_mismatch) {
        toast.error(`Webhook errado! Esperado ${body.expected_url}, encontrado ${body.reported_url}. Clique 🔗.`, { duration: 8000 });
      } else if (!body.getMe_ok) {
        toast.error(`Token inválido: ${body.error || 'não respondeu'}`);
      } else {
        toast.error('Webhook não configurado. Clique 🔗 pra corrigir.');
      }
      await loadBots();
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e.message);
    }
  };

  // Igor (13/07): botões massa — reconfigura webhook em todos os bots
  // ativos de uma vez. Idempotente. Usa filtro `promo` conforme a aba.
  const handleSetupWebhooksAll = async () => {
    if (!confirm(`Reconfigurar webhook em TODOS os bots ${activeTab === 'promotional' ? 'promocionais' : 'oficiais'} ativos?`)) return;
    const t = toast.loading('Reconfigurando webhooks...');
    try {
      const promoParam = activeTab === 'promotional' ? 'true' : 'false';
      const res = await fetch(`${API_URL}/api/v1/admin/bots/setup-webhooks-all?promo=${promoParam}`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const body = await res.json();
      toast.dismiss(t);
      if (!res.ok) throw new Error(body?.message || 'Falha');
      toast.success(`✅ ${body.ok?.length || 0} ok / ❌ ${body.failed?.length || 0} falhou`, { duration: 5000 });
      if (body.failed?.length) {
        console.warn('[setup-webhooks-all] failed:', body.failed);
      }
      await loadBots();
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e.message);
    }
  };

  const handleHealthcheckAll = async () => {
    const t = toast.loading('Testando todos os bots...');
    try {
      const promoParam = activeTab === 'promotional' ? 'true' : 'false';
      const res = await fetch(`${API_URL}/api/v1/admin/bots/healthcheck-all?promo=${promoParam}`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const body = await res.json();
      toast.dismiss(t);
      const results = body.results || [];
      const ok = results.filter((r: any) => r.ok).length;
      const bad = results.length - ok;
      if (bad === 0) toast.success(`Todos ${ok} bot(s) OK ✅`);
      else toast.error(`${ok} OK / ${bad} com problema — veja indicador visual`, { duration: 6000 });
      await loadBots();
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e.message);
    }
  };

  const handleUpdate = async (id: string, patch: Partial<Bot>) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/bots/${id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || 'Falha ao atualizar bot');
      }
      await loadBots();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleMigrate = async (bot: Bot) => {
    const msg =
      `Marcar @${bot.username} como CAÍDO e disparar WhatsApp pros usuários dele?\n\n` +
      `• Bot vira "Banido BR" e perde papel de atendimento (não recebe mais novos /start).\n` +
      `• Cada usuário cadastrado nesse bot recebe 1 mensagem WhatsApp com link do bot ativo.\n` +
      `• Disparos respeitam throttle (1 a cada 3s) e param se 5 falharem seguidas.\n\n` +
      `Confirmar?`;
    if (!confirm(msg)) return;
    const t = toast.loading('Iniciando migração...');
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/bots/${bot.id}/migrate`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const body = await res.json();
      toast.dismiss(t);
      if (!res.ok) throw new Error(body?.message || 'Falha ao iniciar migração');
      toast.success(
        `Migração iniciada: ${body.total_users} usuários (${body.no_whatsapp} sem WhatsApp) → @${body.target_bot}`,
        { duration: 6000 },
      );
      await loadBots();
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: string, username: string) => {
    if (!confirm(`Remover @${username}? Esta ação é permanente.`)) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/bots/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || 'Falha ao deletar');
      toast.success(`@${username} removido.`);
      await loadBots();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const toggleRole = (bot: Bot, role: 'attendance' | 'delivery') => {
    const has = bot.roles.includes(role);
    const next = has ? bot.roles.filter(r => r !== role) : [...bot.roles, role];
    handleUpdate(bot.id, { roles: next });
  };

  if (authLoading || loading) {
    return <div className="p-6 text-gray-300">Carregando bots...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Bots Telegram</h1>
          <p className="text-sm text-gray-400 mt-1">
            {activeTab === 'official'
              ? 'Sistema multi-bot: atendimento rotativo + bots de entrega por grupo.'
              : 'Bots de captação/divulgação — nome de filme em alta, aproveita busca orgânica do Telegram.'}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {/* Igor (13/07): botões massa pra reconfigurar/testar webhooks. */}
          <button
            onClick={handleHealthcheckAll}
            className="px-3 py-2 text-sm bg-dark-700 hover:bg-dark-600 text-gray-200 border border-white/10 rounded-lg font-medium"
            title="Testa getMe + getWebhookInfo de todos os bots"
          >
            🩺 Testar TODOS
          </button>
          <button
            onClick={handleSetupWebhooksAll}
            className="px-3 py-2 text-sm bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-lg font-medium"
            title="Reconfigura webhook em massa"
          >
            🔗 Configurar TODOS
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium"
          >
            + Adicionar bot {activeTab === 'promotional' ? 'promocional' : ''}
          </button>
        </div>
      </div>

      {/* Igor (04/07): tabs Oficiais x Promocionais */}
      <div className="mb-6 border-b border-white/10 flex gap-1">
        <button
          onClick={() => setActiveTab('official')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'official'
              ? 'border-primary-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          🤖 Oficiais
        </button>
        <button
          onClick={() => setActiveTab('promotional')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'promotional'
              ? 'border-amber-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          🎟 Promocionais
        </button>
      </div>

      {/* Igor (09/07): grid de cards pra aba Promocionais — layout dedicado
          com poster do filme vinculado, edit inline do nome, e contador de
          /start com breakdown 24h vs total. Aba Oficiais mantém tabela clássica. */}
      {activeTab === 'promotional' && (
        <div>
          {bots.length === 0 && (
            <div className="bg-dark-800 border border-white/10 rounded-lg p-8 text-center text-gray-500">
              Nenhum bot promocional cadastrado ainda.
              <div className="mt-3 text-xs text-gray-600">
                Clique em <span className="text-white">+ Adicionar bot promocional</span> pra começar.
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bots.map((bot) => {
              const content = bot.promotional_content_id ? contentCache[bot.promotional_content_id] : null;
              const isEditingName = editingNameBotId === bot.id;
              const displayLabel = bot.custom_display_name || bot.display_name || bot.username;
              return (
                <div key={bot.id} className="bg-dark-800 border border-amber-500/20 rounded-xl overflow-hidden hover:border-amber-500/40 transition-colors">
                  <div className="relative">
                    {content?.poster_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={content.poster_url} alt={content.title} className="w-full h-48 object-cover" />
                    ) : (
                      <div className="w-full h-48 bg-gradient-to-br from-amber-500/10 to-dark-900 flex items-center justify-center text-5xl">🎬</div>
                    )}
                    <div className="absolute top-2 right-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded-full backdrop-blur-sm ${
                        bot.status === 'active' ? 'bg-emerald-500/90 text-black' :
                        bot.status === 'banned_br' ? 'bg-yellow-500/90 text-black' : 'bg-gray-500/90 text-white'
                      }`}>
                        {bot.status === 'active' ? '● ativo' : bot.status === 'banned_br' ? 'banido' : 'inativo'}
                      </span>
                    </div>
                  </div>
                  <div className="p-4">
                    {isEditingName ? (
                      <div className="mb-2 flex gap-2">
                        <input
                          type="text"
                          value={editingNameValue}
                          onChange={(e) => setEditingNameValue(e.target.value)}
                          className="flex-1 px-2 py-1 bg-dark-700 border border-amber-500/50 rounded text-white text-sm"
                          autoFocus
                        />
                        <button onClick={() => handleSaveName(bot.id)} className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs">✓</button>
                        <button onClick={() => { setEditingNameBotId(null); setEditingNameValue(''); }} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs">✕</button>
                      </div>
                    ) : (
                      <div className="mb-2 flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-semibold text-sm truncate">{displayLabel}</h3>
                          <p className="text-xs text-gray-500 truncate">@{bot.username}</p>
                        </div>
                        <button
                          onClick={() => { setEditingNameBotId(bot.id); setEditingNameValue(bot.custom_display_name || ''); }}
                          className="text-gray-500 hover:text-amber-400 text-xs px-1"
                          title="Editar nome"
                        >
                          ✏️
                        </button>
                      </div>
                    )}
                    {content && (
                      <p className="text-xs text-amber-300/70 mb-3 truncate">
                        🔗 Vinculado a: <strong>{content.title}</strong>
                      </p>
                    )}
                    {/* Igor (15/07): 2 novos tiles pra "usuários únicos".
                        O card antes mostrava só contagem bruta de /start (um
                        user que dá /start 3x contava 3). Agora separa em duas
                        linhas: totais gerais (starts vs pessoas distintas) e
                        janela de 24h (starts 24h vs pessoas distintas 24h vs
                        primeira-vez 24h). Backend (RPC promotional_bot_metrics)
                        já retorna unique_users e unique_users_24h desde a
                        migration 20260712200000 — só faltava consumir. */}
                    <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                      <div className="bg-dark-700 rounded p-2 text-center">
                        <div className="text-base font-bold text-amber-400">
                          {(promoMetrics[bot.id]?.total_starts ?? bot.promotional_start_count ?? 0).toLocaleString('pt-BR')}
                        </div>
                        <div className="text-[10px] text-gray-500 uppercase">total /start</div>
                      </div>
                      <div className="bg-dark-700 rounded p-2 text-center">
                        <div className="text-base font-bold text-violet-400">
                          {(promoMetrics[bot.id]?.unique_users ?? 0).toLocaleString('pt-BR')}
                        </div>
                        <div className="text-[10px] text-gray-500 uppercase">usuários únicos</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 mb-2">
                      <div className="bg-dark-700 rounded p-2 text-center">
                        <div className="text-base font-bold text-blue-400">
                          {(promoMetrics[bot.id]?.starts_24h ?? 0).toLocaleString('pt-BR')}
                        </div>
                        <div className="text-[10px] text-gray-500 uppercase">starts 24h</div>
                      </div>
                      <div className="bg-dark-700 rounded p-2 text-center">
                        <div className="text-base font-bold text-indigo-400">
                          {(promoMetrics[bot.id]?.unique_users_24h ?? 0).toLocaleString('pt-BR')}
                        </div>
                        <div className="text-[10px] text-gray-500 uppercase">únicos 24h</div>
                      </div>
                      <div className="bg-dark-700 rounded p-2 text-center">
                        <div className="text-base font-bold text-emerald-400">
                          {(promoMetrics[bot.id]?.first_starts_24h ?? 0).toLocaleString('pt-BR')}
                        </div>
                        <div className="text-[10px] text-gray-500 uppercase">novos 24h</div>
                      </div>
                    </div>
                    {/* Igor (12/07): mini timeline dos últimos 7 dias.
                        Defensivo — mesmo se backend retornar array vazio ou
                        <7 items, geramos skeleton local de 7 dias garantindo
                        grid consistente. Labels D/S/T/Q/Q/S/S dinâmicos. */}
                    <div className="mb-3">
                      {(() => {
                        const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
                        const daily = (promoMetrics[bot.id]?.daily as any[]) || [];
                        const map = new Map<string, number>();
                        daily.forEach((d: any) => {
                          if (d?.day) map.set(String(d.day), Number(d.starts) || 0);
                        });
                        const days: { key: string; label: string; starts: number }[] = [];
                        for (let i = 6; i >= 0; i--) {
                          const dt = new Date();
                          dt.setDate(dt.getDate() - i);
                          const key = dt.toISOString().slice(0, 10);
                          days.push({ key, label: WEEKDAYS[dt.getDay()], starts: map.get(key) ?? 0 });
                        }
                        const totalStarts = days.reduce((s, x) => s + x.starts, 0);
                        const max = Math.max(1, ...days.map((x) => x.starts));
                        return (
                          <>
                            <div className="text-[10px] text-gray-500 mb-1 uppercase flex justify-between">
                              <span>Últimos 7 dias</span>
                              <span className="text-gray-600 normal-case">{totalStarts} starts</span>
                            </div>
                            <div className="flex items-end gap-0.5 h-8">
                              {days.map((d) => (
                                <div
                                  key={d.key}
                                  className={`flex-1 rounded-t transition-colors ${
                                    d.starts > 0 ? 'bg-amber-500/60 hover:bg-amber-400' : 'bg-white/5'
                                  }`}
                                  style={{ height: `${d.starts > 0 ? Math.max((d.starts / max) * 100, 15) : 4}%` }}
                                  title={`${d.key} (${d.label}): ${d.starts} start${d.starts === 1 ? '' : 's'}`}
                                />
                              ))}
                            </div>
                            <div className="flex gap-0.5 mt-1">
                              {days.map((d) => (
                                <div key={d.key} className="flex-1 text-center text-[9px] text-gray-500">
                                  {d.label}
                                </div>
                              ))}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    <div className="text-[10px] text-gray-500 mb-3">
                      Último OK: <span className="text-gray-400">{formatRelativeBr(bot.last_seen_ok_at)}</span>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      <button onClick={() => handleHealthcheck(bot.id)} className="flex-1 px-2 py-1.5 bg-dark-700 hover:bg-dark-600 text-white text-xs rounded">🔍 Testar</button>
                      <button onClick={() => handleSetupWebhook(bot.id)} className="flex-1 px-2 py-1.5 bg-dark-700 hover:bg-dark-600 text-white text-xs rounded">🔗 Webhook</button>
                      <button onClick={() => handleRenameFromTelegram(bot.id)} className="flex-1 px-2 py-1.5 bg-dark-700 hover:bg-dark-600 text-white text-xs rounded" title="Repuxa nome do BotFather">🔄 Sync</button>
                      <button
                        onClick={() => { if (confirm(`Remover @${bot.username}?`)) handleDelete(bot.id, bot.username); }}
                        className="px-2 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs rounded"
                        title="Remover"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'official' && (
      <div className="bg-dark-800 border border-white/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-dark-900 text-gray-400 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Bot</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Papéis</th>
              <th className="px-4 py-3 text-left">Default</th>
              <th className="px-4 py-3 text-right">Peso</th>
              <th className="px-4 py-3 text-right">Users</th>
              <th className="px-4 py-3 text-left">Último OK</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {bots.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  Nenhum bot cadastrado.
                </td>
              </tr>
            )}
            {bots.map(bot => (
              <tr key={bot.id} className="text-gray-200">
                <td className="px-4 py-3">
                  <div className="font-medium">@{bot.username}</div>
                  {bot.display_name && <div className="text-xs text-gray-500">{bot.display_name}</div>}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={bot.status}
                    onChange={(e) => handleUpdate(bot.id, { status: e.target.value as Bot['status'] })}
                    className={`px-2 py-1 rounded border text-xs ${STATUS_STYLES[bot.status]} bg-transparent`}
                  >
                    <option value="active" className="bg-dark-900">Ativo</option>
                    <option value="banned_br" className="bg-dark-900">Banido BR</option>
                    <option value="disabled" className="bg-dark-900">Desativado</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {(['attendance', 'delivery'] as const).map(role => (
                      <button
                        key={role}
                        onClick={() => toggleRole(bot, role)}
                        className={`px-2 py-1 text-xs rounded border ${
                          bot.roles.includes(role)
                            ? 'bg-primary-500/20 border-primary-500/40 text-primary-300'
                            : 'bg-transparent border-white/10 text-gray-500'
                        }`}
                      >
                        {role === 'attendance' ? 'Atendimento' : 'Entrega'}
                      </button>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="radio"
                    name="default-bot"
                    checked={bot.is_default_attendance}
                    onChange={() => handleUpdate(bot.id, { is_default_attendance: true })}
                    className="accent-primary-500"
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={bot.attendance_weight}
                    onChange={(e) => handleUpdate(bot.id, { attendance_weight: parseInt(e.target.value) || 0 })}
                    className="w-16 px-2 py-1 bg-dark-900 border border-white/10 rounded text-white text-right"
                  />
                </td>
                <td className="px-4 py-3 text-right text-gray-300">
                  {/* Igor (13/07): usa RPC live via userStats em vez do cache stale */}
                  {userStats?.bots?.find((b: any) => b.username === bot.username)?.users_count ?? bot.users_count}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {/* Igor (13/07): bolinha verde/amarela/vermelha derivada de webhook + last_seen */}
                  {(() => {
                    const h = computeBotHealth(bot, API_URL);
                    const color = h.level === 'green' ? 'bg-emerald-400' : h.level === 'yellow' ? 'bg-yellow-400' : h.level === 'red' ? 'bg-red-500' : 'bg-gray-500';
                    return (
                      <span className="flex items-center gap-2" title={h.label}>
                        <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
                        {formatRelativeBr(bot.last_seen_ok_at)}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => handleHealthcheck(bot.id)}
                      className="px-2 py-1 text-xs bg-dark-900 border border-white/10 rounded hover:bg-dark-700"
                      title="Healthcheck (getMe)"
                    >
                      🔍
                    </button>
                    <button
                      onClick={() => handleSetupWebhook(bot.id)}
                      className="px-2 py-1 text-xs bg-dark-900 border border-white/10 rounded hover:bg-dark-700"
                      title="Configurar webhook"
                    >
                      🔗
                    </button>
                    {bot.status === 'active' && bot.roles.includes('attendance') && (
                      <button
                        onClick={() => handleMigrate(bot)}
                        className="px-2 py-1 text-xs bg-dark-900 border border-yellow-500/30 text-yellow-400 rounded hover:bg-yellow-500/10"
                        title="Marcar como caído + disparar migração WhatsApp"
                      >
                        🚨
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(bot.id, bot.username)}
                      className="px-2 py-1 text-xs bg-dark-900 border border-red-500/30 text-red-400 rounded hover:bg-red-500/10"
                      title="Remover bot"
                    >
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {activeTab === 'official' && (
      <div className="mt-6 text-xs text-gray-500 space-y-1">
        <p>• <strong>Atendimento</strong>: bot pode receber novos /start. Peso define probabilidade no sorteio rotativo (0 = não participa).</p>
        <p>• <strong>Entrega</strong>: bot pode gerar invite link em grupos onde é admin. Funciona mesmo banido pra novos /start (via API).</p>
        <p>• <strong>Default</strong>: bot usado como fallback quando o sorteio não escolhe nenhum específico.</p>
      </div>
      )}

      {/* N30: Estatísticas de usuários por bot — SÓ na aba Oficiais.
          Igor (09/07): reportou que os oficiais estavam aparecendo na aba
          Promocionais. Feedback também: essas seções (PIX manual, popup
          WhatsApp, stats de users) são configs globais dos bots oficiais
          e não fazem sentido na aba Promocionais. */}
      {userStats && activeTab === 'official' && (
        <div className="mt-8 bg-dark-800 border border-white/10 rounded-lg p-5">
          <h2 className="text-base font-semibold text-white mb-4">Usuários por Bot Oficial</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {userStats.bots.map((b: any) => (
              <div key={b.id} className="bg-dark-700 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-white">{b.users_count.toLocaleString('pt-BR')}</div>
                <div className="text-xs text-gray-400 mt-0.5 truncate">@{b.username}</div>
                <div className={`text-[10px] mt-1 font-medium ${b.status === 'active' ? 'text-emerald-400' : b.status === 'banned_br' ? 'text-yellow-400' : 'text-gray-500'}`}>
                  {b.status === 'active' ? 'ativo' : b.status === 'banned_br' ? 'banido' : 'inativo'}
                </div>
              </div>
            ))}
            <div className="bg-dark-700 rounded-lg p-3 text-center border border-white/10">
              <div className="text-xl font-bold text-blue-400">{userStats.total_all.toLocaleString('pt-BR')}</div>
              <div className="text-xs text-gray-400 mt-0.5">Total (c/ duplicatas)</div>
            </div>
            <div className="bg-dark-700 rounded-lg p-3 text-center border border-emerald-500/20">
              <div className="text-xl font-bold text-emerald-400">{userStats.total_unique.toLocaleString('pt-BR')}</div>
              <div className="text-xs text-gray-400 mt-0.5">Usuários únicos</div>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            "Usuários únicos" = pessoas distintas em todos os bots (sem contar quem está em 2+ bots mais de uma vez).
          </p>
        </div>
      )}

      {/* Igor (14/06 noite): PIX manual fallback — SÓ aba Oficiais */}
      {activeTab === 'official' && (
      <div className="mt-8 bg-dark-800 border border-white/10 rounded-lg p-5">
        <h2 className="text-base font-semibold text-white mb-1">PIX manual (fallback)</h2>
        <p className="text-xs text-gray-500 mb-4">
          Botão "Não consegui pagar" no checkout. Cliente vê chave PIX direta + manda comprovante no WhatsApp.
          Use pra clientes em bancos que rejeitam o PIX automático (Santander, Inter, etc).
        </p>
        <div className="flex flex-col gap-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setPixEnabled(!pixEnabled)}
              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${pixEnabled ? 'bg-emerald-500' : 'bg-gray-600'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${pixEnabled ? 'translate-x-5' : ''}`} />
            </div>
            <span className="text-sm text-gray-300">
              {pixEnabled ? 'Botão ativo — aparece no checkout' : 'Botão desativado — escondido'}
            </span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Chave PIX</label>
              <input
                type="text"
                value={pixKey}
                onChange={e => setPixKey(e.target.value)}
                placeholder="cinevision.app@hotmail.com"
                className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Tipo da chave</label>
              <select
                value={pixKeyLabel}
                onChange={e => setPixKeyLabel(e.target.value)}
                className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500"
              >
                <option value="E-mail">E-mail</option>
                <option value="CPF">CPF</option>
                <option value="CNPJ">CNPJ</option>
                <option value="Telefone">Telefone</option>
                <option value="Aleatória">Aleatória</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">WhatsApp pra receber comprovante (com DDI+DDD)</label>
            <input
              type="text"
              value={pixWhatsapp}
              onChange={e => setPixWhatsapp(e.target.value.replace(/\D/g, ''))}
              placeholder="556712345678"
              className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Deixe vazio pra abrir seletor de contato do cliente. Ex: 5567812345678 (BR sem +).
            </p>
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Username Telegram pra receber comprovante (sem @)</label>
              <input
                type="text"
                value={pixTelegramUsername}
                onChange={e => setPixTelegramUsername(e.target.value.replace(/^@/, '').trim())}
                placeholder="igorcinevision"
                className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Cliente vai poder mandar comprovante direto pelo Telegram do bot. Vazio = só WhatsApp.
              </p>
            </div>
            <button
              onClick={saveManualPix}
              disabled={savingPix}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {savingPix ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
      )}

      {/* N25: Configurações do popup WhatsApp — SÓ aba Oficiais */}
      {activeTab === 'official' && (
      <div className="mt-8 bg-dark-800 border border-white/10 rounded-lg p-5">
        <h2 className="text-base font-semibold text-white mb-4">Popup de WhatsApp</h2>
        <div className="flex flex-col gap-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setPopupEnabled(!popupEnabled)}
              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${popupEnabled ? 'bg-emerald-500' : 'bg-gray-600'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${popupEnabled ? 'translate-x-5' : ''}`} />
            </div>
            <span className="text-sm text-gray-300">
              {popupEnabled ? 'Popup ativo — aparece para visitantes' : 'Popup desativado — não aparece no site'}
            </span>
          </label>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Link do grupo WhatsApp</label>
              <input
                type="url"
                value={popupLink}
                onChange={e => setPopupLink(e.target.value)}
                placeholder="https://chat.whatsapp.com/..."
                className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
            <button
              onClick={savePopupSettings}
              disabled={savingPopup}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {savingPopup ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-white/10 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-white mb-4">
              Adicionar bot {activeTab === 'promotional' ? 'promocional' : 'Telegram'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Token do @BotFather</label>
                <input
                  type="text"
                  value={newToken}
                  onChange={(e) => setNewToken(e.target.value)}
                  placeholder="123456:ABC-DEF1234..."
                  className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded text-white text-sm font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">Backend valida via getMe antes de salvar.</p>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Nome de exibição (opcional)</label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder={activeTab === 'promotional' ? 'Ex: Todo Mundo em Pânico 6' : 'Ex: Cine Vision Brasil'}
                  className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded text-white text-sm"
                />
              </div>

              {/* Igor (04/07): campos extras SÓ pra promocional */}
              {activeTab === 'promotional' && (
                <>
                  <div className="p-3 bg-amber-500/5 border border-amber-500/30 rounded-lg space-y-3">
                    <p className="text-xs text-amber-300 font-medium">📌 Configuração de bot promocional</p>
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Nome customizado no painel (opcional)</label>
                      <input
                        type="text"
                        value={newCustomDisplayName}
                        onChange={(e) => setNewCustomDisplayName(e.target.value)}
                        placeholder="Como você quer identificar esse bot no painel"
                        className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded text-white text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Útil quando você renomeia o bot no BotFather (ex: Superman → Panico 6) mas quer manter rastreamento.
                      </p>
                    </div>
                    {/* Igor (09/07): busca por nome do filme (não UUID).
                        Removeu URL customizada que confundiu. */}
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">
                        🎬 Filme vinculado <span className="text-gray-500">(digita o nome pra buscar)</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={newPromoContentSearch}
                          onChange={(e) => {
                            setNewPromoContentSearch(e.target.value);
                            // Se editou depois de selecionar, limpa a seleção
                            if (e.target.value !== newPromoContentTitle) {
                              setNewPromoContentId('');
                              setNewPromoContentTitle('');
                            }
                          }}
                          placeholder='Ex: "Todo Mundo em Pânico"'
                          className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded text-white text-sm"
                          autoComplete="off"
                        />
                        {contentSearchResults.length > 0 && !newPromoContentId && (
                          <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-dark-900 border border-white/20 rounded-lg shadow-xl">
                            {contentSearchResults.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setNewPromoContentId(c.id);
                                  setNewPromoContentTitle(c.title);
                                  setNewPromoContentSearch(c.title);
                                  setContentSearchResults([]);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-dark-700 text-left border-b border-white/5 last:border-b-0"
                              >
                                {c.poster_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={c.poster_url} alt="" className="w-8 h-12 object-cover rounded" />
                                ) : (
                                  <div className="w-8 h-12 bg-dark-700 rounded flex items-center justify-center text-xs">🎬</div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm text-white truncate">{c.title}</div>
                                  <div className="text-[10px] text-gray-500 uppercase">{c.content_type === 'series' ? 'Série' : 'Filme'}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {newPromoContentId ? (
                        <p className="text-xs text-emerald-400 mt-1">
                          ✅ Selecionado: <strong>{newPromoContentTitle}</strong> — quando cliente der /start, verá esse filme.
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500 mt-1">
                          Quando cliente dá /start no bot, ele recebe uma mensagem com o poster desse filme e um botão pro site.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Notas internas</label>
                      <textarea
                        value={newNotes}
                        onChange={(e) => setNewNotes(e.target.value)}
                        rows={2}
                        placeholder="Ex: bot alugado até 31/12, sub-conta X..."
                        className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded text-white text-sm"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                disabled={adding}
                className="px-4 py-2 text-gray-300 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleAdd}
                disabled={adding}
                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded font-medium disabled:opacity-50"
              >
                {adding ? 'Validando...' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
