'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingCartIcon } from '@heroicons/react/24/solid';
import { useCartStore } from '@/stores/cartStore';

interface Props {
  className?: string;
}

export default function CartIcon({ className = '' }: Props) {
  const items = useCartStore((s) => s.items);
  const init = useCartStore((s) => s.init);
  const loading = useCartStore((s) => s.loading);
  const pathname = usePathname();

  useEffect(() => {
    init();
  }, [init]);

  // Hide the floating cart icon on pages where it would be redundant or overlap
  // critical UI: cart page itself, checkout flow, and admin panel.
  if (
    pathname === '/cart' ||
    pathname?.startsWith('/checkout') ||
    pathname?.startsWith('/admin')
  ) {
    return null;
  }

  const count = items.length;

  return (
    <Link
      href="/cart"
      aria-label="Abrir carrinho"
      className={`fixed bottom-6 right-6 z-40 flex items-center justify-center rounded-full bg-gradient-to-br from-red-600 to-red-800 shadow-lg shadow-red-900/50 transition-all hover:scale-110 active:scale-95 ${className}`}
      style={{ width: 56, height: 56 }}
    >
      <ShoppingCartIcon className="h-6 w-6 text-white" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-yellow-400 px-1.5 text-xs font-bold text-black shadow-md">
          {count > 99 ? '99+' : count}
        </span>
      )}
      {loading && (
        <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-30" />
      )}
    </Link>
  );
}
