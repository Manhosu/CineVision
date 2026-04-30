'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { api } from '@/services/api';
import AdminBackButton from '@/components/Admin/AdminBackButton';

type Tab = 'conversations' | 'training' | 'config';

interface Conversation {
  id: string;
  platform: string;
  external_chat_id: string;
  ai_enabled: boolean;
  paused_reason?: string;
  last_message_at?: string;
  created_at: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'admin';
  content: string;
  created_at: string;
}

interface Training {
  system_prompt: string;
  faq_pairs: Array<{ question: string; answer: string }>;
}

interface Flags {
  telegram: boolean;
  whatsapp: boolean;
  telegram_business: boolean;
}

interface BusinessConnection {
  id: string;
  telegram_user_id: number;
  can_reply: boolean;
  is_enabled: boolean;
  connected_at: string;
  updated_at: string;
}

export default function AiChatAdmin() {
  const [tab, setTab] = useState<Tab>('conversations');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [training, setTraining] = useState<Training>({ system_prompt: '', faq_pairs: [] });
  const [flags, setFlags] = useState<Flags>({ telegram: false, whatsapp: false, telegram_business: false });
  const [businessConnections, setBusinessConnections] = useState<BusinessConnection[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConversations = async () => {
    try {
      const data = await api.get<Conversation[]>('/api/v1/admin/ai-chat/conversations');
      setConversations(data);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const loadMessages = async (id: string) => {
    try {
      const data = await api.get<Message[]>(`/api/v1/admin/ai-chat/conversations/${id}/messages`);
      setMessages(data);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const loadTraining = async () => {
    try {
      const data = await api.get<Training>('/api/v1/admin/ai-chat/training');
      setTraining(data);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const loadFlags = async () => {
    try {
      const data = await api.get<Flags>('/api/v1/admin/ai-chat/flags');
      setFlags(data);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const loadBusinessConnections = async () => {
    try {
      const data = await api.get<BusinessConnection[]>('/api/v1/admin/ai-chat/business-connections');
      setBusinessConnections(data);
    } catch {
      // best-effort — feature pode não estar deployada ainda
    }
  };

  const flagLabels: Record<keyof Flags, string> = {
    telegram: 'Bot do Telegram',
    whatsapp: 'WhatsApp',
    telegram_business: 'DM Pessoal (Telegram Business)',
  };

  const updateFlag = async (key: keyof Flags, value: boolean) => {
    try {
      const data = await api.put<Flags>('/api/v1/admin/ai-chat/flags', { [key]: value });
      setFlags(data);
      toast.success(`IA no ${flagLabels[key]} ${value ? 'ativada' : 'desativada'}`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  useEffect(() => {
    Promise.all([loadConversations(), loadTraining(), loadFlags(), loadBusinessConnections()]).finally(() => setLoading(false));
  }, []);

  // Polling 5s pra observar conversas em tempo real (Igor pediu —
  // SSE/WebSocket seria ideal mas 5s atende o volume atual).
  // Dois timers: um pra refrescar a lista geral, outro pra a conversa
  // aberta. Pausa quando a aba está oculta pra economizar.
  useEffect(() => {
    if (tab !== 'conversations') return;
    const tickAll = () => {
      if (document.visibilityState !== 'visible') return;
      loadConversations();
      if (selected) loadMessages(selected.id);
    };
    const id = setInterval(tickAll, 5000);
    return () => clearInterval(id);
  }, [tab, selected?.id]);

  const takeover = async (id: string) => {
    try {
      await api.post(`/api/v1/admin/ai-chat/conversations/${id}/takeover`);
      toast.success('IA pausada — você assumiu esse chat');
      loadConversations();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const resume = async (id: string) => {
    try {
      await api.post(`/api/v1/admin/ai-chat/conversations/${id}/resume`);
      toast.success('IA reativada');
      loadConversations();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const sendReply = async () => {
    if (!selected || !replyText.trim()) return;
    setSendingReply(true);
    try {
      await api.post(`/api/v1/admin/ai-chat/conversations/${selected.id}/send`, {
        text: replyText.trim(),
      });
      setReplyText('');
      // Reload imediatamente pra a mensagem aparecer sem esperar o tick.
      await Promise.all([loadMessages(selected.id), loadConversations()]);
      // Se IA estava ativa, ela acabou de ser pausada pelo backend —
      // recarrega a conversa selecionada pro botão refletir o novo estado.
      const fresh = await api.get<Conversation[]>('/api/v1/admin/ai-chat/conversations');
      const updated = fresh.find((c) => c.id === selected.id);
      if (updated) setSelected(updated);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSendingReply(false);
    }
  };

  const saveTraining = async () => {
    try {
      await api.put('/api/v1/admin/ai-chat/training', training);
      toast.success('Treinamento salvo!');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) return <div className="p-8 text-white">Carregando...</div>;

  return (
    <div className="mx-auto max-w-6xl p-6 text-white">
      <AdminBackButton />
      <h1 className="mb-6 text-3xl font-bold">Atendimento IA</h1>

      <div className="mb-4 flex gap-3 border-b border-white/10">
        <TabBtn current={tab} value="conversations" onClick={setTab}>
          Conversas ({conversations.length})
        </TabBtn>
        <TabBtn current={tab} value="training" onClick={setTab}>
          Treinamento
        </TabBtn>
        <TabBtn current={tab} value="config" onClick={setTab}>
          Configuração
        </TabBtn>
      </div>

      {tab === 'conversations' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
          <aside className="space-y-2">
            {conversations.length === 0 && (
              <p className="text-zinc-500">Nenhuma conversa ainda.</p>
            )}
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setSelected(c);
                  loadMessages(c.id);
                }}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selected?.id === c.id ? 'border-red-500 bg-red-500/10' : 'border-white/10 bg-zinc-900 hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {c.platform === 'telegram_business' ? (
                    <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-300">
                      DM PESSOAL
                    </span>
                  ) : c.platform === 'telegram' ? (
                    <span className="rounded bg-zinc-500/20 px-1.5 py-0.5 text-[10px] font-bold text-zinc-300">
                      BOT
                    </span>
                  ) : (
                    <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-[10px] font-bold text-green-300">
                      WHATSAPP
                    </span>
                  )}
                  <span className="truncate">{c.external_chat_id}</span>
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {c.ai_enabled ? (
                    <span className="text-green-400">IA ativa</span>
                  ) : (
                    <span className="text-yellow-400">
                      Pausada {c.paused_reason ? `(${c.paused_reason})` : ''}
                    </span>
                  )}
                  {c.last_message_at && (
                    <> · {new Date(c.last_message_at).toLocaleString('pt-BR')}</>
                  )}
                </div>
              </button>
            ))}
          </aside>

          <section className="rounded-xl border border-white/10 bg-zinc-900 p-4">
            {!selected ? (
              <p className="text-center text-zinc-500">Selecione uma conversa</p>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-bold">
                    {selected.platform} · {selected.external_chat_id}
                  </h2>
                  <div className="flex gap-2">
                    {selected.ai_enabled ? (
                      <button
                        onClick={() => takeover(selected.id)}
                        className="rounded-lg bg-yellow-600 px-3 py-1.5 text-sm hover:bg-yellow-700"
                      >
                        Assumir manualmente
                      </button>
                    ) : (
                      <button
                        onClick={() => resume(selected.id)}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-sm hover:bg-green-700"
                      >
                        Reativar IA
                      </button>
                    )}
                  </div>
                </div>
                <div className="max-h-[60vh] space-y-3 overflow-y-auto">
                  {messages.map((m) => {
                    const isUser = m.role === 'user';
                    const isAdmin = m.role === 'admin';
                    const bubbleClass = isUser
                      ? 'bg-zinc-800'
                      : isAdmin
                        ? 'bg-blue-600/10 border border-blue-500/30'
                        : 'bg-red-600/10 border border-red-500/30';
                    const author = isUser ? 'Cliente' : isAdmin ? 'Admin (você)' : 'IA';
                    return (
                      <div key={m.id} className={`rounded-xl p-3 ${bubbleClass}`}>
                        <div className="mb-1 text-xs text-zinc-500">
                          {author} · {new Date(m.created_at).toLocaleString('pt-BR')}
                        </div>
                        <div className="whitespace-pre-wrap text-sm">{m.content}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Input do admin — manda mensagem direto pelo painel.
                    Backend pausa a IA automaticamente no primeiro envio. */}
                <div className="mt-4 flex gap-2 border-t border-white/10 pt-4">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendReply();
                      }
                    }}
                    placeholder="Digite sua resposta... (Enter envia, Shift+Enter quebra linha)"
                    rows={2}
                    disabled={sendingReply}
                    className="flex-1 resize-none rounded-lg border border-white/10 bg-zinc-950 p-3 text-sm focus:border-red-500 focus:outline-none disabled:opacity-50"
                  />
                  <button
                    onClick={sendReply}
                    disabled={sendingReply || !replyText.trim()}
                    className="self-end rounded-lg bg-red-600 px-5 py-2 font-semibold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
                  >
                    {sendingReply ? 'Enviando...' : 'Enviar'}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {tab === 'training' && (
        <div className="space-y-5 rounded-xl border border-white/10 bg-zinc-900 p-6">
          <div>
            <label className="mb-1 block text-sm font-semibold">Personalidade (system prompt)</label>
            <textarea
              value={training.system_prompt}
              onChange={(e) => setTraining({ ...training, system_prompt: e.target.value })}
              rows={8}
              className="w-full rounded-lg border border-white/10 bg-zinc-950 p-3 text-sm"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-semibold">Perguntas frequentes</label>
              <button
                onClick={() => setTraining({ ...training, faq_pairs: [...training.faq_pairs, { question: '', answer: '' }] })}
                className="rounded-lg border border-white/20 px-3 py-1 text-xs"
              >
                + FAQ
              </button>
            </div>
            <div className="space-y-2">
              {training.faq_pairs.map((f, i) => (
                <div key={i} className="rounded-lg border border-white/10 bg-zinc-950 p-3">
                  <input
                    value={f.question}
                    onChange={(e) => {
                      const faqs = [...training.faq_pairs];
                      faqs[i].question = e.target.value;
                      setTraining({ ...training, faq_pairs: faqs });
                    }}
                    placeholder="Pergunta"
                    className="mb-2 w-full rounded-md border border-white/10 bg-black px-2 py-1 text-sm"
                  />
                  <textarea
                    value={f.answer}
                    onChange={(e) => {
                      const faqs = [...training.faq_pairs];
                      faqs[i].answer = e.target.value;
                      setTraining({ ...training, faq_pairs: faqs });
                    }}
                    placeholder="Resposta"
                    rows={2}
                    className="w-full rounded-md border border-white/10 bg-black px-2 py-1 text-sm"
                  />
                  <button
                    onClick={() => setTraining({ ...training, faq_pairs: training.faq_pairs.filter((_, j) => j !== i) })}
                    className="mt-2 text-xs text-red-400"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={saveTraining}
            className="rounded-lg bg-red-600 px-5 py-2 font-semibold hover:bg-red-700"
          >
            Salvar treinamento
          </button>
        </div>
      )}

      {tab === 'config' && (
        <div className="space-y-4 rounded-xl border border-white/10 bg-zinc-900 p-6">
          <h2 className="mb-2 text-lg font-bold">Habilitar atendimento por IA</h2>
          <p className="mb-4 text-sm text-zinc-400">
            Ative só os canais que você quer atender com IA. Quando desligado, a IA não responde
            nada — você atende normalmente como antes.
          </p>

          <ToggleRow
            label="IA atende mensagens no Bot do Telegram"
            description="Quando alguém manda DM pro @cinevisionv2bot."
            value={flags.telegram}
            onChange={(v) => updateFlag('telegram', v)}
          />
          <ToggleRow
            label="IA atende DMs do seu Telegram pessoal (Business)"
            description="Requer Telegram Business + bot conectado em Settings → Business → Chatbots."
            value={flags.telegram_business}
            onChange={(v) => updateFlag('telegram_business', v)}
          />
          <ToggleRow
            label="IA atende mensagens no WhatsApp"
            description="Requer WhatsApp configurado (Evolution API ou similar)."
            value={flags.whatsapp}
            onChange={(v) => updateFlag('whatsapp', v)}
          />

          {/* Status da conexão Business — só renderiza quando flag tá ativa */}
          {flags.telegram_business && (
            <div className="mt-6 rounded-lg border border-white/10 bg-zinc-950 p-4">
              <h3 className="mb-2 text-sm font-semibold">Conexões Business ativas</h3>
              {businessConnections.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  Nenhuma conta conectada ainda. No app do Telegram, vá em{' '}
                  <strong>Configurações → Telegram Business → Chatbots</strong> e adicione{' '}
                  <code className="rounded bg-black px-1 py-0.5">@cinevisionv2bot</code>.
                </p>
              ) : (
                <div className="space-y-2">
                  {businessConnections.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded border border-white/5 p-2 text-xs"
                    >
                      <div>
                        <div className="text-zinc-300">
                          Telegram ID <code className="text-zinc-100">{c.telegram_user_id}</code>
                        </div>
                        <div className="text-zinc-500">
                          Conexão <code>{c.id.slice(0, 8)}…</code> · atualizada em{' '}
                          {new Date(c.updated_at).toLocaleString('pt-BR')}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                            c.is_enabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {c.is_enabled ? 'ATIVA' : 'DESATIVADA'}
                        </span>
                        {!c.can_reply && (
                          <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-[10px] font-semibold text-yellow-300">
                            SÓ LEITURA
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between rounded-lg border border-white/10 bg-zinc-950 p-4">
      <div>
        <div className="font-semibold">{label}</div>
        {description && <div className="mt-1 text-xs text-zinc-500">{description}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition ${
          value ? 'bg-green-600' : 'bg-zinc-700'
        }`}
        role="switch"
        aria-checked={value}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
            value ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

function TabBtn({ current, value, onClick, children }: { current: Tab; value: Tab; onClick: (v: Tab) => void; children: React.ReactNode }) {
  const active = current === value;
  return (
    <button
      onClick={() => onClick(value)}
      className={`border-b-2 px-4 py-2 text-sm font-semibold transition ${
        active ? 'border-red-500 text-white' : 'border-transparent text-zinc-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}
