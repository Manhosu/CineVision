'use client';

import { DiscountPreview } from '@/stores/cartStore';

interface Props {
  preview: DiscountPreview | null;
  open: boolean;
  onContinue: () => void;
  onClose: () => void;
}

export default function CheckoutIncentiveModal({ preview, open, onContinue, onClose }: Props) {
  if (!open || !preview || !preview.next_tier) return null;

  const { next_tier, items_missing_for_next, items_count } = preview;
  const firstTier = preview.tiers[0];
  const show = preview.current_tier === null && firstTier && items_count < firstTier.min_items;

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 shadow-2xl">
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 text-zinc-500 hover:text-white"
        >
          ✕
        </button>

        <div className="mb-4 text-center text-4xl">🎁</div>
        <h2 className="mb-2 text-center text-2xl font-bold text-white">Ganhe desconto!</h2>
        <p className="mb-5 text-center text-zinc-300">
          Você tem apenas <strong className="text-yellow-400">{items_count}</strong>{' '}
          {items_count === 1 ? 'item' : 'itens'} no carrinho. Adicione mais{' '}
          <strong className="text-yellow-400">{items_missing_for_next}</strong>{' '}
          {items_missing_for_next === 1 ? 'item' : 'itens'} e ganhe{' '}
          <strong className="text-yellow-400">{next_tier.percent}% de desconto</strong>!
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-gradient-to-r from-red-600 to-red-700 py-3 font-semibold text-white transition hover:opacity-90"
          >
            Adicionar mais {items_missing_for_next}{' '}
            {items_missing_for_next === 1 ? 'item' : 'itens'}
          </button>
          <button
            onClick={onContinue}
            className="w-full rounded-lg border border-white/20 bg-transparent py-3 text-zinc-300 transition hover:bg-white/5"
          >
            Não, continuar mesmo assim
          </button>
        </div>
      </div>
    </div>
  );
}
