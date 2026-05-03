'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { api } from '@/services/api';
import AdminBackButton from '@/components/Admin/AdminBackButton';

interface OrderEntry {
  id: string;
  order_token: string;
  total_cents: number;
  total_items: number;
  paid_at: string | null;
  created_at: string;
  user_id: string | null;
  customer_whatsapp: string | null;
  telegram_chat_id?: string | null;
  items: string[];
  claim_url: string;
  whatsapp_url: string | null;
  // Só na tab "undelivered"
  purchases_total?: number;
  purchases_undelivered?: number;
}

type Tab = 'orphan' | 'undelivered';

const fmtMoney = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR') : '—';

export default function OrphanOrdersPage() {
  const [tab, setTab] = useState<Tab>('orphan');
  const [orphan, setOrphan] = useState<OrderEntry[]>([]);
  const [undelivered, setUndelivered] = useState<OrderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      // Busca as duas listas em paralelo — counts servem pra mostrar
      // badge nas tabs mesmo quando o usuário está olhando a outra.
      const [orphanData, undeliveredData] = await Promise.all([
        api.get<OrderEntry[]>('/api/v1/orders/orphan'),
        api.get<OrderEntry[]>('/api/v1/orders/undelivered'),
      ]);
      setOrphan(orphanData);
      setUndelivered(undeliveredData);
      setLastRefresh(new Date());
    } catch (err: any) {
      if (showSpinner) toast.error(err.message);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  // Carga inicial + polling 10s. Pausa quando aba está em background.
  useEffect(() => {
    load(true);
    const tick = () => {
      if (document.visibilityState === 'visible') load(false);
    };
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, [load]);

  const copyLink = async (claimUrl: string) => {
    try {
      await navigator.clipboard.writeText(claimUrl);
      toast.success('Link copiado!');
    } catch {
      toast.error('Não foi possível copiar — selecione manualmente');
    }
  };

  const copyMessage = async (o: OrderEntry) => {
    const message =
      `Olá! Para receber seu(s) filme(s) no Telegram, abra o nosso bot pelo link abaixo:\n\n` +
      `${o.claim_url}\n\n` +
      `Quando você abrir e iniciar a conversa, os links chegam automaticamente. ❤️`;
    try {
      await navigator.clipboard.writeText(message);
      toast.success('Mensagem copiada — cola no WhatsApp da cliente!');
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  const dismissOrder = async (orderId: string) => {
    if (!confirm('Marcar essa compra como perdida? Ela some do painel mas o histórico continua salvo.')) return;
    try {
      await api.patch(`/api/v1/orders/${orderId}/dismiss`, {});
      toast.success('Compra dispensada');
      load(false);
    } catch (err: any) {
      toast.error(err.message || 'Falha ao dispensar');
    }
  };

  const redeliver = async (orderId: string) => {
    try {
      const r = await api.post<{ redelivered: boolean; reason?: string }>(`/api/v1/orders/${orderId}/redeliver`, {});
      if (r.redelivered) {
        toast.success('Entrega reenviada — cliente vai receber no Telegram');
        // Polling vai atualizar lista quando bot setar delivery_sent=true
        load(false);
      } else if (r.reason === 'no_telegram_chat_id') {
        toast.error('Order ainda não tem chat do Telegram vinculado — cliente precisa abrir o bot primeiro');
      } else {
        toast.error('Não foi possível reenviar: ' + (r.reason || 'erro desconhecido'));
      }
    } catch (err: any) {
      toast.error(err.message || 'Falha ao reenviar');
    }
  };

  const list = tab === 'orphan' ? orphan : undelivered;

  return (
    <div className="mx-auto max-w-5xl p-6 text-white">
      <AdminBackButton />
      <h1 className="mb-2 text-3xl font-bold">Compras a recuperar</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Use as abas pra navegar entre <strong>compras órfãs</strong> (cliente pagou no site sem
        Telegram) e <strong>pagas não entregues</strong> (Telegram vinculado mas o link não
        chegou — pode reenviar).
      </p>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-white/10">
        <button
          onClick={() => setTab('orphan')}
          className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 -mb-px ${
            tab === 'orphan'
              ? 'border-red-500 text-white'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          Órfãs (sem Telegram)
          {orphan.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-600 px-2 text-xs font-bold text-white">
              {orphan.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('undelivered')}
          className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 -mb-px ${
            tab === 'undelivered'
              ? 'border-amber-500 text-white'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          Pagas não entregues
          {undelivered.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-amber-500 px-2 text-xs font-bold text-black">
              {undelivered.length}
            </span>
          )}
        </button>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => load(true)}
          className="rounded-lg border border-white/10 px-3 py-1 text-sm text-zinc-300 hover:bg-white/5"
        >
          ↻ Recarregar
        </button>
        <span className="text-xs text-zinc-500">
          Atualiza sozinho a cada 10s
          {lastRefresh && ` · última: ${lastRefresh.toLocaleTimeString('pt-BR')}`}
        </span>
      </div>

      {loading ? (
        <p className="text-zinc-500">Carregando...</p>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-6 text-center">
          ✅ {tab === 'orphan' ? 'Nenhuma compra órfã no momento.' : 'Nenhuma compra paga sem entrega.'}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((o) => (
            <div
              key={o.id}
              className={`rounded-xl border bg-zinc-900 p-4 ${
                tab === 'undelivered' ? 'border-amber-500/30' : 'border-white/10'
              }`}
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-zinc-400">
                    Pedido <code className="text-zinc-300">{o.order_token.slice(0, 8)}</code>
                    {' · '}
                    Pago em {fmtDate(o.paid_at)}
                  </div>
                  <div className="mt-1 text-base">
                    {o.total_items} {o.total_items === 1 ? 'item' : 'itens'} · R${' '}
                    <strong>{fmtMoney(o.total_cents)}</strong>
                  </div>
                  {o.items.length > 0 && (
                    <div className="mt-1 text-sm text-zinc-400">
                      {o.items.join(' · ')}
                    </div>
                  )}
                  {tab === 'undelivered' && o.purchases_undelivered != null && (
                    <div className="mt-1 text-sm">
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
                        {o.purchases_undelivered}/{o.purchases_total} sem entrega
                      </span>
                    </div>
                  )}
                  {o.customer_whatsapp && (
                    <div className="mt-1 text-sm">
                      <span className="text-zinc-500">WhatsApp: </span>
                      <code className="text-green-400">+{o.customer_whatsapp}</code>
                    </div>
                  )}
                  {tab === 'undelivered' && o.telegram_chat_id && (
                    <div className="mt-1 text-sm">
                      <span className="text-zinc-500">Chat ID Telegram: </span>
                      <code className="text-blue-400">{o.telegram_chat_id}</code>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {tab === 'undelivered' && (
                    <button
                      onClick={() => redeliver(o.id)}
                      className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-black hover:bg-amber-400"
                      title="Re-disparar entrega via Telegram (cliente já vinculado)"
                    >
                      🔄 Reenviar entrega
                    </button>
                  )}
                  {o.whatsapp_url && (
                    <a
                      href={o.whatsapp_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
                    >
                      💬 Mandar no WhatsApp
                    </a>
                  )}
                  {tab === 'orphan' && (
                    <button
                      onClick={() => copyMessage(o)}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold hover:bg-red-700"
                    >
                      📋 Copiar mensagem
                    </button>
                  )}
                  <button
                    onClick={() => copyLink(o.claim_url)}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5"
                  >
                    🔗 Copiar link
                  </button>
                  <button
                    onClick={() => dismissOrder(o.id)}
                    className="rounded-lg border border-red-500/30 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10"
                    title="Marcar como perdido (some do painel mas o histórico continua salvo)"
                  >
                    🗑 Marcar perdido
                  </button>
                </div>
              </div>

              {tab === 'orphan' && (
                <div className="overflow-x-auto rounded-lg border border-white/5 bg-black/30 px-3 py-2 text-xs">
                  <code className="text-zinc-400 break-all">{o.claim_url}</code>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
