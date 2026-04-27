'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'react-hot-toast';
import { api } from '@/services/api';

const fmt = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CheckoutPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params?.get('token') || null;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (!token) {
      router.push('/cart');
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const data = await api.get<any>(`/api/v1/orders/token/${token}`);
        if (cancelled) return;
        setOrder(data);
        setLoading(false);
        if (data?.status === 'paid') {
          setPolling(false);
        }
      } catch (err: any) {
        toast.error(err.message || 'Pedido não encontrado');
        setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 4000);
    setPolling(true);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token, router]);

  const copyPix = () => {
    if (!order?.payment?.provider_meta?.qr_code) return;
    navigator.clipboard.writeText(order.payment.provider_meta.qr_code);
    toast.success('Código PIX copiado!');
  };

  if (loading) {
    return <div className="min-h-screen bg-black p-8 text-center text-white">Carregando pedido...</div>;
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-black p-8 text-center text-white">
        <p className="mb-4">Pedido não encontrado.</p>
        <Link href="/cart" className="text-red-400 underline">
          Voltar ao carrinho
        </Link>
      </div>
    );
  }

  const qrB64 = order.payment?.provider_meta?.qr_code_base64;
  const qrCode = order.payment?.provider_meta?.qr_code;
  const paid = order.status === 'paid';

  return (
    <div className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-zinc-900 p-6">
        {paid ? (
          <div className="text-center">
            <div className="mb-4 text-6xl">✅</div>
            <h1 className="mb-2 text-3xl font-bold text-green-400">Pagamento confirmado!</h1>
            <p className="mb-6 text-zinc-300">
              Você receberá os links dos filmes pelo Telegram em instantes.
            </p>
            <Link
              href="/minha-lista"
              className="inline-block rounded-lg bg-red-600 px-6 py-3 font-semibold text-white"
            >
              Ver meus filmes
            </Link>
          </div>
        ) : (
          <>
            <h1 className="mb-1 text-2xl font-bold">Pague para liberar seus filmes</h1>
            <p className="mb-6 text-sm text-zinc-400">
              Escaneie o QR code ou copie o código PIX abaixo. A confirmação acontece em até 1 minuto.
            </p>

            <div className="mb-6 flex flex-col items-center gap-4 rounded-xl border border-white/10 bg-black p-6">
              {qrB64 ? (
                <Image
                  src={qrB64.startsWith('data:') ? qrB64 : `data:image/png;base64,${qrB64}`}
                  alt="QR PIX"
                  width={240}
                  height={240}
                  className="rounded-lg bg-white p-2"
                />
              ) : (
                <div className="text-zinc-500">QR Code não disponível</div>
              )}

              <div className="w-full">
                <label className="text-xs text-zinc-500">Código copia-e-cola</label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={qrCode || ''}
                    className="flex-1 rounded-lg border border-white/10 bg-black px-3 py-2 text-xs text-zinc-300"
                  />
                  <button
                    onClick={copyPix}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    Copiar
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-zinc-950 p-4">
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-zinc-400">Itens no pedido</span>
                <span>{order.total_items}</span>
              </div>
              {order.discount_percent > 0 && (
                <div className="mb-2 flex justify-between text-sm text-green-400">
                  <span>Desconto</span>
                  <span>{order.discount_percent}% (-R$ {fmt(order.discount_cents)})</span>
                </div>
              )}
              <div className="mt-2 flex items-end justify-between border-t border-white/10 pt-2">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-bold text-red-400">R$ {fmt(order.total_cents)}</span>
              </div>
            </div>

            {polling && (
              <p className="mt-6 text-center text-xs text-zinc-500">
                Aguardando pagamento... essa página atualiza sozinha.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
