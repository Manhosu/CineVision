import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseService } from '../../config/supabase.service';
import { CartService } from '../cart/cart.service';
import { PixProviderFactory } from '../payments/providers/pix-provider.factory';
import {
  PurchaseStatus,
  PurchaseDeliveryType,
} from '../purchases/entities/purchase.entity';
import { OrderStatus } from './entities/order.entity';
import { TelegramsEnhancedService } from '../telegrams/telegrams-enhanced.service';

export interface CreateOrderFromCartInput {
  userId?: string;
  sessionId?: string;
  preferredDelivery?: PurchaseDeliveryType;
  telegramChatId?: string;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly supabase: SupabaseService,
    @Inject(forwardRef(() => CartService))
    private readonly cartService: CartService,
    private readonly pixProviderFactory: PixProviderFactory,
    private readonly configService: ConfigService,
    @Optional()
    @Inject(forwardRef(() => TelegramsEnhancedService))
    private readonly telegramsService?: TelegramsEnhancedService,
  ) {}

  // ---------------------------------------------------------------------------
  // Create an Order from the user's cart, then generate PIX payment.
  // ---------------------------------------------------------------------------
  async createOrderFromCart(input: CreateOrderFromCartInput) {
    const { userId, sessionId, preferredDelivery, telegramChatId } = input;

    const cartData = await this.cartService.getCartWithItems(userId, sessionId);
    const items = cartData.items as any[];

    if (!items.length) {
      throw new BadRequestException('Cart is empty');
    }

    const preview = cartData.preview;
    const delivery = preferredDelivery || PurchaseDeliveryType.TELEGRAM;

    // 1. Create Order
    const orderToken = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const { data: order, error: orderError } = await this.supabase.client
      .from('orders')
      .insert({
        user_id: userId || null,
        order_token: orderToken,
        subtotal_cents: preview.subtotal_cents,
        discount_percent: preview.discount_percent,
        discount_cents: preview.discount_cents,
        total_cents: preview.total_cents,
        total_items: preview.items_count,
        status: OrderStatus.PENDING,
        is_recovery_order: false,
        telegram_chat_id: telegramChatId || null,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (orderError || !order) {
      this.logger.error('Failed to create order', orderError);
      throw new BadRequestException(`Failed to create order: ${orderError?.message}`);
    }

    // 2. Create one Purchase per item, linked to the order
    const perItemShare = preview.discount_percent / 100;
    const purchases: any[] = [];

    for (const item of items) {
      const itemPrice = item.price_cents_snapshot;
      const itemDiscounted = Math.round(itemPrice * (1 - perItemShare));

      const purchaseToken = uuidv4();
      const { data: purchase, error: purchaseError } = await this.supabase.client
        .from('purchases')
        .insert({
          user_id: userId || null,
          content_id: item.content_id,
          amount_cents: itemDiscounted,
          currency: 'BRL',
          status: PurchaseStatus.PENDING,
          preferred_delivery: delivery,
          purchase_token: purchaseToken,
          order_id: order.id,
          provider_meta: telegramChatId
            ? { telegram_chat_id: telegramChatId, from_cart: true }
            : { from_cart: true },
        })
        .select()
        .single();

      if (purchaseError) {
        this.logger.warn(
          `Failed to create purchase for content ${item.content_id}: ${purchaseError.message}`,
        );
        continue;
      }
      purchases.push(purchase);
    }

    if (!purchases.length) {
      throw new BadRequestException('Could not create purchases for order');
    }

    // 3. Generate PIX for the full order amount (best-effort: order survives even if PIX fails)
    let pixResult: any = null;
    let pixError: string | null = null;
    try {
      pixResult = await this.generatePixForOrder(order, userId, telegramChatId);
    } catch (err: any) {
      pixError = err?.response?.data?.message || err.message || 'Failed to generate PIX';
      this.logger.error(`Order ${order.id} created but PIX generation failed: ${pixError}`);
    }

    return {
      order: { ...order, payment: pixResult?.paymentRecord ?? null },
      purchases,
      pix: pixResult
        ? {
            qrCode: pixResult.qrCode,
            qrCodeBase64: pixResult.qrCodeBase64,
            expiresAt: pixResult.expiresAt,
            providerPaymentId: pixResult.providerPaymentId,
          }
        : null,
      pix_error: pixError,
      preview,
      items,
    };
  }

  // ---------------------------------------------------------------------------
  // Generate PIX for an order (used for initial checkout AND recovery orders)
  // ---------------------------------------------------------------------------
  async generatePixForOrder(order: any, userId?: string, telegramChatId?: string) {
    const pixProvider = this.pixProviderFactory.getProvider();

    // Pick a representative purchase to satisfy payments.purchase_id NOT NULL constraint
    const { data: anyPurchase } = await this.supabase.client
      .from('purchases')
      .select('id')
      .eq('order_id', order.id)
      .limit(1)
      .maybeSingle();
    const linkedPurchaseId = anyPurchase?.id || null;

    const description = `Cine Vision - Pedido #${order.order_token.slice(0, 8)} (${order.total_items} ${order.total_items === 1 ? 'item' : 'itens'})`;

    let email: string | undefined;
    if (userId) {
      const { data: user } = await this.supabase.client
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();
      email = user?.email;
    }

    const pixResult = await pixProvider.createPixPayment({
      // PixProvider expects amount in cents — providers convert to BRL internally.
      amount: order.total_cents,
      description,
      email,
      externalId: order.order_token,
      metadata: {
        order_id: order.id,
        order_token: order.order_token,
        user_id: userId || 'guest',
        telegram_chat_id: telegramChatId || '',
        payment_type: 'order',
      },
    });

    // Persist payment record
    const { data: paymentRecord, error: paymentError } = await this.supabase.client
      .from('payments')
      .insert({
        purchase_id: linkedPurchaseId,
        provider_payment_id: pixResult.paymentId,
        provider: pixProvider.getProviderName(),
        status: 'pending',
        amount_cents: order.total_cents,
        currency: 'BRL',
        payment_method: 'pix',
        provider_meta: {
          order_id: order.id,
          order_token: order.order_token,
          payment_type: 'order',
          qr_code: pixResult.qrCode,
          qr_code_base64: pixResult.qrCodeBase64,
          expires_at: pixResult.expiresAt?.toISOString(),
        },
      })
      .select()
      .single();

    if (paymentError) {
      this.logger.error('Failed to insert payment record', paymentError);
    } else {
      await this.supabase.client
        .from('orders')
        .update({ payment_id: paymentRecord.id })
        .eq('id', order.id);
    }

    return {
      paymentRecord,
      providerPaymentId: pixResult.paymentId,
      qrCode: pixResult.qrCode,
      qrCodeBase64: pixResult.qrCodeBase64,
      expiresAt: pixResult.expiresAt,
    };
  }

  // ---------------------------------------------------------------------------
  // Mark order as paid (called by webhook handlers)
  // ---------------------------------------------------------------------------
  async markOrderPaid(orderId: string): Promise<any> {
    const { data: order, error } = await this.supabase.client
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.status === OrderStatus.PAID) {
      this.logger.log(`Order ${orderId} already paid — skipping`);
      return order;
    }

    // Update order
    const { error: updErr } = await this.supabase.client
      .from('orders')
      .update({
        status: OrderStatus.PAID,
        paid_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updErr) {
      this.logger.error('Failed to update order status', updErr);
    }

    // Mark all related purchases as paid
    const { data: purchases } = await this.supabase.client
      .from('purchases')
      .select('*, content(*)')
      .eq('order_id', orderId);

    for (const p of purchases || []) {
      const { error: pUpdErr } = await this.supabase.client
        .from('purchases')
        .update({ status: PurchaseStatus.PAID })
        .eq('id', p.id);
      if (pUpdErr) {
        this.logger.error(`Failed to mark purchase ${p.id} as paid: ${pUpdErr.message}`);
      }

      // Increment weekly_sales (best-effort, fallback to manual update if RPC missing)
      try {
        const { error: rpcErr } = await this.supabase.client.rpc('increment_weekly_sales', {
          p_content_id: p.content_id,
        });
        if (rpcErr) throw rpcErr;
      } catch {
        const { data: cRow } = await this.supabase.client
          .from('content')
          .select('weekly_sales, total_sales')
          .eq('id', p.content_id)
          .single();
        if (cRow) {
          await this.supabase.client
            .from('content')
            .update({
              weekly_sales: (cRow.weekly_sales || 0) + 1,
              total_sales: (cRow.total_sales || 0) + 1,
            })
            .eq('id', p.content_id);
        }
      }
    }

    // If this order is a recovery order, mark the original as substituted
    if (order.original_order_id) {
      await this.supabase.client
        .from('orders')
        .update({ status: OrderStatus.CANCELLED })
        .eq('id', order.original_order_id);

      // Mark pix_recovery_history as converted
      await this.supabase.client
        .from('pix_recovery_history')
        .update({ converted: true, converted_at: new Date().toISOString() })
        .eq('recovery_order_id', orderId);
    }

    // Cancel any recovery order for this same original order (if someone paid original first)
    await this.supabase.client
      .from('orders')
      .update({ status: OrderStatus.CANCELLED })
      .eq('original_order_id', orderId)
      .eq('status', OrderStatus.PENDING);

    // Notify bot to deliver content
    await this.notifyBotForDelivery(order.id, order.telegram_chat_id);

    return order;
  }

  // ---------------------------------------------------------------------------
  // Fetch order by token (for bot / frontend)
  // ---------------------------------------------------------------------------
  async findByToken(token: string) {
    const { data: order, error } = await this.supabase.client
      .from('orders')
      .select('*')
      .eq('order_token', token)
      .single();

    if (error || !order) return null;

    const { data: purchases } = await this.supabase.client
      .from('purchases')
      .select('*, content(*)')
      .eq('order_id', order.id);

    let payment: any = null;
    if (order.payment_id) {
      const { data } = await this.supabase.client
        .from('payments')
        .select('*')
        .eq('id', order.payment_id)
        .single();
      payment = data;
    }

    return { ...order, purchases: purchases || [], payment };
  }

  async findByUser(userId: string) {
    const { data, error } = await this.supabase.client
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return [];
    return data || [];
  }

  // ---------------------------------------------------------------------------
  // Lookup by provider_payment_id (for webhook processing)
  // ---------------------------------------------------------------------------
  async findOrderByProviderPaymentId(providerPaymentId: string) {
    const { data: payment } = await this.supabase.client
      .from('payments')
      .select('*')
      .eq('provider_payment_id', providerPaymentId)
      .single();

    if (!payment?.provider_meta?.order_id) return null;

    const { data: order } = await this.supabase.client
      .from('orders')
      .select('*')
      .eq('id', payment.provider_meta.order_id)
      .single();

    return order || null;
  }

  // ---------------------------------------------------------------------------
  // Lookup recent pending orders for PIX recovery
  // ---------------------------------------------------------------------------
  async findPendingOrdersForRecovery(
    delayMinutes: number,
    maxAgeMinutes = 30,
  ): Promise<any[]> {
    const now = Date.now();
    const minCreatedAt = new Date(now - maxAgeMinutes * 60 * 1000).toISOString();
    const maxCreatedAt = new Date(now - delayMinutes * 60 * 1000).toISOString();

    const { data, error } = await this.supabase.client
      .from('orders')
      .select('*')
      .eq('status', OrderStatus.PENDING)
      .eq('is_recovery_order', false)
      .gte('created_at', minCreatedAt)
      .lte('created_at', maxCreatedAt)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      this.logger.error('Failed to query pending orders for recovery', error);
      return [];
    }

    return data || [];
  }

  async createRecoveryOrder(
    originalOrder: any,
    discountPercent: number,
  ): Promise<any> {
    const { data: originalPurchases } = await this.supabase.client
      .from('purchases')
      .select('*, content(*)')
      .eq('order_id', originalOrder.id);

    if (!originalPurchases?.length) {
      // Maybe single purchase (legacy) — try matching by token
      return null;
    }

    const subtotal = originalPurchases.reduce(
      (acc: number, p: any) => acc + (p.amount_cents || 0),
      0,
    );
    const discountCents = Math.round(subtotal * (discountPercent / 100));
    const total = Math.max(0, subtotal - discountCents);

    const recoveryToken = uuidv4();
    const { data: recoveryOrder, error: roErr } = await this.supabase.client
      .from('orders')
      .insert({
        user_id: originalOrder.user_id,
        order_token: recoveryToken,
        subtotal_cents: subtotal,
        discount_percent: discountPercent,
        discount_cents: discountCents,
        total_cents: total,
        total_items: originalOrder.total_items,
        status: OrderStatus.PENDING,
        is_recovery_order: true,
        original_order_id: originalOrder.id,
        telegram_chat_id: originalOrder.telegram_chat_id,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (roErr || !recoveryOrder) {
      this.logger.error('Failed to create recovery order', roErr);
      return null;
    }

    // Clone purchases for the recovery order
    for (const op of originalPurchases) {
      const perItem = Math.round(op.amount_cents * (1 - discountPercent / 100));
      await this.supabase.client.from('purchases').insert({
        user_id: op.user_id,
        content_id: op.content_id,
        amount_cents: perItem,
        currency: op.currency || 'BRL',
        status: PurchaseStatus.PENDING,
        preferred_delivery: op.preferred_delivery,
        purchase_token: uuidv4(),
        order_id: recoveryOrder.id,
        provider_meta: {
          ...op.provider_meta,
          recovery: true,
          original_purchase_id: op.id,
        },
      });
    }

    let pix: any = null;
    try {
      pix = await this.generatePixForOrder(
        recoveryOrder,
        originalOrder.user_id,
        originalOrder.telegram_chat_id,
      );
    } catch (err: any) {
      this.logger.error(
        `Recovery order ${recoveryOrder.id} created but PIX failed: ${err.message}`,
      );
    }

    return { order: recoveryOrder, pix };
  }

  // ---------------------------------------------------------------------------
  // Deliver order content to Telegram chat (direct via TelegramsEnhancedService)
  // ---------------------------------------------------------------------------
  private async notifyBotForDelivery(orderId: string, telegramChatId?: string) {
    if (!telegramChatId) {
      this.logger.warn(`Order ${orderId} has no telegram_chat_id — skipping delivery`);
      return;
    }
    if (!this.telegramsService) {
      this.logger.warn('TelegramsEnhancedService not available — skipping delivery');
      return;
    }

    const chatId = parseInt(telegramChatId, 10);
    if (Number.isNaN(chatId)) {
      this.logger.warn(`Invalid telegram_chat_id "${telegramChatId}"`);
      return;
    }

    // Fetch purchases with their content (so we have telegram_group_link)
    const { data: purchases } = await this.supabase.client
      .from('purchases')
      .select('id, content_id, content:content(id, title, telegram_group_link)')
      .eq('order_id', orderId);

    if (!purchases?.length) {
      this.logger.warn(`No purchases found for order ${orderId} delivery`);
      return;
    }

    try {
      const totalItems = purchases.length;
      const header =
        `✅ *Pagamento confirmado!*\n\n` +
        `Você adquiriu ${totalItems} ${totalItems === 1 ? 'conteúdo' : 'conteúdos'}. ` +
        `Os links pra assistir estão abaixo:\n`;
      await this.telegramsService.sendMessage(chatId, header, { parse_mode: 'Markdown' });

      const inlineButtons: Array<Array<{ text: string; url: string }>> = [];
      for (const p of purchases) {
        const content: any = Array.isArray(p.content) ? p.content[0] : p.content;
        if (!content) continue;
        const title = content.title || 'Conteúdo';
        const link = content.telegram_group_link;
        if (link) {
          inlineButtons.push([{ text: `🎬 ${title}`, url: link }]);
        } else {
          await this.telegramsService.sendMessage(
            chatId,
            `⚠️ *${title}*: link pendente, o suporte vai te enviar manualmente.`,
            { parse_mode: 'Markdown' },
          );
        }
      }

      if (inlineButtons.length) {
        await this.telegramsService.sendMessage(
          chatId,
          'Clique nos botões abaixo:',
          { reply_markup: { inline_keyboard: inlineButtons } },
        );
      }

      // Final fixed message (per scope)
      await this.telegramsService.sendMessage(
        chatId,
        'Digite /start para iniciar o bot novamente.',
      );
    } catch (err: any) {
      this.logger.error(`Delivery for order ${orderId} failed: ${err.message}`);
    }
  }
}
