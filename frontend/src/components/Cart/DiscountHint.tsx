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
      className={`inline-flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 px-3 py-1.5 text-xs ${className}`}
    >
      <TagIcon className="h-4 w-4 text-yellow-400" />
      <span className="text-yellow-100">
        Adicione <strong className="text-yellow-300">{best.min_items}</strong>{' '}
        {best.min_items === 1 ? 'filme' : 'filmes'} ao carrinho e ganhe{' '}
        <strong className="text-yellow-300">{best.percent}% de desconto</strong>!
      </span>
    </div>
  );
}
