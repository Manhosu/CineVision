'use client';

import { useEffect, useState } from 'react';
import { TagIcon } from '@heroicons/react/24/solid';
import { api } from '@/services/api';

interface Tier {
  min_items: number;
  percent: number;
}

interface Props {
  className?: string;
}

export default function DiscountHint({ className = '' }: Props) {
  const [tiers, setTiers] = useState<Tier[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ tiers: Tier[] }>('/api/v1/cart/discount-tiers')
      .then((data) => {
        if (!cancelled) setTiers(data.tiers || []);
      })
      .catch(() => {
        /* silent */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!tiers.length) return null;

  // Pick the most attractive tier (highest %)
  const best = tiers.reduce((a, b) => (a.percent > b.percent ? a : b));

  return (
    <div
      className={`inline-flex items-center gap-2.5 rounded-xl border border-yellow-400/40 bg-gradient-to-r from-yellow-500/20 via-orange-500/15 to-amber-500/20 px-4 py-2 text-sm shadow-lg shadow-yellow-500/10 ${className}`}
    >
      <TagIcon className="h-5 w-5 flex-shrink-0 animate-pulse text-yellow-300 drop-shadow-[0_0_6px_rgba(250,204,21,0.6)]" />
      <span className="text-yellow-50">
        Adicione <strong className="text-yellow-300">{best.min_items}</strong>{' '}
        {best.min_items === 1 ? 'filme' : 'filmes'} ao carrinho e ganhe{' '}
        <strong className="text-yellow-300">{best.percent}% de desconto</strong>!
      </span>
    </div>
  );
}
