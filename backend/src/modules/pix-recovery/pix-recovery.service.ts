import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../config/supabase.service';
import { OrdersService } from '../orders/orders.service';
import { TelegramsEnhancedService } from '../telegrams/telegrams-enhanced.service';

@Injectable()
export class PixRecoveryService {
  private readonly logger = new Logger(PixRecoveryService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly ordersService: OrdersService,
    private readonly configService: ConfigService,
    @Optional()
    @Inject(forwardRef(() => TelegramsEnhancedService))
    private readonly telegramsService?: TelegramsEnhancedService,
  ) {}

  // ---------------------------------------------------------------------------
  // Admin settings getters
  // ---------------------------------------------------------------------------
  private async getSetting(key: string): Promise<string | null> {
    const { data } = await this.supabase.client
      .from('admin_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    return data?.value ?? null;
  }

  private async getSettings() {
    const [enabled, delay, discount, blockMin, blockMax, maxItems, maxAgeDays] = await Promise.all([
      this.getSetting('pix_recovery_enabled'),
      this.getSetting('pix_recovery_delay_minutes'),
      this.getSetting('pix_recovery_discount_percent'),
      this.getSetting('pix_recovery_block_days_min'),
      this.getSetting('pix_recovery_block_days_max'),
      this.getSetting('pix_recovery_max_items'),
      this.getSetting('pix_recovery_max_age_days'),
    ]);
    const min = parseInt(blockMin ?? '30', 10) || 30;
    const maxRaw = parseInt(blockMax ?? '60', 10) || 60;
    // Guarantee max >= min so the random window is always valid.
    const max = Math.max(min, maxRaw);
    // Default max age = 30 days (Igor: "alcançar usuários antigos").
    // Set to 0 to disable upper bound and consider every pending order.
    const ageDays = parseInt(maxAgeDays ?? '30', 10);
    return {
      enabled: (enabled ?? 'true').toLowerCase() === 'true',
      delayMinutes: parseInt(delay ?? '5', 10) || 5,
      discountPercent: parseFloat(discount ?? '10') || 10,
      blockDaysMin: min,
      blockDaysMax: max,
      maxItems: parseInt(maxItems ?? '2', 10) || 2,
      maxAgeDays: Number.isFinite(ageDays) && ageDays >= 0 ? ageDays : 30,
    };
  }

  async setSettings(input: {
    enabled?: boolean;
    delayMinutes?: number;
    discountPercent?: number;
    blockDaysMin?: number;
    blockDaysMax?: number;
    maxItems?: number;
    maxAgeDays?: number;
  }) {
    const pairs: Array<[string, string]> = [];
    if (input.enabled !== undefined)
      pairs.push(['pix_recovery_enabled', String(input.enabled)]);
    if (input.delayMinutes !== undefined)
      pairs.push(['pix_recovery_delay_minutes', String(input.delayMinutes)]);
    if (input.discountPercent !== undefined)
      pairs.push(['pix_recovery_discount_percent', String(input.discountPercent)]);
    if (input.blockDaysMin !== undefined)
      pairs.push(['pix_recovery_block_days_min', String(Math.max(1, Math.floor(input.blockDaysMin)))]);
    if (input.blockDaysMax !== undefined)
      pairs.push(['pix_recovery_block_days_max', String(Math.max(1, Math.floor(input.blockDaysMax)))]);
    if (input.maxItems !== undefined)
      pairs.push(['pix_recovery_max_items', String(input.maxItems)]);
    if (input.maxAgeDays !== undefined)
      pairs.push(['pix_recovery_max_age_days', String(Math.max(0, Math.floor(input.maxAgeDays)))]);

    for (const [key, value] of pairs) {
      await this.supabase.client.from('admin_settings').upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      );
    }
  }

  /**
   * Picks a random timestamp between (now + minDays) and (now + maxDays).
   * The randomness is what makes the anti-abuse strong: a customer who pays
   * via recovery today doesn't know whether the next chance comes in 30 or
   * 60 days, so they can't time their next purchase to game the discount.
   */
  private pickNextEligibleAt(minDays: number, maxDays: number): string {
    const minMs = minDays * 24 * 60 * 60 * 1000;
    const maxMs = maxDays * 24 * 60 * 60 * 1000;
    const offset = minMs + Math.random() * (maxMs - minMs);
    return new Date(Date.now() + offset).toISOString();
  }

  // ---------------------------------------------------------------------------
  // Cron — runs every minute, checks pending orders
  // ---------------------------------------------------------------------------
  @Cron(CronExpression.EVERY_MINUTE)
  async processRecovery() {
    const settings = await this.getSettings();
    if (!settings.enabled) return;

    // maxAgeDays === 0 → sem limite superior: toda order pendente
    // (até de meses atrás) entra no funil. Default: 30 dias.
    const maxAgeMinutes = settings.maxAgeDays > 0
      ? settings.maxAgeDays * 24 * 60
      : 0;
    const pending = await this.ordersService.findPendingOrdersForRecovery(
      settings.delayMinutes,
      maxAgeMinutes,
    );

    for (const order of pending) {
      try {
        await this.tryRecoverOrder(order, settings);
      } catch (err: any) {
        this.logger.error(`Recovery failed for order ${order.id}: ${err.message}`);
      }
    }
  }

  private async tryRecoverOrder(
    order: any,
    settings: Awaited<ReturnType<PixRecoveryService['getSettings']>>,
  ) {
    // Skip if order already has cart-level discount
    if ((order.discount_percent || 0) > 0) {
      return;
    }

    // Skip if too many items
    if ((order.total_items || 0) > settings.maxItems) {
      return;
    }

    // Skip if user is still inside their randomized block window from a
    // previous offer. The window is per-user/chat and stored as
    // `next_eligible_at` on the most recent history row — see
    // pickNextEligibleAt() for why it's randomized.
    const identifier = order.user_id
      ? { column: 'user_id', value: order.user_id }
      : order.telegram_chat_id
      ? { column: 'telegram_chat_id', value: order.telegram_chat_id }
      : null;

    if (!identifier) {
      this.logger.debug(`Order ${order.id} has no user/chat identifier — skipping recovery`);
      return;
    }

    const nowIso = new Date().toISOString();
    const { data: blocking } = await this.supabase.client
      .from('pix_recovery_history')
      .select('id, next_eligible_at')
      .eq(identifier.column, identifier.value)
      .gt('next_eligible_at', nowIso)
      .order('next_eligible_at', { ascending: false })
      .limit(1);

    if (blocking && blocking.length) {
      this.logger.log(
        `User ${identifier.value} blocked until ${blocking[0].next_eligible_at} — skipping recovery for order ${order.id}`,
      );
      return;
    }

    // Check if a recovery already exists for this original order
    const { data: existingRecovery } = await this.supabase.client
      .from('orders')
      .select('id')
      .eq('original_order_id', order.id)
      .eq('is_recovery_order', true)
      .limit(1);

    if (existingRecovery && existingRecovery.length) {
      return;
    }

    // Create recovery order
    const recovery = await this.ordersService.createRecoveryOrder(
      order,
      settings.discountPercent,
    );

    if (!recovery) return;

    // Record in history with the randomized next-eligibility timestamp.
    // After today's offer the user is blocked at least `blockDaysMin` days
    // and at most `blockDaysMax` days — they can't predict which.
    const nextEligibleAt = this.pickNextEligibleAt(
      settings.blockDaysMin,
      settings.blockDaysMax,
    );

    await this.supabase.client.from('pix_recovery_history').insert({
      user_id: order.user_id || null,
      telegram_chat_id: order.telegram_chat_id || null,
      original_order_id: order.id,
      recovery_order_id: recovery.order.id,
      discount_percent: settings.discountPercent,
      next_eligible_at: nextEligibleAt,
    });

    // Notify user via bot
    await this.sendRecoveryNotification(order, recovery);

    this.logger.log(
      `Recovery offer sent for order ${order.id} → new order ${recovery.order.id}`,
    );
  }

  private async sendRecoveryNotification(originalOrder: any, recovery: any) {
    const chatIdRaw = originalOrder.telegram_chat_id;
    if (!chatIdRaw) {
      this.logger.warn(
        `Order ${originalOrder.id} has no telegram_chat_id — cannot send recovery offer`,
      );
      return;
    }
    if (!this.telegramsService) {
      this.logger.warn('TelegramsEnhancedService not available — skipping recovery notification');
      return;
    }

    const chatId = parseInt(chatIdRaw, 10);
    if (Number.isNaN(chatId)) {
      this.logger.warn(`Invalid telegram_chat_id "${chatIdRaw}" for recovery notification`);
      return;
    }

    const botUsername =
      this.configService.get<string>('TELEGRAM_BOT_USERNAME') || 'cinevisionv2bot';
    const recoveryDeepLink = `https://t.me/${botUsername}?start=order_${recovery.order.order_token}`;
    const totalFmt = (recovery.order.total_cents / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
    });
    const originalTotalFmt = (originalOrder.total_cents / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
    });

    const header =
      `🔥 *Oferta especial pra você!*\n\n` +
      `Vi que você não finalizou aquele pedido. Que tal um *${recovery.order.discount_percent}% de desconto* pra fechar agora?\n\n` +
      `~De R$ ${originalTotalFmt}~\n` +
      `Por *R$ ${totalFmt}* 🎯\n\n` +
      `É só clicar no botão abaixo, gerar o PIX novo e finalizar:`;

    try {
      await this.telegramsService.sendMessage(chatId, header, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '💳 Finalizar com desconto', url: recoveryDeepLink }]],
        },
      });

      // Cleanup any previous PIX/payment messages so this offer takes the spotlight
      await this.telegramsService.cleanupTrackedMessages(chatId).catch(() => undefined);

      // Fixed message per scope
      await this.telegramsService.sendMessage(
        chatId,
        'Digite /start para iniciar o bot novamente.',
      );
    } catch (err: any) {
      this.logger.warn(`Recovery notification failed for ${chatId}: ${err.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Admin-facing helpers
  // ---------------------------------------------------------------------------
  async listHistory(opts: {
    limit?: number;
    offset?: number;
    search?: string;
  } = {}): Promise<{ items: any[]; total: number }> {
    const limit = Math.min(Math.max(opts.limit || 30, 1), 100);
    const offset = Math.max(opts.offset || 0, 0);
    const search = (opts.search || '').trim();

    // Carrega o slice de history. Se tem busca, primeiro acha os user_ids
    // que casam com nome/email/telegram e filtra. Depois enriquece cada
    // linha com info do user pra exibir nome no painel (Igor pediu).
    let userIdFilter: string[] | null = null;
    if (search) {
      const { data: users } = await this.supabase.client
        .from('users')
        .select('id')
        .or(
          `name.ilike.%${search}%,email.ilike.%${search}%,telegram_username.ilike.%${search}%,telegram_id.eq.${search}`,
        )
        .limit(200);
      userIdFilter = (users || []).map((u: any) => u.id);
      if (userIdFilter.length === 0 && !/^\d+$/.test(search)) {
        return { items: [], total: 0 };
      }
    }

    let query = this.supabase.client
      .from('pix_recovery_history')
      .select('*', { count: 'exact' })
      .order('offered_at', { ascending: false });

    if (userIdFilter && userIdFilter.length) {
      // Match user_id OR (no user_id but telegram_chat_id == search) — por isso
      // a OR string mais elaborada.
      const idsCsv = userIdFilter.join(',');
      if (/^\d+$/.test(search)) {
        query = query.or(`user_id.in.(${idsCsv}),telegram_chat_id.eq.${search}`);
      } else {
        query = query.in('user_id', userIdFilter);
      }
    } else if (search && /^\d+$/.test(search)) {
      query = query.eq('telegram_chat_id', search);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) {
      this.logger.error('listHistory failed', error);
      return { items: [], total: 0 };
    }

    // Enriquece com user info pra mostrar nome no painel
    const ids = Array.from(new Set((data || []).map((r: any) => r.user_id).filter(Boolean)));
    const userMap = new Map<string, any>();
    if (ids.length) {
      const { data: users } = await this.supabase.client
        .from('users')
        .select('id, name, email, telegram_username, telegram_id')
        .in('id', ids);
      for (const u of users || []) userMap.set(u.id, u);
    }

    const items = (data || []).map((row: any) => ({
      ...row,
      user: row.user_id ? userMap.get(row.user_id) : null,
    }));

    return { items, total: count ?? items.length };
  }

  async getStats() {
    const { count: totalOffered } = await this.supabase.client
      .from('pix_recovery_history')
      .select('*', { count: 'exact', head: true });

    const { count: totalConverted } = await this.supabase.client
      .from('pix_recovery_history')
      .select('*', { count: 'exact', head: true })
      .eq('converted', true);

    const { data: revenueRows } = await this.supabase.client
      .from('pix_recovery_history')
      .select('recovery_order_id')
      .eq('converted', true);

    let revenueCents = 0;
    if (revenueRows && revenueRows.length) {
      const ids = revenueRows.map((r: any) => r.recovery_order_id).filter(Boolean);
      if (ids.length) {
        const { data: orders } = await this.supabase.client
          .from('orders')
          .select('total_cents')
          .in('id', ids);
        revenueCents = (orders || []).reduce(
          (acc: number, o: any) => acc + (o.total_cents || 0),
          0,
        );
      }
    }

    const rate = totalOffered ? (totalConverted || 0) / totalOffered : 0;

    return {
      totalOffered: totalOffered || 0,
      totalConverted: totalConverted || 0,
      conversionRate: rate,
      revenueCentsRecovered: revenueCents,
      settings: await this.getSettings(),
    };
  }
}
