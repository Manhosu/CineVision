'use client';

import { useState, useEffect } from 'react';

interface FlashPromotion {
  id: string;
  name: string;
  description?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  ends_at: string;
  is_flash: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function FlashPromotionBanner() {
  const [promotion, setPromotion] = useState<FlashPromotion | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    async function fetchFlashPromotions() {
      try {
        const res = await fetch(`${API_URL}/api/v1/discounts/flash`, {
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setPromotion(data[0]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch flash promotions:', err);
      }
    }

    fetchFlashPromotions();
  }, []);

  useEffect(() => {
    if (!promotion) return;

    const updateCountdown = () => {
      const now = new Date().getTime();
      const end = new Date(promotion.ends_at).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft('');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(
        `${hours.toString().padStart(2, '0')}:${minutes
          .toString()
          .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [promotion]);

  if (!promotion || isExpired) return null;

  const discountText =
    promotion.discount_type === 'percentage'
      ? `${promotion.discount_value}% OFF`
      : `R$ ${(promotion.discount_value / 100).toFixed(2)} OFF`;

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-red-900 via-orange-800 to-red-900 border-b border-red-700/50">
      {/* Animated background pulse */}
      <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 via-orange-500/20 to-red-600/20 animate-pulse" />

      <div className="relative z-10 container mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-center">
        {/* Lightning + Title */}
        <div className="flex items-center gap-2">
          <span className="text-2xl animate-bounce">&#9889;</span>
          <span className="text-white font-extrabold text-lg tracking-wide uppercase">
            Promo&ccedil;&atilde;o Rel&acirc;mpago
          </span>
          <span className="text-2xl animate-bounce">&#9889;</span>
        </div>

        {/* Discount value */}
        <div className="flex items-center gap-2">
          <span className="bg-white text-red-700 font-black text-sm px-3 py-1 rounded-full shadow-lg">
            {discountText}
          </span>
        </div>

        {/* Description */}
        {promotion.description && (
          <p className="text-white/90 text-sm font-medium max-w-md">
            {promotion.description}
          </p>
        )}

        {/* Countdown */}
        <div className="flex items-center gap-2">
          <span className="text-white/70 text-xs font-medium uppercase">Termina em:</span>
          <div className="flex items-center gap-1">
            {timeLeft.split(':').map((unit, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-white/50 font-bold">:</span>}
                <span className="bg-black/60 text-white font-mono font-bold text-sm px-2 py-1 rounded min-w-[2rem] text-center">
                  {unit}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
