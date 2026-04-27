'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { TrashIcon, ArrowLeftIcon } from '@heroicons/react/24/solid';
import { toast } from 'react-hot-toast';
import { useCartStore } from '@/stores/cartStore';
import CartDiscountBar from '@/components/Cart/CartDiscountBar';
import CheckoutIncentiveModal from '@/components/Cart/CheckoutIncentiveModal';

const fmt = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CartPage() {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const preview = useCartStore((s) => s.preview);
  const loading = useCartStore((s) => s.loading);
  const init = useCartStore((s) => s.init);
  const remove = useCartStore((s) => s.remove);
  const checkout = useCartStore((s) => s.checkout);

  const [showModal, setShowModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  const handleFinalize = async () => {
    if (!items.length) return;
    if (preview?.current_tier === null && preview.tiers.length > 0 && items.length < preview.tiers[0].min_items) {
      setShowModal(true);
      return;
    }
    await doCheckout();
  };

  const doCheckout = async () => {
    setShowModal(false);
    setProcessing(true);
    try {
      const result = await checkout('telegram');
      router.push(`/cart/checkout?token=${result.order.order_token}`);
    } catch (err: any) {
      toast.error(err.message || 'Falha ao finalizar compra.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-zinc-400 hover:text-white"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Continuar comprando
        </Link>

        <h1 className="mb-6 text-3xl font-bold">Seu carrinho</h1>

        {loading && !items.length && (
          <div className="py-12 text-center text-zinc-400">Carregando...</div>
        )}

        {!loading && !items.length && (
          <div className="rounded-2xl border border-white/10 bg-zinc-900 p-10 text-center">
            <div className="mb-3 text-5xl">🛒</div>
            <p className="mb-4 text-zinc-400">Seu carrinho está vazio</p>
            <Link
              href="/"
              className="inline-block rounded-lg bg-red-600 px-6 py-2.5 font-semibold text-white transition hover:bg-red-700"
            >
              Explorar filmes
            </Link>
          </div>
        )}

        {items.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-4 rounded-xl border border-white/10 bg-zinc-900 p-3"
                >
                  {item.content?.poster_url && (
                    <div className="relative h-24 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                      <Image
                        src={item.content.poster_url}
                        alt={item.content.title || ''}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <Link
                        href={`/${item.content?.type === 'series' ? 'series' : 'movies'}/${item.content_id}`}
                        className="font-semibold text-white hover:text-red-400"
                      >
                        {item.content?.title || 'Filme'}
                      </Link>
                      <div className="mt-1 text-sm text-zinc-400">{item.content?.type || 'filme'}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold">
                        R$ {fmt(item.price_cents_snapshot)}
                      </span>
                      <button
                        onClick={() => remove(item.content_id)}
                        className="flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1 text-xs text-red-400 transition hover:bg-red-500/10"
                      >
                        <TrashIcon className="h-3.5 w-3.5" /> Remover
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <aside className="space-y-4">
              <CartDiscountBar preview={preview} />

              <div className="rounded-xl border border-white/10 bg-zinc-900 p-4">
                <div className="mb-2 flex justify-between text-sm text-zinc-400">
                  <span>Subtotal ({preview?.items_count || 0} itens)</span>
                  <span>R$ {fmt(preview?.subtotal_cents || 0)}</span>
                </div>
                {preview && preview.discount_cents > 0 && (
                  <div className="mb-2 flex justify-between text-sm text-green-400">
                    <span>Desconto ({preview.discount_percent}%)</span>
                    <span>-R$ {fmt(preview.discount_cents)}</span>
                  </div>
                )}
                <div className="my-3 h-px bg-white/10" />
                <div className="flex items-end justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="text-2xl font-bold text-red-400">
                    R$ {fmt(preview?.total_cents || 0)}
                  </span>
                </div>

                <button
                  onClick={handleFinalize}
                  disabled={processing}
                  className="mt-4 w-full rounded-lg bg-gradient-to-r from-red-600 to-red-700 py-3 font-bold text-white shadow-lg shadow-red-900/50 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
                >
                  {processing
                    ? 'Processando...'
                    : preview && preview.discount_percent > 0
                      ? `Garantir ${preview.discount_percent}% de desconto`
                      : 'Pagar agora'}
                </button>
                {!processing && preview && preview.discount_percent === 0 && preview.next_tier && (
                  <p className="mt-2 text-center text-xs text-zinc-400">
                    Adicione mais {preview.items_missing_for_next}{' '}
                    {preview.items_missing_for_next === 1 ? 'item' : 'itens'} e ganhe{' '}
                    <span className="font-semibold text-yellow-400">
                      {preview.next_tier.percent}% off
                    </span>
                  </p>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>

      <CheckoutIncentiveModal
        open={showModal}
        preview={preview}
        onContinue={doCheckout}
        onClose={() => setShowModal(false)}
      />
    </div>
  );
}
