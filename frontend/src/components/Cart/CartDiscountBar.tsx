'use client';

import { DiscountPreview } from '@/stores/cartStore';

interface Props {
  preview: DiscountPreview | null;
  className?: string;
}

export default function CartDiscountBar({ preview, className = '' }: Props) {
  if (!preview || !preview.tiers.length) return null;

  const { current_tier, next_tier, discount_percent, items_count, items_missing_for_next } = preview;
  const lastTier = preview.tiers[preview.tiers.length - 1];
  const maxItems = lastTier.min_items;
  const progress = Math.min(100, (items_count / maxItems) * 100);

  return (
    <div className={`rounded-xl border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm">
          {current_tier ? (
            <span className="font-semibold text-green-400">
              🎉 {discount_percent}% de desconto aplicado!
            </span>
          ) : next_tier ? (
            <span className="text-white">
              Adicione <strong className="text-yellow-400">{items_missing_for_next}</strong>{' '}
              {items_missing_for_next === 1 ? 'item' : 'itens'} e ganhe{' '}
              <strong className="text-yellow-400">{next_tier.percent}%</strong> de desconto
            </span>
          ) : (
            <span className="text-zinc-400">Adicione itens para ganhar desconto</span>
          )}
        </div>
        <div className="text-xs text-zinc-500">
          {items_count}/{maxItems}
        </div>
      </div>

      <div className="relative h-3 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-500 via-orange-400 to-yellow-400 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
        {preview.tiers.map((t, idx) => {
          const pos = (t.min_items / maxItems) * 100;
          const reached = items_count >= t.min_items;
          return (
            <div
              key={idx}
              className="absolute top-0 flex h-full items-center"
              style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
            >
              <div
                className={`h-5 w-1 rounded-full ${
                  reached ? 'bg-white shadow-lg' : 'bg-zinc-600'
                }`}
                title={`${t.min_items} itens → ${t.percent}% de desconto`}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex justify-between text-[11px] text-zinc-500">
        {preview.tiers.map((t, idx) => (
          <span key={idx} className={items_count >= t.min_items ? 'text-yellow-400' : ''}>
            {t.min_items}+ = {t.percent}%
          </span>
        ))}
      </div>
    </div>
  );
}
