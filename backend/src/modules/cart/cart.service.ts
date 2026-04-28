import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface CartDiscountTier {
  min_items: number;
  percent: number;
}

export interface CartDiscountPreview {
  items_count: number;
  subtotal_cents: number;
  current_tier: CartDiscountTier | null;
  next_tier: CartDiscountTier | null;
  items_missing_for_next: number;
  discount_percent: number;
  discount_cents: number;
  total_cents: number;
  tiers: CartDiscountTier[];
}

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey =
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
      this.configService.get<string>('SUPABASE_SERVICE_KEY') ||
      this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing for CartService');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // ---------------------------------------------------------------------------
  // Discount tiers (from admin_settings)
  // ---------------------------------------------------------------------------
  async getDiscountTiers(): Promise<CartDiscountTier[]> {
    const { data } = await this.supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'cart_discount_tiers')
      .maybeSingle();

    if (!data?.value) {
      return [
        { min_items: 3, percent: 10 },
        { min_items: 5, percent: 25 },
      ];
    }

    try {
      const parsed = JSON.parse(data.value) as CartDiscountTier[];
      return parsed
        .filter((t) => Number.isFinite(t.min_items) && Number.isFinite(t.percent))
        .sort((a, b) => a.min_items - b.min_items);
    } catch (err) {
      this.logger.warn('Failed to parse cart_discount_tiers, using defaults', err);
      return [
        { min_items: 3, percent: 10 },
        { min_items: 5, percent: 25 },
      ];
    }
  }

  async setDiscountTiers(tiers: CartDiscountTier[]): Promise<void> {
    if (!Array.isArray(tiers)) {
      throw new BadRequestException('tiers deve ser um array');
    }

    for (const t of tiers) {
      if (!Number.isFinite(t.min_items) || !Number.isFinite(t.percent)) {
        throw new BadRequestException('Cada faixa deve ter min_items e percent numéricos');
      }
      if (t.min_items < 1) {
        throw new BadRequestException('min_items precisa ser ≥ 1');
      }
      if (t.percent <= 0 || t.percent > 100) {
        throw new BadRequestException('percent precisa estar entre 1 e 100');
      }
    }

    // Dedupe by min_items (last write wins) + ordena ASC por min_items
    const byMin = new Map<number, number>();
    for (const t of tiers) byMin.set(Math.floor(t.min_items), t.percent);
    const sorted = Array.from(byMin.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([min_items, percent]) => ({ min_items, percent }));

    // Monotonicidade: o desconto não pode decrescer quando o cliente adiciona mais itens.
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].percent < sorted[i - 1].percent) {
        throw new BadRequestException(
          `Faixa de ${sorted[i].min_items} itens (${sorted[i].percent}%) tem desconto menor que a faixa de ${sorted[i - 1].min_items} itens (${sorted[i - 1].percent}%). O cliente perderia desconto ao adicionar mais itens.`,
        );
      }
    }

    await this.supabase
      .from('admin_settings')
      .upsert(
        {
          key: 'cart_discount_tiers',
          value: JSON.stringify(sorted),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' },
      );
  }

  // ---------------------------------------------------------------------------
  // Cart retrieval / creation
  // ---------------------------------------------------------------------------
  async getOrCreateCart(userId?: string, sessionId?: string) {
    if (!userId && !sessionId) {
      throw new BadRequestException('Either user_id or session_id is required');
    }

    // Look up by both keys when both are present. Previous version only
    // queried one column, then INSERTed with both — if the user had a
    // pre-login session-cart, the insert collided with the
    // `uniq_carts_session_id` partial unique index and bubbled up as
    // "duplicate key value violates unique constraint" on the very
    // first add-to-cart click after sign-in.
    let cart = await this.findCartByKeys(userId, sessionId);
    if (cart) {
      // If we matched a session-only cart and the user is now logged
      // in, claim it. Same idea for the inverse (user-only cart that
      // gets a session id later) — keep the cart, just fill in the
      // missing key so subsequent lookups by either key resolve.
      const updates: Record<string, string> = {};
      if (userId && !cart.user_id) updates.user_id = userId;
      if (sessionId && !cart.session_id) updates.session_id = sessionId;
      if (Object.keys(updates).length > 0) {
        const { data: claimed } = await this.supabase
          .from('carts')
          .update(updates)
          .eq('id', cart.id)
          .select('*')
          .single();
        if (claimed) cart = claimed;
      }
      return cart;
    }

    const insertPayload: any = {};
    if (userId) insertPayload.user_id = userId;
    if (sessionId) insertPayload.session_id = sessionId;

    const { data: created, error } = await this.supabase
      .from('carts')
      .insert(insertPayload)
      .select('*')
      .single();

    if (created) return created;

    // Insert failed. The most common cause is a race or a duplicate
    // (e.g. a pre-existing session-cart that wasn't visible to the
    // initial lookup due to read-replica lag). Re-check both keys
    // before giving up.
    const retry = await this.findCartByKeys(userId, sessionId);
    if (retry) return retry;

    throw new BadRequestException(`Failed to create cart: ${error?.message}`);
  }

  // Looks up a cart by either user_id or session_id, in that order of
  // preference. Returns the first match. Both keys are partial-unique
  // (NULLs allowed), so we can't combine them into a single OR query
  // safely — do them sequentially and prefer the user-owned cart.
  private async findCartByKeys(userId?: string, sessionId?: string) {
    if (userId) {
      const { data } = await this.supabase
        .from('carts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1);
      if (data && data.length > 0) return data[0];
    }
    if (sessionId) {
      const { data } = await this.supabase
        .from('carts')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(1);
      if (data && data.length > 0) return data[0];
    }
    return null;
  }

  async getCartWithItems(userId?: string, sessionId?: string) {
    const cart = await this.getOrCreateCart(userId, sessionId);

    const { data: items } = await this.supabase
      .from('cart_items')
      .select(
        `
        id,
        cart_id,
        content_id,
        price_cents_snapshot,
        added_at,
        content:content(
          id,
          title,
          poster_url,
          price_cents,
          content_type,
          status
        )
      `,
      )
      .eq('cart_id', cart.id)
      .order('added_at', { ascending: false });

    const preview = await this.calculateDiscount((items || []).length, items || []);

    return {
      cart,
      items: items || [],
      preview,
    };
  }

  // ---------------------------------------------------------------------------
  // Add / remove
  // ---------------------------------------------------------------------------
  async addItem(contentId: string, userId?: string, sessionId?: string) {
    const cart = await this.getOrCreateCart(userId, sessionId);

    const { data: content, error: contentError } = await this.supabase
      .from('content')
      .select('id, title, price_cents, status')
      .eq('id', contentId)
      .single();

    if (contentError || !content) {
      throw new NotFoundException(`Content ${contentId} not found`);
    }

    if (content.status !== 'PUBLISHED' && content.status !== 'published') {
      throw new BadRequestException('Content is not available for purchase');
    }

    const { error } = await this.supabase
      .from('cart_items')
      .upsert(
        {
          cart_id: cart.id,
          content_id: contentId,
          price_cents_snapshot: content.price_cents,
        },
        { onConflict: 'cart_id,content_id' },
      );

    if (error) {
      throw new BadRequestException(`Failed to add item: ${error.message}`);
    }

    await this.touchCart(cart.id);
    return this.getCartWithItems(userId, sessionId);
  }

  async removeItem(contentId: string, userId?: string, sessionId?: string) {
    const cart = await this.getOrCreateCart(userId, sessionId);

    await this.supabase
      .from('cart_items')
      .delete()
      .eq('cart_id', cart.id)
      .eq('content_id', contentId);

    await this.touchCart(cart.id);
    return this.getCartWithItems(userId, sessionId);
  }

  async clearCart(userId?: string, sessionId?: string) {
    const cart = await this.getOrCreateCart(userId, sessionId);

    await this.supabase
      .from('cart_items')
      .delete()
      .eq('cart_id', cart.id);

    await this.touchCart(cart.id);
    return this.getCartWithItems(userId, sessionId);
  }

  private async touchCart(cartId: string) {
    await this.supabase
      .from('carts')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', cartId);
  }

  // ---------------------------------------------------------------------------
  // Discount calculation
  // ---------------------------------------------------------------------------
  async calculateDiscount(
    itemsCount: number,
    items: Array<{ price_cents_snapshot: number }>,
  ): Promise<CartDiscountPreview> {
    const tiers = await this.getDiscountTiers();
    const subtotalCents = items.reduce(
      (acc, it) => acc + (it.price_cents_snapshot || 0),
      0,
    );

    // Find best applicable tier
    const applicable = tiers.filter((t) => itemsCount >= t.min_items);
    const current = applicable.length
      ? applicable.reduce((a, b) => (a.percent > b.percent ? a : b))
      : null;

    // Find next tier to reach
    const remaining = tiers.filter((t) => itemsCount < t.min_items);
    const next = remaining.length ? remaining[0] : null;
    const itemsMissing = next ? next.min_items - itemsCount : 0;

    const discountPercent = current?.percent || 0;
    const discountCents = Math.round((subtotalCents * discountPercent) / 100);
    const totalCents = Math.max(0, subtotalCents - discountCents);

    return {
      items_count: itemsCount,
      subtotal_cents: subtotalCents,
      current_tier: current,
      next_tier: next,
      items_missing_for_next: itemsMissing,
      discount_percent: discountPercent,
      discount_cents: discountCents,
      total_cents: totalCents,
      tiers,
    };
  }

  async getDiscountPreview(userId?: string, sessionId?: string) {
    const result = await this.getCartWithItems(userId, sessionId);
    return result.preview;
  }
}
