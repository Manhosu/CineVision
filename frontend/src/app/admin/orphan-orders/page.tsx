'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { api } from '@/services/api';
import AdminBackButton from '@/components/Admin/AdminBackButton';

interface OrphanOrder {
  id: string;
  order_token: string;
  total_cents: number;
  total_items: number;
  paid_at: string | null;
  created_at: string;
  user_id: string | null;
  items: string[];
  claim_url: string;
}

const fmtMoney = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR') : '—';

export default function OrphanOrdersPage() {
  const [orders, setOrders] = useState<OrphanOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      const data = await api.get<OrphanOrder[]>('/api/v1/orders/orphan');
      setOrders(data);
      setLastRefresh(new Date());
    } catch (err: any) {
      if (showSpinner) toast.error(err.message);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  // Carga inicial + polling 10s. Quando o cliente clica em
  // "Receber pelo Telegram" e o bot faz o claim, o pedido vira
  // não-órfão (telegram_chat_id deixa de ser null). Na próxima
  // tick do polling, ele some daqui sozinho. Pausa quando a aba
  // está em background.
  useEffect(() => {
    load(true);
    const tick = () => {
      if (document.visibilityState === 'visible') load(false);
    };
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, []);

  const copyLink = async (claimUrl: string) => {
    try {
      await navigator.clipboard.writeText(claimUrl);
      toast.success('Link copiado!');
    } catch {
      toast.error('Não foi possível copiar — selecione manualmente');
    }
  };

  const copyMessage = async (o: OrphanOrder) => {
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

  return (
    <div className="mx-auto max-w-5xl p-6 text-white">
      <AdminBackButton />
      <h1 className="mb-2 text-3xl font-bold">Compras órfãs</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Pedidos pagos via web sem associação ao Telegram. Use os botões abaixo pra copiar
        o link de recuperação ou a mensagem pronta pra mandar pra cliente. Quando ela
        clicar e abrir o bot, os filmes são entregues automaticamente.
      </p>

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
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-6 text-center">
          ✅ Nenhuma compra órfã no momento.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div
              key={o.id}
              className="rounded-xl border border-white/10 bg-zinc-900 p-4"
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
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    onClick={() => copyMessage(o)}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold hover:bg-red-700"
                  >
                    📋 Copiar mensagem
                  </button>
                  <button
                    onClick={() => copyLink(o.claim_url)}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5"
                  >
                    🔗 Copiar só o link
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-white/5 bg-black/30 px-3 py-2 text-xs">
                <code className="text-zinc-400 break-all">{o.claim_url}</code>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
