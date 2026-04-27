'use client';

import { useState } from 'react';
import { CheckIcon, ShoppingCartIcon } from '@heroicons/react/24/solid';
import { toast } from 'react-hot-toast';
import { useCartStore, CartContentInfo } from '@/stores/cartStore';

interface Props {
  content: CartContentInfo;
  variant?: 'hero' | 'card' | 'icon';
  className?: string;
}

export default function AddToCartButton({ content, variant = 'hero', className = '' }: Props) {
  const isInCart = useCartStore((s) => s.isInCart(content.id));
  const add = useCartStore((s) => s.add);
  const remove = useCartStore((s) => s.remove);
  const [busy, setBusy] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      if (isInCart) {
        await remove(content.id);
        toast.success('Removido do carrinho');
      } else {
        await add(content.id, content);
        toast.success('Adicionado ao carrinho 🛒');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar carrinho');
    } finally {
      setBusy(false);
    }
  };

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        title={isInCart ? 'Remover do carrinho' : 'Adicionar ao carrinho'}
        aria-label={isInCart ? 'Remover do carrinho' : 'Adicionar ao carrinho'}
        className={`flex h-9 w-9 items-center justify-center rounded-full border transition-all ${
          isInCart
            ? 'border-green-500 bg-green-500/90 text-white hover:bg-green-600'
            : 'border-white/30 bg-black/60 text-white backdrop-blur hover:border-red-500 hover:bg-red-600'
        } ${busy ? 'opacity-60' : ''} ${className}`}
      >
        {isInCart ? (
          <CheckIcon className="h-4 w-4" />
        ) : (
          <ShoppingCartIcon className="h-4 w-4" />
        )}
      </button>
    );
  }

  if (variant === 'card') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={`flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
          isInCart
            ? 'border-green-500 bg-green-500/10 text-green-400'
            : 'border-white/20 bg-black/50 text-white hover:border-red-500 hover:bg-red-600/20'
        } ${busy ? 'opacity-60' : ''} ${className}`}
      >
        {isInCart ? <CheckIcon className="h-3.5 w-3.5" /> : <ShoppingCartIcon className="h-3.5 w-3.5" />}
        {isInCart ? 'No carrinho' : 'Adicionar'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={`flex items-center justify-center gap-2 rounded-lg border-2 px-5 py-2.5 font-semibold transition-all ${
        isInCart
          ? 'border-green-500 bg-green-500/10 text-green-300 hover:bg-green-500/20'
          : 'border-white/30 bg-white/10 text-white backdrop-blur hover:border-red-500 hover:bg-red-600/20'
      } ${busy ? 'cursor-wait opacity-60' : ''} ${className}`}
    >
      {isInCart ? <CheckIcon className="h-5 w-5" /> : <ShoppingCartIcon className="h-5 w-5" />}
      {isInCart ? 'No carrinho' : 'Adicionar ao carrinho'}
    </button>
  );
}
