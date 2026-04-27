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
    const [enabled, delay, discount, cooldown, maxItems] = await Promise.all([
      this.getSetting('pix_recovery_enabled'),
      this.getSetting('pix_recovery_delay_minutes'),
      this.getSetting('pix_recovery_discount_percent'),
      this.getSetting('pix_recovery_cooldown_hours'),
      this.getSetting('pix_recovery_max_items'),
    ]);
    return {
      enabled: (enabled ?? 'true').toLowerCase() === 'true',
      delayMinutes: parseInt(delay ?? '5', 10) || 5,
      discountPercent: parseFloat(discount ?? '10') || 10,
      cooldownHours: parseInt(cooldown ?? '48', 10) || 48,
      maxItems: parseInt(maxItems ?? '2', 10) || 2,
    };
  }

  async setSettings(input: {
    enabled?: boolean;
    delayMinutes?: number;
    discountPercent?: number;
    cooldownHours?: number;
    maxItems?: number;
  }) {
    const pairs: Array<[string, string]> = [];
    if (input.enabled !== undefined)
      pairs.push(['pix_recovery_enabled', String(input.enabled)]);
    if (input.delayMinutes !== undefined)
      pairs.push(['pix_recovery_delay_minutes', String(input.delayMinutes)]);
    if (input.discountPercent !== undefined)
      pairs.push(['pix_recovery_discount_percent', String(input.discountPercent)]);
    if (input.cooldownHours !== undefined)
      pairs.push(['pix_recovery_cooldown_hours', String(input.cooldownHours)]);
    if (input.maxItems !== undefined)
      pairs.push(['pix_recovery_max_items', String(input.maxItems)]);

    for (const [key, value] of pairs) {
      await this.supabase.client.from('admin_settings').upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Cron — runs every minute, checks pending orders
  // ---------------------------------------------------------------------------
  @Cron(CronExpression.EVERY_MINUTE)
  async processRecovery() {
    const settings = await this.getSettings();
    if (!settings.enabled) return;

    const pending = await this.ordersService.findPendingOrdersForRecovery(
      settings.delayMinutes,
      30,
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

    // Skip if user is in cooldown
    const cooldownSince = new Date(
      Date.now() - settings.cooldownHours * 60 * 60 * 1000,
    ).toISOString();

    const identifier = order.user_id
      ? { column: 'user_id', value: order.user_id }
      : order.telegram_chat_id
      ? { column: 'telegram_chat_id', value: order.telegram_chat_id }
      : null;

    if (!identifier) {
      this.logger.debug(`Order ${order.id} has no user/chat identifier — skipping recovery`);
      return;
    }

    const { data: recent } = await this.supabase.client
      .from('pix_recovery_history')
      .select('id')
      .eq(identifier.column, identifier.value)
      .gte('offered_at', cooldownSince)
      .limit(1);

    if (recent && recent.length) {
      this.logger.log(
        `User ${identifier.value} in cooldown — skipping recovery for order ${order.id}`,
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

    // Record in history
    await this.supabase.client.from('pix_recovery_history').insert({
      user_id: order.user_id || null,
      telegram_chat_id: order.telegram_chat_id || null,
      original_order_id: order.id,
      recovery_order_id: recovery.order.id,
      discount_percent: settings.discountPercent,
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
  async listHistory(limit = 100) {
    const { data, error } = await this.supabase.client
      .from('pix_recovery_history')
      .select('*')
      .order('offered_at', { ascending: false })
      .limit(limit);
    if (error) return [];
    return data || [];
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
