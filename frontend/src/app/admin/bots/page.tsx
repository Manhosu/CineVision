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
  roles: string[];
  status: 'active' | 'banned_br' | 'disabled';
  is_default_attendance: boolean;
  attendance_weight: number;
  users_count: number;
  last_seen_ok_at: string | null;
  created_at: string;
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
      const res = await fetch(`${API_URL}/api/v1/admin/bots`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Falha ao carregar bots');
      const data = await res.json();
      setBots(data.bots || []);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar bots');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!authLoading) loadBots(); }, [authLoading, loadBots]);

  const handleAdd = async () => {
    if (!newToken.trim()) { toast.error('Cole o token do bot.'); return; }
    setAdding(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/bots`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ token: newToken.trim(), display_name: newDisplayName.trim() || undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message || 'Falha ao adicionar bot');
      toast.success(`Bot @${body.username} cadastrado.`);
      setShowAddModal(false);
      setNewToken('');
      setNewDisplayName('');
      await loadBots();
      if (confirm(`Configurar webhook agora pro @${body.username}?`)) {
        await handleSetupWebhook(body.id);
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
      const res = await fetch(`${API_URL}/api/v1/admin/bots/${id}/healthcheck`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const body = await res.json();
      toast.dismiss(t);
      if (body.ok) {
        toast.success(`OK — @${body.result?.username} respondeu.`);
        await loadBots();
      } else {
        toast.error(`Bot não respondeu: ${body.description || body.error || body.reason}`);
      }
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
            Sistema multi-bot: atendimento rotativo + bots de entrega por grupo.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium"
        >
          + Adicionar bot
        </button>
      </div>

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
                <td className="px-4 py-3 text-right text-gray-300">{bot.users_count}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{formatRelativeBr(bot.last_seen_ok_at)}</td>
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

      <div className="mt-6 text-xs text-gray-500 space-y-1">
        <p>• <strong>Atendimento</strong>: bot pode receber novos /start. Peso define probabilidade no sorteio rotativo (0 = não participa).</p>
        <p>• <strong>Entrega</strong>: bot pode gerar invite link em grupos onde é admin. Funciona mesmo banido pra novos /start (via API).</p>
        <p>• <strong>Default</strong>: bot usado como fallback quando o sorteio não escolhe nenhum específico.</p>
      </div>

      {/* N30: Estatísticas de usuários por bot */}
      {userStats && (
        <div className="mt-8 bg-dark-800 border border-white/10 rounded-lg p-5">
          <h2 className="text-base font-semibold text-white mb-4">Usuários por Bot</h2>
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

      {/* Igor (14/06 noite): PIX manual fallback */}
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

      {/* N25: Configurações do popup WhatsApp */}
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

      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-white/10 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-lg font-bold text-white mb-4">Adicionar bot Telegram</h2>
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
                  placeholder="Ex: Cine Vision Brasil"
                  className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded text-white text-sm"
                />
              </div>
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
