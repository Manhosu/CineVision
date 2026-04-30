'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api as apiService } from '../services/api';

export interface CartContentInfo {
  id: string;
  title: string;
  poster_url?: string;
  price_cents?: number;
  type?: string;
}

export interface CartItem {
  id: string;
  cart_id: string;
  content_id: string;
  price_cents_snapshot: number;
  added_at?: string;
  content?: CartContentInfo;
}

export interface DiscountTier {
  min_items: number;
  percent: number;
}

export interface DiscountPreview {
  items_count: number;
  subtotal_cents: number;
  current_tier: DiscountTier | null;
  next_tier: DiscountTier | null;
  items_missing_for_next: number;
  discount_percent: number;
  discount_cents: number;
  total_cents: number;
  tiers: DiscountTier[];
}

interface CartState {
  items: CartItem[];
  preview: DiscountPreview | null;
  sessionId: string;
  loading: boolean;
  syncError: string | null;

  // actions
  init: () => Promise<void>;
  sync: () => Promise<void>;
  add: (contentId: string, contentInfo?: CartContentInfo) => Promise<void>;
  remove: (contentId: string) => Promise<void>;
  clear: () => Promise<void>;
  checkout: (preferredDelivery?: 'site' | 'telegram') => Promise<any>;
  isInCart: (contentId: string) => boolean;
}

const genSessionId = (): string => {
  if (typeof window === 'undefined') return 'srv-' + Math.random().toString(36).slice(2);
  const existing = localStorage.getItem('cv_cart_session_id');
  if (existing) return existing;
  const id = 'cart-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem('cv_cart_session_id', id);
  return id;
};

// Lê o business_connection_id que o BusinessLinkCapture salvou ao
// abrir uma página de detalhes vinda de link da IA via Business DM.
// Persiste durante toda a sessão (sessionStorage).
const readBusinessContext = () => {
  if (typeof window === 'undefined') return { bid: undefined as string | undefined, chat: undefined as string | undefined };
  try {
    return {
      bid: sessionStorage.getItem('cv_business_connection_id') || undefined,
      chat: sessionStorage.getItem('cv_business_chat_id') || undefined,
    };
  } catch {
    return { bid: undefined, chat: undefined };
  }
};

const buildQuery = (params: Record<string, string | undefined>) => {
  const pairs = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return pairs.length ? '?' + pairs.map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&') : '';
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      preview: null,
      sessionId: '',
      loading: false,
      syncError: null,

      async init() {
        if (!get().sessionId) {
          set({ sessionId: genSessionId() });
        }
        await get().sync();
      },

      async sync() {
        try {
          set({ loading: true, syncError: null });
          const q = buildQuery({ session_id: get().sessionId });
          const data = await apiService.get<{ items: CartItem[]; preview: DiscountPreview }>(
            `/api/v1/cart${q}`,
          );
          set({ items: data.items || [], preview: data.preview || null, loading: false });
        } catch (err: any) {
          set({ loading: false, syncError: err.message });
        }
      },

      async add(contentId, contentInfo) {
        // Optimistic add
        const existing = get().items.find((i) => i.content_id === contentId);
        if (!existing && contentInfo) {
          set((state) => ({
            items: [
              ...state.items,
              {
                id: 'pending-' + Date.now(),
                cart_id: 'pending',
                content_id: contentId,
                price_cents_snapshot: contentInfo.price_cents || 0,
                content: contentInfo,
              },
            ],
          }));
        }
        try {
          const ctx = readBusinessContext();
          const data = await apiService.post<{ items: CartItem[]; preview: DiscountPreview }>(
            '/api/v1/cart/items',
            {
              content_id: contentId,
              session_id: get().sessionId,
              ...(ctx.bid ? { business_connection_id: ctx.bid } : {}),
            },
          );
          set({ items: data.items || [], preview: data.preview || null, syncError: null });
        } catch (err: any) {
          // Rollback
          set((state) => ({
            items: state.items.filter((i) => i.content_id !== contentId || !i.id.startsWith('pending-')),
            syncError: err.message,
          }));
          throw err;
        }
      },

      async remove(contentId) {
        const snapshot = get().items;
        set({ items: snapshot.filter((i) => i.content_id !== contentId) });
        try {
          const q = buildQuery({ session_id: get().sessionId });
          const data = await apiService.delete<{ items: CartItem[]; preview: DiscountPreview }>(
            `/api/v1/cart/items/${contentId}${q}`,
          );
          set({ items: data.items || [], preview: data.preview || null });
        } catch (err: any) {
          set({ items: snapshot, syncError: err.message });
          throw err;
        }
      },

      async clear() {
        const snapshot = { items: get().items, preview: get().preview };
        set({ items: [], preview: null });
        try {
          const q = buildQuery({ session_id: get().sessionId });
          await apiService.delete(`/api/v1/cart${q}`);
          await get().sync();
        } catch (err: any) {
          set(snapshot);
          throw err;
        }
      },

      async checkout(preferredDelivery = 'telegram') {
        const ctx = readBusinessContext();
        const result = await apiService.post<any>('/api/v1/cart/checkout', {
          preferred_delivery: preferredDelivery,
          session_id: get().sessionId,
          ...(ctx.chat ? { telegram_chat_id: ctx.chat } : {}),
        });
        set({ items: [], preview: null });
        return result;
      },

      isInCart(contentId: string) {
        return get().items.some((i) => i.content_id === contentId);
      },
    }),
    {
      name: 'cv_cart_state',
      partialize: (state) => ({ sessionId: state.sessionId }),
    },
  ),
);
