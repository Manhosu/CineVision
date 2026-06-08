'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getHeaders() {
  const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

interface BotGroup {
  id: string;
  chat_id: string;
  title: string | null;
  member_count: number | null;
  is_active: boolean;
  last_sent_at: string | null;
  bot: { id: string; username: string; display_name: string | null; status: string } | null;
}

interface GroupBroadcast {
  id: string;
  message_text: string;
  image_url: string | null;
  total_groups: number;
  successful_sends: number;
  failed_sends: number;
  status: string;
  sent_at: string;
}

interface Bot {
  id: string;
  username: string;
  display_name: string | null;
  status: string;
}

export default function BroadcastGroupsPage() {
  const { isLoading: authLoading } = useAuth();

  const [groups, setGroups] = useState<BotGroup[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [broadcasts, setBroadcasts] = useState<GroupBroadcast[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulário de novo grupo
  const [newBotId, setNewBotId] = useState('');
  const [newChatId, setNewChatId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [addingGroup, setAddingGroup] = useState(false);

  // Formulário de envio
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const [gRes, bRes, brRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/admin/broadcast-groups`, { headers: getHeaders() }),
        fetch(`${API_URL}/api/v1/admin/bots`, { headers: getHeaders() }),
        fetch(`${API_URL}/api/v1/admin/broadcast-groups/broadcasts`, { headers: getHeaders() }),
      ]);
      if (gRes.ok) setGroups(await gRes.json());
      if (bRes.ok) { const d = await bRes.json(); setBots(d.bots || []); }
      if (brRes.ok) setBroadcasts(await brRes.json());
    } catch (e: any) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!authLoading) load(); }, [authLoading, load]);

  const handleAddGroup = async () => {
    if (!newBotId || !newChatId.trim()) { toast.error('Selecione o bot e informe o Chat ID.'); return; }
    setAddingGroup(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/broadcast-groups`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ bot_id: newBotId, chat_id: newChatId.trim(), title: newTitle.trim() || undefined }),
      });
      if (!res.ok) throw new Error((await res.json())?.message || 'Erro');
      toast.success('Grupo cadastrado!');
      setNewBotId(''); setNewChatId(''); setNewTitle('');
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAddingGroup(false);
    }
  };

  const handleToggle = async (g: BotGroup) => {
    try {
      await fetch(`${API_URL}/api/v1/admin/broadcast-groups/${g.id}/toggle`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ is_active: !g.is_active }),
      });
      await load();
    } catch { toast.error('Erro ao alterar grupo'); }
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Remover grupo?')) return;
    try {
      await fetch(`${API_URL}/api/v1/admin/broadcast-groups/${id}`, { method: 'DELETE', headers: getHeaders() });
      await load();
    } catch { toast.error('Erro ao remover'); }
  };

  const handleSend = async () => {
    if (!msgText.trim()) { toast.error('Escreva a mensagem.'); return; }
    const activeCount = groups.filter(g => g.is_active).length;
    if (!activeCount) { toast.error('Nenhum grupo ativo cadastrado.'); return; }
    if (!confirm(`Enviar mensagem para ${activeCount} grupo(s)?`)) return;
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/broadcast-groups/send`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ message_text: msgText }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message || 'Erro');
      toast.success(`Enviando para ${body.total} grupos...`);
      setMsgText('');
      setTimeout(load, 3000);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteBroadcast = async (id: string) => {
    if (!confirm('Apagar mensagem de todos os grupos?')) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/broadcast-groups/broadcasts/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const body = await res.json();
      toast.success(`${body.deleted} mensagem(ns) apagada(s).`);
      await load();
    } catch { toast.error('Erro ao apagar'); }
  };

  const handlePinBroadcast = async (id: string) => {
    if (!confirm('Fixar essa mensagem em todos os grupos?\n\nO bot vai fixar silenciosamente (sem notificar os membros).')) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/broadcast-groups/broadcasts/${id}/pin`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message || 'Erro');
      toast.success(`Fixado em ${body.pinned} grupo(s).${body.failed > 0 ? ` ${body.failed} falhou (bot sem permissão de fixar?).` : ''}`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (authLoading || loading) return <div className="p-6 text-gray-300">Carregando...</div>;

  const activeGroups = groups.filter(g => g.is_active);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Broadcast para Grupos</h1>
        <p className="text-sm text-gray-400 mt-1">
          Envia mensagem para todos os grupos onde os bots são admins — de uma vez.
          {activeGroups.length > 0 && <span className="ml-2 text-emerald-400">{activeGroups.length} grupo(s) ativo(s)</span>}
        </p>
      </div>

      {/* Enviar mensagem */}
      <div className="bg-dark-800 border border-white/10 rounded-lg p-5">
        <h2 className="text-base font-semibold text-white mb-4">Enviar mensagem</h2>
        <textarea
          value={msgText}
          onChange={e => setMsgText(e.target.value)}
          placeholder="Digite a mensagem... (suporta Markdown: *negrito*, _itálico_)"
          rows={5}
          className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white text-sm resize-none focus:outline-none focus:border-primary-500 mb-3"
        />
        <button
          onClick={handleSend}
          disabled={sending || !activeGroups.length}
          className="px-5 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {sending ? 'Enviando...' : `Enviar para ${activeGroups.length} grupo(s)`}
        </button>
      </div>

      {/* Cadastrar grupo */}
      <div className="bg-dark-800 border border-white/10 rounded-lg p-5">
        <h2 className="text-base font-semibold text-white mb-4">Cadastrar grupo</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Bot</label>
            <select
              value={newBotId}
              onChange={e => setNewBotId(e.target.value)}
              className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white text-sm focus:outline-none"
            >
              <option value="">Selecione o bot...</option>
              {bots.filter(b => b.status !== 'disabled').map(b => (
                <option key={b.id} value={b.id}>@{b.username} {b.status === 'banned_br' ? '(banido)' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Chat ID do grupo</label>
            <input
              type="text"
              value={newChatId}
              onChange={e => setNewChatId(e.target.value)}
              placeholder="-1001234567890"
              className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Nome do grupo (opcional)</label>
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Ex: Grupo VIP 1"
              className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white text-sm focus:outline-none"
            />
          </div>
        </div>
        <button
          onClick={handleAddGroup}
          disabled={addingGroup}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {addingGroup ? 'Cadastrando...' : '+ Cadastrar grupo'}
        </button>
        <p className="text-xs text-gray-500 mt-2">
          💡 <strong className="text-gray-400">Cadastro automático:</strong> qualquer grupo onde o bot receber uma mensagem ou for adicionado como admin será registrado automaticamente aqui. O cadastro manual é só para forçar grupos que ainda não tiveram atividade.
        </p>
      </div>

      {/* Lista de grupos */}
      <div className="bg-dark-800 border border-white/10 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10">
          <h2 className="text-base font-semibold text-white">Grupos cadastrados ({groups.length})</h2>
        </div>
        {groups.length === 0 ? (
          <p className="p-5 text-gray-500 text-sm">Nenhum grupo cadastrado ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-dark-900 text-gray-400 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Grupo</th>
                <th className="px-4 py-3 text-left">Chat ID</th>
                <th className="px-4 py-3 text-left">Bot</th>
                <th className="px-4 py-3 text-left">Último envio</th>
                <th className="px-4 py-3 text-left">Ativo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {groups.map(g => (
                <tr key={g.id} className="hover:bg-dark-700/50">
                  <td className="px-4 py-3 text-white">{g.title || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{g.chat_id}</td>
                  <td className="px-4 py-3 text-gray-400">@{(g.bot as any)?.username || '?'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {g.last_sent_at ? new Date(g.last_sent_at).toLocaleString('pt-BR') : 'nunca'}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleToggle(g)} className={`text-xs px-2 py-0.5 rounded font-medium ${g.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-500'}`}>
                      {g.is_active ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleRemove(g.id)} className="text-xs text-red-400 hover:text-red-300">Remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Histórico de broadcasts */}
      {broadcasts.length > 0 && (
        <div className="bg-dark-800 border border-white/10 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10">
            <h2 className="text-base font-semibold text-white">Histórico de envios</h2>
          </div>
          <div className="divide-y divide-white/5">
            {broadcasts.map(b => (
              <div key={b.id} className="px-5 py-3 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{b.message_text}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(b.sent_at).toLocaleString('pt-BR')} · {b.successful_sends}/{b.total_groups} enviado(s)
                    {b.failed_sends > 0 && <span className="text-red-400"> · {b.failed_sends} falhou</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    b.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                    b.status === 'partial' ? 'bg-yellow-500/20 text-yellow-400' :
                    b.status === 'sending' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>{b.status}</span>
                  {b.status !== 'sending' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePinBroadcast(b.id)}
                        className="text-xs text-amber-400 hover:text-amber-300"
                        title="Fixa essa mensagem em todos os grupos (silenciosamente)"
                      >
                        📌 Fixar em todos
                      </button>
                      <button
                        onClick={() => handleDeleteBroadcast(b.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        🗑 Apagar de todos
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
