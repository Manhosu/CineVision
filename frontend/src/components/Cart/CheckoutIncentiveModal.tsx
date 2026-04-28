'use client';

import { DiscountPreview } from '@/stores/cartStore';

interface Props {
  preview: DiscountPreview | null;
  open: boolean;
  /** User chose to proceed with checkout despite the upsell. */
  onContinue: () => void;
  /** User backed out — closes the modal without checking out. */
  onClose: () => void;
  /** User wants to add more items — close modal AND navigate back
      to browsing so they can pick something up. */
  onAddMore: () => void;
}

export default function CheckoutIncentiveModal({
  preview,
  open,
  onContinue,
  onClose,
  onAddMore,
}: Props) {
  if (!open || !preview || !preview.next_tier) return null;

  // Show whenever there's a higher tier reachable. Two cases:
  //   1. User has 0 tiers locked in and is below the FIRST tier's
  //      threshold (the original behaviour).
  //   2. User already has a tier locked in but a NEXT tier is
  //      available (eg. 3 items / 10% locked, but 5 items would
  //      unlock 25%) — push them toward the bigger discount.
  // All percent/threshold values are read from preview, never
  // hardcoded — admin tunes them in /admin/cart-settings.
  const { next_tier, items_missing_for_next, items_count, current_tier } = preview;
  const hasNextTier = !!next_tier && items_missing_for_next > 0;
  if (!hasNextTier) return null;

  const lockedPercent = current_tier?.percent ?? 0;
  const isUpgrade = lockedPercent > 0;

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

        <div className="mb-4 text-center text-4xl">{isUpgrade ? '🚀' : '🎁'}</div>
        <h2 className="mb-2 text-center text-2xl font-bold text-white">
          {isUpgrade ? 'Quer ganhar mais desconto?' : 'Ganhe desconto!'}
        </h2>
        <p className="mb-5 text-center text-zinc-300">
          {isUpgrade ? (
            <>
              Você já garantiu{' '}
              <strong className="text-green-400">{lockedPercent}% de desconto</strong> com{' '}
              <strong className="text-yellow-400">{items_count}</strong>{' '}
              {items_count === 1 ? 'item' : 'itens'}. Adicione mais{' '}
              <strong className="text-yellow-400">{items_missing_for_next}</strong>{' '}
              {items_missing_for_next === 1 ? 'item' : 'itens'} e suba para{' '}
              <strong className="text-yellow-400">{next_tier.percent}%</strong>!
            </>
          ) : (
            <>
              Você tem apenas <strong className="text-yellow-400">{items_count}</strong>{' '}
              {items_count === 1 ? 'item' : 'itens'} no carrinho. Adicione mais{' '}
              <strong className="text-yellow-400">{items_missing_for_next}</strong>{' '}
              {items_missing_for_next === 1 ? 'item' : 'itens'} e ganhe{' '}
              <strong className="text-yellow-400">{next_tier.percent}% de desconto</strong>!
            </>
          )}
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={onAddMore}
            className="w-full rounded-lg bg-gradient-to-r from-red-600 to-red-700 py-3 font-semibold text-white transition hover:opacity-90"
          >
            Adicionar mais {items_missing_for_next}{' '}
            {items_missing_for_next === 1 ? 'item' : 'itens'}
          </button>
          <button
            onClick={onContinue}
            className="w-full rounded-lg border border-white/20 bg-transparent py-3 text-zinc-300 transition hover:bg-white/5"
          >
            {isUpgrade
              ? `Manter ${lockedPercent}% e finalizar`
              : 'Não, continuar mesmo assim'}
          </button>
        </div>
      </div>
    </div>
  );
}
