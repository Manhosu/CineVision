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
    <>
      {/* Spacer to push content below the fixed banner */}
      <div className="h-10 sm:h-11" />
      {/* Fixed banner above header */}
      <div className="fixed top-0 left-0 right-0 z-[60] overflow-hidden bg-gradient-to-r from-red-900 via-orange-800 to-red-900 border-b border-red-700/50">
        {/* Animated background pulse */}
        <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 via-orange-500/20 to-red-600/20 animate-pulse" />

        <div className="relative z-10 container mx-auto px-4 py-2.5 flex items-center justify-center gap-3 sm:gap-5 text-center flex-wrap">
          {/* Lightning + Title */}
          <div className="flex items-center gap-1.5">
            <span className="text-lg animate-bounce">&#9889;</span>
            <span className="text-white font-extrabold text-xs sm:text-sm tracking-wide uppercase">
              Promo&ccedil;&atilde;o Rel&acirc;mpago
            </span>
          </div>

          {/* Discount value */}
          <span className="bg-white text-red-700 font-black text-xs px-2.5 py-0.5 rounded-full shadow-lg">
            {discountText}
          </span>

          {/* Countdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-white/70 text-[10px] font-medium uppercase">Termina em:</span>
            <div className="flex items-center gap-0.5">
              {timeLeft.split(':').map((unit, i) => (
                <span key={i} className="flex items-center gap-0.5">
                  {i > 0 && <span className="text-white/50 font-bold text-xs">:</span>}
                  <span className="bg-black/60 text-white font-mono font-bold text-xs px-1.5 py-0.5 rounded min-w-[1.5rem] text-center">
                    {unit}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
