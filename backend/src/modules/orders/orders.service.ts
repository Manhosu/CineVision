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
import { pickWhatsappTemplate } from './whatsapp-templates';

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

    // Se o cart foi iniciado a partir de um link da IA via Business DM
    // (cliente clicou em /movies/UUID?via=business&bid=BCID), o cart
    // tem o business_connection_id persistido. Propaga pra order pra
    // que markOrderPaid → notifyBotForDelivery despache via canal
    // Business em vez do bot direto.
    const businessConnectionId =
      (cartData.cart as any)?.business_connection_id || null;

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
        business_connection_id: businessConnectionId,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (orderError || !order) {
      this.logger.error('Failed to create order', orderError);
      throw new BadRequestException(`Failed to create order: ${orderError?.message}`);
    }

    // Igor (04/06): pré-carrega flags de pré-venda dos contents pra marcar
    // is_presale_purchase nas purchases que entrarem. Quando admin clicar
    // "Liberar pré-venda" depois, a query usa esse flag pra achar todo
    // mundo que comprou no período de pré-venda.
    const contentIds = Array.from(new Set(items.map((it: any) => it.content_id)));
    const presaleFlagByContent = new Map<string, boolean>();
    if (contentIds.length) {
      const { data: presaleRows } = await this.supabase.client
        .from('content')
        .select('id, is_presale')
        .in('id', contentIds);
      for (const row of presaleRows || []) {
        presaleFlagByContent.set(row.id, !!row.is_presale);
      }
    }

    // M10 — antes era um INSERT sequencial por item (cart com 5 filmes
    // = 5 round-trips ao banco), o que dominava a latência do checkout
    // (Igor reportou 1.5–8s). Agora 1 INSERT em batch.
    const perItemShare = preview.discount_percent / 100;
    const purchasePayloads = items.map((item: any) => {
      const itemDiscounted = Math.round(
        item.price_cents_snapshot * (1 - perItemShare),
      );
      return {
        user_id: userId || null,
        content_id: item.content_id,
        amount_cents: itemDiscounted,
        currency: 'BRL',
        status: PurchaseStatus.PENDING,
        preferred_delivery: delivery,
        purchase_token: uuidv4(),
        order_id: order.id,
        is_presale_purchase: presaleFlagByContent.get(item.content_id) === true,
        provider_meta: telegramChatId
          ? { telegram_chat_id: telegramChatId, from_cart: true }
          : { from_cart: true },
      };
    });

    const { data: purchases, error: purchasesError } = await this.supabase.client
      .from('purchases')
      .insert(purchasePayloads)
      .select();

    if (purchasesError) {
      this.logger.error(
        `Failed to batch-insert purchases for order ${order.id}: ${purchasesError.message}`,
      );
      throw new BadRequestException(
        `Could not create purchases for order: ${purchasesError.message}`,
      );
    }

    if (!purchases?.length) {
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
    // Igor (25/06): também marca pix_recovery_history como convertida nesse
    // caso — cliente ignorou o desconto da oferta mas pagou a original DEPOIS
    // de receber o lembrete. Isso conta como conversão pelo lembrete também.
    // Antes só convertia se pagasse a recovery (com desconto), o que dava 0
    // conversões em 276 ofertas porque 99% paga a original mesmo.
    const { data: recoveryOrdersForOriginal } = await this.supabase.client
      .from('orders')
      .select('id')
      .eq('original_order_id', orderId);
    await this.supabase.client
      .from('orders')
      .update({ status: OrderStatus.CANCELLED })
      .eq('original_order_id', orderId)
      .eq('status', OrderStatus.PENDING);
    const recoveryOrderIds = (recoveryOrdersForOriginal || []).map((r: any) => r.id);
    if (recoveryOrderIds.length > 0) {
      await this.supabase.client
        .from('pix_recovery_history')
        .update({ converted: true, converted_at: new Date().toISOString() })
        .in('recovery_order_id', recoveryOrderIds)
        .or('converted.is.null,converted.eq.false');
    }

    // Empty the cart for this user/session so returning to /cart
    // doesn't show items they just paid for. Best-effort: a failure
    // here mustn't block payment confirmation.
    try {
      if (order.user_id) {
        await this.cartService.clearCart(order.user_id, undefined);
      }
    } catch (err: any) {
      this.logger.warn(`Failed to clear cart for paid order ${orderId}: ${err.message}`);
    }

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

  // ---------------------------------------------------------------------------
  // Salva o WhatsApp de contato numa order (chamado pela tela de
  // sucesso quando a order é órfã). Sanitiza pra dígitos só, pra
  // facilitar o link wa.me do painel.
  // ---------------------------------------------------------------------------
  async setCustomerWhatsapp(token: string, rawWhatsapp: string): Promise<{ ok: boolean }> {
    const digits = (rawWhatsapp || '').replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) {
      throw new BadRequestException('WhatsApp inválido');
    }
    // Adiciona código do Brasil se não estiver presente (assume BR
    // como padrão — Igor opera 100% no Brasil). 10/11 dígitos = local;
    // 12/13 = já tem 55.
    const normalized = digits.length <= 11 ? `55${digits}` : digits;
    const { error } = await this.supabase.client
      .from('orders')
      .update({ customer_whatsapp: normalized })
      .eq('order_token', token);
    if (error) {
      this.logger.error(`setCustomerWhatsapp failed for ${token}: ${error.message}`);
      throw new BadRequestException('Não foi possível salvar o WhatsApp');
    }
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Lista orders pagas órfãs (sem telegram_chat_id). Usada pelo admin
  // pra recuperar compras de clientes que pagaram via web sem login.
  // ---------------------------------------------------------------------------
  async listOrphanOrders(limit = 100): Promise<any[]> {
    const { data, error } = await this.supabase.client
      .from('orders')
      .select('id, order_token, total_cents, total_items, paid_at, created_at, user_id, customer_whatsapp, telegram_chat_id')
      .eq('status', OrderStatus.PAID)
      .is('telegram_chat_id', null)
      .is('dismissed_at', null)
      .order('paid_at', { ascending: false })
      .limit(limit);
    if (error) {
      this.logger.error('listOrphanOrders failed', error);
      return [];
    }

    if (!data?.length) return [];

    const orderIds = data.map((o: any) => o.id);
    const { data: purchases } = await this.supabase.client
      .from('purchases')
      .select('order_id, content:content(title, poster_url)')
      .in('order_id', orderIds);

    const purchasesByOrder = new Map<string, any[]>();
    for (const p of purchases || []) {
      const list = purchasesByOrder.get(p.order_id) || [];
      list.push(p);
      purchasesByOrder.set(p.order_id, list);
    }

    // Igor (25/06): URL rotativa via backend /r/order. Cada clique sorteia
    // bot ativo (round-robin no telegram_bots). Bot novo entra na fila
    // automaticamente sem mudança de código.
    const backendUrl =
      this.configService.get<string>('BACKEND_URL') ||
      this.configService.get<string>('API_URL') ||
      'https://cinevisionn.onrender.com';

    return data.map((o: any) => {
      const items = (purchasesByOrder.get(o.id) || [])
        .map((p: any) => {
          const c = Array.isArray(p.content) ? p.content[0] : p.content;
          return c?.title;
        })
        .filter(Boolean);
      // Igor (25/06): URL rotativa do backend. Cada CLIQUE redireciona pra
      // um bot diferente (round-robin via /r/order). Antes apontava direto
      // pra t.me/<bot fixo> e todos os links da lista iam pro mesmo bot.
      const claimUrl = `${backendUrl}/api/v1/telegrams/r/order?token=${o.order_token}`;
      return {
        ...o,
        items,
        claim_url: claimUrl,
        whatsapp_url: o.customer_whatsapp
          ? `https://wa.me/${o.customer_whatsapp}?text=${encodeURIComponent(
              pickWhatsappTemplate(o.id, o.total_cents, claimUrl),
            )}`
          : null,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Orders pagas mas com pelo menos uma purchase NÃO entregue. Igor pediu
  // (vídeo IMG_8794): clientes pagam, recebem o telegram_chat_id no claim
  // ou direto no bot, mas o bot falha em entregar (provider down, race no
  // webhook, link de grupo expirou). Essas compras SOMEM da tab de
  // "órfãs" porque elas têm telegram_chat_id; precisam de um lugar pra o
  // admin ver e reenviar.
  //
  // Distinção:
  //  - Órfãs: paid + telegram_chat_id IS NULL (cliente nunca abriu o bot).
  //  - Pagas não entregues: paid + chat_id preenchido + AO MENOS UMA
  //    purchase com delivery_sent=false.
  // ---------------------------------------------------------------------------
  async listUndeliveredOrders(limit = 100): Promise<any[]> {
    const { data: orders, error } = await this.supabase.client
      .from('orders')
      .select('id, order_token, total_cents, total_items, paid_at, created_at, user_id, customer_whatsapp, telegram_chat_id')
      .eq('status', OrderStatus.PAID)
      .not('telegram_chat_id', 'is', null)
      .is('dismissed_at', null)
      .order('paid_at', { ascending: false })
      .limit(limit);
    if (error) {
      this.logger.error('listUndeliveredOrders failed', error);
      return [];
    }
    if (!orders?.length) return [];

    const orderIds = orders.map((o: any) => o.id);
    const { data: purchases } = await this.supabase.client
      .from('purchases')
      .select('id, order_id, delivery_sent, content:content(title, poster_url)')
      .in('order_id', orderIds);

    // Agrupa por order_id e filtra: só order que tem ao menos 1 purchase
    // com delivery_sent=false.
    const byOrder = new Map<string, any[]>();
    for (const p of purchases || []) {
      const list = byOrder.get(p.order_id) || [];
      list.push(p);
      byOrder.set(p.order_id, list);
    }

    const undelivered = orders.filter((o: any) => {
      const list = byOrder.get(o.id) || [];
      return list.some((p: any) => !p.delivery_sent);
    });

    const backendUrl =
      this.configService.get<string>('BACKEND_URL') ||
      this.configService.get<string>('API_URL') ||
      'https://cinevisionn.onrender.com';

    return undelivered.map((o: any) => {
      const list = byOrder.get(o.id) || [];
      const items = list
        .map((p: any) => {
          const c = Array.isArray(p.content) ? p.content[0] : p.content;
          return c?.title;
        })
        .filter(Boolean);
      const undeliveredCount = list.filter((p: any) => !p.delivery_sent).length;
      // Igor (25/06): URL rotativa do backend. Cada CLIQUE redireciona pra
      // um bot diferente (round-robin via /r/order). Antes apontava direto
      // pra t.me/<bot fixo> e todos os links da lista iam pro mesmo bot.
      const claimUrl = `${backendUrl}/api/v1/telegrams/r/order?token=${o.order_token}`;
      return {
        ...o,
        items,
        purchases_total: list.length,
        purchases_undelivered: undeliveredCount,
        claim_url: claimUrl,
        whatsapp_url: o.customer_whatsapp
          ? `https://wa.me/${o.customer_whatsapp}?text=${encodeURIComponent(
              pickWhatsappTemplate(o.id, o.total_cents, claimUrl),
            )}`
          : null,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Marca a order como dispensada do painel admin (não exclui — preserva
  // histórico financeiro). Usada quando o admin identifica que a compra
  // está perdida (cliente sumiu, dado errado, etc.) e não quer ela
  // poluindo a lista de pendências reais.
  // ---------------------------------------------------------------------------
  async dismissOrder(orderId: string): Promise<{ dismissed: boolean }> {
    const { error } = await this.supabase.client
      .from('orders')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', orderId);
    if (error) {
      this.logger.error(`dismissOrder failed for ${orderId}`, error);
      throw new BadRequestException('Falha ao dispensar order');
    }
    return { dismissed: true };
  }

  // ---------------------------------------------------------------------------
  // Igor (01/06): aba "Arquivados" em /admin/orphan-orders. Hoje quando ele
  // arquiva uma compra (dismiss), perde o claim_url/whatsapp_url e não tem
  // como reenviar se o cliente reaparece. Esse método lista todas as orders
  // arquivadas (independentemente de órfã ou undelivered) pra ele poder
  // recuperar o link e mandar manual.
  // ---------------------------------------------------------------------------
  async listDismissedOrders(limit = 100): Promise<any[]> {
    const { data, error } = await this.supabase.client
      .from('orders')
      .select('id, order_token, total_cents, total_items, paid_at, created_at, dismissed_at, user_id, customer_whatsapp, telegram_chat_id')
      .eq('status', OrderStatus.PAID)
      .not('dismissed_at', 'is', null)
      .order('dismissed_at', { ascending: false })
      .limit(limit);
    if (error) {
      this.logger.error('listDismissedOrders failed', error);
      return [];
    }

    if (!data?.length) return [];

    const orderIds = data.map((o: any) => o.id);
    const { data: purchases } = await this.supabase.client
      .from('purchases')
      .select('order_id, content:content(title, poster_url)')
      .in('order_id', orderIds);

    const purchasesByOrder = new Map<string, any[]>();
    for (const p of purchases || []) {
      const list = purchasesByOrder.get(p.order_id) || [];
      list.push(p);
      purchasesByOrder.set(p.order_id, list);
    }

    // Igor (25/06): URL rotativa via backend /r/order. Cada clique sorteia
    // bot ativo (round-robin no telegram_bots). Bot novo entra na fila
    // automaticamente sem mudança de código.
    const backendUrl =
      this.configService.get<string>('BACKEND_URL') ||
      this.configService.get<string>('API_URL') ||
      'https://cinevisionn.onrender.com';

    return data.map((o: any) => {
      const items = (purchasesByOrder.get(o.id) || [])
        .map((p: any) => {
          const c = Array.isArray(p.content) ? p.content[0] : p.content;
          return c?.title;
        })
        .filter(Boolean);
      // Igor (25/06): URL rotativa do backend. Cada CLIQUE redireciona pra
      // um bot diferente (round-robin via /r/order). Antes apontava direto
      // pra t.me/<bot fixo> e todos os links da lista iam pro mesmo bot.
      const claimUrl = `${backendUrl}/api/v1/telegrams/r/order?token=${o.order_token}`;
      return {
        ...o,
        items,
        claim_url: claimUrl,
        whatsapp_url: o.customer_whatsapp
          ? `https://wa.me/${o.customer_whatsapp}?text=${encodeURIComponent(
              pickWhatsappTemplate(o.id, o.total_cents, claimUrl),
            )}`
          : null,
      };
    });
  }

  // Reverte um dismiss — volta a compra pra lista ativa (Órfãs ou
  // Pagas não entregues, dependendo do estado dela).
  async undismissOrder(orderId: string): Promise<{ undismissed: boolean }> {
    const { error } = await this.supabase.client
      .from('orders')
      .update({ dismissed_at: null })
      .eq('id', orderId);
    if (error) {
      this.logger.error(`undismissOrder failed for ${orderId}`, error);
      throw new BadRequestException('Falha ao desarquivar order');
    }
    return { undismissed: true };
  }

  // ---------------------------------------------------------------------------
  // Re-dispara entrega de uma order paga. Usada pelo painel admin quando
  // delivery_sent ficou false (provider down, link expirou, etc.).
  // Só funciona se a order tem telegram_chat_id; senão, retornar erro
  // pra o admin saber que precisa do claim do cliente primeiro.
  // ---------------------------------------------------------------------------
  async redeliverOrder(orderId: string): Promise<{ redelivered: boolean; reason?: string }> {
    const { data: order } = await this.supabase.client
      .from('orders')
      .select('id, status, telegram_chat_id')
      .eq('id', orderId)
      .maybeSingle();

    if (!order) {
      throw new NotFoundException('Order não encontrada');
    }
    if (order.status !== OrderStatus.PAID) {
      return { redelivered: false, reason: 'order_not_paid' };
    }
    if (!order.telegram_chat_id) {
      return { redelivered: false, reason: 'no_telegram_chat_id' };
    }

    await this.notifyBotForDelivery(order.id, order.telegram_chat_id);
    return { redelivered: true };
  }

  /**
   * Igor (14/06): transfere entrega pra outro chat. Quando admin clicou
   * no deeplink de outro cliente por engano e o chat cruzou, esse método
   * reseta o vínculo. Se `clearOnly=true`, só libera (pra cliente real
   * clicar de novo no link). Se vier `telegramChatId`, troca pra esse chat
   * e dispara entrega.
   */
  async transferDelivery(
    orderId: string,
    telegramChatId?: string,
    clearOnly?: boolean,
  ): Promise<{ ok: boolean; delivered?: boolean; reason?: string }> {
    const { data: order } = await this.supabase.client
      .from('orders')
      .select('id, status, telegram_chat_id, user_id')
      .eq('id', orderId)
      .maybeSingle();

    if (!order) throw new NotFoundException('Order não encontrada');
    if (order.status !== OrderStatus.PAID) return { ok: false, reason: 'order_not_paid' };

    if (clearOnly || !telegramChatId) {
      await this.supabase.client
        .from('orders')
        .update({
          telegram_chat_id: null,
          user_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);
      await this.supabase.client
        .from('purchases')
        .update({ delivery_sent: false })
        .eq('order_id', orderId);
      this.logger.log(`[transfer] order ${orderId} cleared (cliente pode resgatar via link novamente)`);
      return { ok: true, delivered: false };
    }

    const newChatId = String(telegramChatId).trim();
    if (!/^-?\d{6,}$/.test(newChatId)) {
      return { ok: false, reason: 'invalid_chat_id' };
    }

    // Busca user com esse telegram_chat_id (se existir).
    const { data: targetUser } = await this.supabase.client
      .from('users')
      .select('id, role')
      .eq('telegram_chat_id', newChatId)
      .maybeSingle();

    // Bloqueia transferência pra admin (não vamos repetir o erro).
    if (targetUser?.role && ['admin', 'employee', 'master'].includes(targetUser.role)) {
      return { ok: false, reason: 'target_is_admin' };
    }

    await this.supabase.client
      .from('orders')
      .update({
        telegram_chat_id: newChatId,
        user_id: targetUser?.id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);
    await this.supabase.client
      .from('purchases')
      .update({ delivery_sent: false, user_id: targetUser?.id || null })
      .eq('order_id', orderId);

    this.logger.log(`[transfer] order ${orderId} → chat ${newChatId}`);
    await this.notifyBotForDelivery(orderId, newChatId);
    return { ok: true, delivered: true };
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
  // Claim an orphan paid order (web checkout sem login → bot deep link).
  // Caso da Yanna: ela pagou via web, sem ter feito login. A order ficou
  // com user_id=null e telegram_chat_id=null, então /minha-lista não
  // mostra e o bot não entrega. Quando ela clica
  // t.me/CineVisionApp_rbot?start=order_TOKEN, este método é chamado:
  //   1. Linka order.telegram_chat_id ao chat dela
  //   2. Garante user_id (procura por telegram_id; cria temp se não existir)
  //   3. Atribui purchases.user_id pra que /minha-lista funcione daqui pra frente
  //   4. Dispara entrega normal (notifyBotForDelivery)
  // ---------------------------------------------------------------------------
  async claimOrphanOrder(
    orderToken: string,
    telegramChatId: string,
    userId?: string,
  ): Promise<{ claimed: boolean; alreadyLinked?: boolean; reason?: string }> {
    const { data: order } = await this.supabase.client
      .from('orders')
      .select('*')
      .eq('order_token', orderToken)
      .maybeSingle();

    if (!order) {
      return { claimed: false, reason: 'order_not_found' };
    }

    if (order.status !== OrderStatus.PAID) {
      return { claimed: false, reason: 'order_not_paid' };
    }

    // Igor (14/06): bloqueio anti-cross-claim. Sem isso, o chat que clicar
    // PRIMEIRO no `?start=order_TOKEN` ficava como dono da entrega — admin
    // testando o link de outro cliente vinculava o pedido ao Telegram dele
    // sem querer. Aconteceu 15+ vezes: chats 1134910998 e 8003506238 (do
    // Igor) ficaram com pedidos cruzados de 3 clientes distintos.
    //
    // Regra 1: se quem está clamando é admin/employee/master → bloqueia.
    //          Admin tem que usar painel pra entregar manual.
    // Regra 2: se o chat já resgatou 3+ pedidos nas últimas 24h → bloqueia.
    //          Cliente legítimo raramente compra 3 pedidos separados num
    //          dia; isso é sinal de admin testando ou abuso.
    if (!order.telegram_chat_id) {
      const { data: claimerUser } = await this.supabase.client
        .from('users')
        .select('id, role')
        .eq('telegram_chat_id', telegramChatId)
        .maybeSingle();

      if (claimerUser?.role && ['admin', 'employee', 'master'].includes(claimerUser.role)) {
        this.logger.warn(
          `[claim-block] role=${claimerUser.role} chat=${telegramChatId} tentou resgatar order ${order.id} (token=${orderToken}). Bloqueado.`,
        );
        return { claimed: false, reason: 'admin_chat_blocked' };
      }

      const { count: recentClaims } = await this.supabase.client
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('telegram_chat_id', telegramChatId)
        .gte('updated_at', new Date(Date.now() - 24 * 3600_000).toISOString());

      if ((recentClaims || 0) >= 3) {
        this.logger.warn(
          `[claim-block] chat=${telegramChatId} já resgatou ${recentClaims} pedidos nas últimas 24h. Bloqueado em order ${order.id}.`,
        );
        return { claimed: false, reason: 'too_many_recent_claims' };
      }
    }

    // Resgate único: se a order já tem telegram_chat_id, só
    // aceita uma "re-entrega" se for o MESMO chat reabrindo o
    // link. Outro chat tentando resgatar é tratado como tentativa
    // duplicada — não dispara entrega nem sobrescreve o vínculo.
    //
    // Antes da correção, a verificação só rejeitava se chat_id E
    // user_id estavam preenchidos. Como cliente sem login fica com
    // user_id=null, um segundo clique de outra conta passava: a
    // entrega era reenviada ao chat original e o bot do segundo
    // usuário recebia `claimed: true`, induzindo a achar que tinha
    // resgatado. Agora a regra é: se chat_id existe e é diferente,
    // é tentativa em outra conta → bloqueia.
    if (order.telegram_chat_id) {
      const sameChat = String(order.telegram_chat_id) === String(telegramChatId);
      if (!sameChat) {
        return {
          claimed: false,
          alreadyLinked: true,
          reason: 'linked_to_other_chat',
        };
      }
      // Mesmo chat reabrindo o link — só linka user_id se ainda
      // faltava, mas NÃO dispara entrega de novo (idempotente).
      if (!order.user_id && userId) {
        await this.supabase.client
          .from('orders')
          .update({ user_id: userId })
          .eq('id', order.id);
        await this.supabase.client
          .from('purchases')
          .update({ user_id: userId })
          .eq('order_id', order.id)
          .is('user_id', null);
      }
      return { claimed: false, alreadyLinked: true };
    }

    // Primeiro claim — linka chat e (se vier) user_id.
    const updates: Record<string, any> = { telegram_chat_id: telegramChatId };
    if (!order.user_id && userId) updates.user_id = userId;

    await this.supabase.client
      .from('orders')
      .update(updates)
      .eq('id', order.id);

    // Garante que TODAS as purchases dessa order têm user_id, pra
    // /minha-lista da web também passar a listar pra ela.
    if (userId) {
      await this.supabase.client
        .from('purchases')
        .update({ user_id: userId })
        .eq('order_id', order.id)
        .is('user_id', null);
    }

    // Dispara entrega via Telegram (links dos filmes). Só roda no
    // primeiro claim — chat reabrindo o mesmo link cai no branch
    // de cima e não chega aqui.
    await this.notifyBotForDelivery(order.id, telegramChatId);

    return { claimed: true };
  }

  // ---------------------------------------------------------------------------
  // Lookup recent pending orders for PIX recovery
  // ---------------------------------------------------------------------------
  async findPendingOrdersForRecovery(
    delayMinutes: number,
    maxAgeMinutes = 30,
  ): Promise<any[]> {
    const now = Date.now();
    // Igor pediu: recovery deve alcançar usuários antigos também (não
    // só os que abandonaram nos últimos 30min). Se o caller passar
    // maxAgeMinutes <= 0, removemos o limite inferior — toda order
    // pendente, não importa a idade, fica elegível. O block-window
    // randomizado em pix-recovery.service.ts garante que não fazemos
    // spam, então é seguro abrir essa porta.
    const maxCreatedAt = new Date(now - delayMinutes * 60 * 1000).toISOString();

    let query = this.supabase.client
      .from('orders')
      .select('*')
      .eq('status', OrderStatus.PENDING)
      .eq('is_recovery_order', false)
      .lte('created_at', maxCreatedAt)
      .order('created_at', { ascending: false })
      .limit(50);

    if (maxAgeMinutes > 0) {
      const minCreatedAt = new Date(now - maxAgeMinutes * 60 * 1000).toISOString();
      query = query.gte('created_at', minCreatedAt);
    }

    const { data, error } = await query;

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

    // Carrega a order pra saber se ela veio do canal Business (via=business
    // no link da página de detalhes). Quando sim, despacha as mensagens
    // pelo canal Business (Igor → cliente) em vez do bot direto, com
    // humanização (delay + typing).
    //
    // Igor (04/07): também carrega origin_promotional_bot_id — Cenário 3.
    // Quando a order veio de fluxo promo, a mensagem de "Pagamento
    // confirmado!" precisa sair pelo bot promo (onde cliente está), e o
    // botão "Assistir agora" leva pra um bot OFICIAL diferente (rotação
    // já filtra promos). Assim seguramos o cliente em 2 bots ao mesmo tempo.
    const { data: orderFull } = await this.supabase.client
      .from('orders')
      .select('business_connection_id, origin_promotional_bot_id')
      .eq('id', orderId)
      .maybeSingle();
    const businessConnectionId: string | undefined =
      orderFull?.business_connection_id || undefined;
    const originPromoBotId: string | null =
      orderFull?.origin_promotional_bot_id || null;
    const sendOpts = (extra: Record<string, any> = {}) => ({
      ...extra,
      ...(businessConnectionId ? { business_connection_id: businessConnectionId } : {}),
      // Cenário 3: força mensagens a sairem pelo bot promo (onde cliente
      // está esperando). Passar bot_id na opção é respeitado pelo
      // TelegramsEnhancedService.sendMessage (linha ~5011).
      ...(originPromoBotId ? { bot_id: originPromoBotId } : {}),
    });

    // Cenário 3: pra Igor ver no dashboard qual bot oficial entregou
    // essa order (delivery_bot_id). Grava logo pra permitir analytics
    // mesmo se a mensagem final falhar.
    if (originPromoBotId) {
      try {
        const excludeBotIds = [originPromoBotId];
        const rotation = await this.telegramsService.getNextRoundRobinBot(excludeBotIds);
        if (rotation?.bot_id) {
          await this.supabase.client
            .from('orders')
            .update({ delivery_bot_id: rotation.bot_id })
            .eq('id', orderId);
        }
      } catch (err: any) {
        this.logger.warn(`Failed to pick/save delivery_bot_id for promo order ${orderId}: ${err.message}`);
      }
    }

    // Wipe the QR/copia-e-cola/payment-method messages we tracked for
    // this chat so the user's history is clean once the PIX confirms.
    // The cleanup hook também roda em cancel/payment-pick mas não após
    // markOrderPaid antes desse fix. Skip quando for canal Business —
    // nesse caso a IA é quem mandou o link, sem mensagens de QR pra limpar.
    if (!businessConnectionId) {
      try {
        await this.telegramsService.cleanupTrackedMessages(chatId);
      } catch (err: any) {
        this.logger.warn(`cleanupTrackedMessages failed for ${chatId}: ${err.message}`);
      }
    }

    // Fetch purchases with their content (so we have telegram_group_link
    // + telegram_chat_id pra gerar invite via Bot API quando bot é admin).
    // Igor (04/06): também pega is_presale_purchase pra ajustar o texto
    // ("Pré-venda confirmada" em vez de "Pagamento confirmado").
    const { data: purchases } = await this.supabase.client
      .from('purchases')
      .select('id, content_id, is_presale_purchase, content:content(id, title, telegram_group_link, telegram_chat_id, is_presale, delivery_bot_id)')
      .eq('order_id', orderId);

    if (!purchases?.length) {
      this.logger.warn(`No purchases found for order ${orderId} delivery`);
      return;
    }

    // Considera "ordem de pré-venda" se TODA purchase é flagada — assim o
    // cabeçalho/rodapé muda. Order mista (raro) cai no fluxo normal e
    // a pré-venda específica só será notificada quando admin liberar.
    const isPresaleOrder = purchases.every((p: any) => p.is_presale_purchase);

    try {
      // Humanização pro canal Business: "Vou analisar seu comprovante…"
      // → ~5s typing → "Pagamento confirmado!". No bot direto vamos
      // direto pra confirmação (sem teatro).
      if (businessConnectionId) {
        await this.telegramsService.sendMessage(
          chatId,
          'Vou analisar seu comprovante… 💕',
          sendOpts(),
        );
        // Mostra "digitando..." durante a verificação simulada.
        try {
          await this.telegramsService.sendChatAction(chatId, 'typing', businessConnectionId);
        } catch { /* best-effort */ }
        await new Promise((r) => setTimeout(r, 5000));
      }

      const totalItems = purchases.length;
      let header: string;
      if (isPresaleOrder) {
        // Igor (04/06): pré-venda confirmada. Cliente já recebe o link
        // do grupo pra entrar (mensagem fixada no grupo avisa que tá em
        // pré-venda). Quando admin libera, dispara notificação extra.
        header = totalItems === 1
          ? `🎟 *Pré-venda confirmada!*\n\nVocê garantiu seu acesso com desconto exclusivo. Entra no grupo abaixo — quando o filme for liberado, você recebe notificação automática:`
          : `🎟 *Pré-venda confirmada!*\n\nVocê garantiu ${totalItems} acessos com desconto exclusivo. Entra nos grupos abaixo — você recebe notificação automática quando cada filme for liberado:`;
      } else if (businessConnectionId) {
        header = `✅ *Pagamento confirmado!*\n\nAqui ${totalItems === 1 ? 'está seu filme' : 'estão seus filmes'}:`;
      } else {
        header = `✅ *Pagamento confirmado!*\n\n` +
          `Você adquiriu ${totalItems} ${totalItems === 1 ? 'conteúdo' : 'conteúdos'}. ` +
          `Os links pra assistir estão abaixo:\n`;
      }
      await this.telegramsService.sendMessage(chatId, header, sendOpts({ parse_mode: 'Markdown' }));

      const inlineButtons: Array<Array<{ text: string; url: string }>> = [];
      // Igor (03/07): tracking pra marcar delivery_sent=true nas purchases
      // que tiveram o botão de acesso enviado com sucesso. Antes, o flag
      // só era setado quando o cliente re-clicava individualmente em cada
      // /r/watch e passava por todas as validações — o que quase nunca
      // acontece (cliente entra no grupo pelo 1º clique e não volta).
      // Resultado: aba "Pagas não entregues" mostrava clientes que já
      // tinham resgatado e assistido, e Igor queimava mensagens de
      // WhatsApp cobrando quem já tinha o filme.
      const deliveredPurchaseIds: string[] = [];
      for (const p of purchases) {
        const content: any = Array.isArray(p.content) ? p.content[0] : p.content;
        if (!content) continue;
        const title = content.title || 'Conteúdo';

        // Igor (07/05): split de chat_id vs group_link.
        // Estratégia: tenta Chat ID primeiro (single-use via Bot API);
        // se falha (bot não admin), usa o link de convite regular como
        // fallback. Aceita também row legada onde Chat ID estava em
        // group_link (regex detecta).
        const rawChatId: string | null = content.telegram_chat_id?.trim() || null;
        const rawLink: string | null = content.telegram_group_link?.trim() || null;
        let chatIdToTry = rawChatId;
        if (!chatIdToTry && rawLink && /^-?\d{6,}$/.test(rawLink)) {
          chatIdToTry = rawLink;
        }

        let buttonUrl: string | null = null;

        // Igor (14/06 noite): em vez de mandar o invite direto, mando uma
        // URL do nosso backend que faz round-robin entre os 5 bots. Cliente
        // clica → cai num bot sorteado → bot valida posse e gera o invite
        // do grupo nele. Resultado: cliente fica conectada num bot a mais
        // (espalha base). Pré-condição: precisa ter chatIdToTry OU rawLink
        // pra entrega funcionar — só geramos a URL rotativa se houver
        // grupo configurado.
        const hasGroupConfigured = !!(chatIdToTry || rawLink);
        if (hasGroupConfigured) {
          const backendUrl =
            this.configService.get<string>('BACKEND_URL') ||
            this.configService.get<string>('API_URL') ||
            'https://cinevisionn.onrender.com';
          buttonUrl = `${backendUrl}/api/v1/telegrams/r/watch?p=${encodeURIComponent(p.id)}`;
        }

        if (buttonUrl) {
          inlineButtons.push([{ text: `🎬 ${title}`, url: buttonUrl }]);
          deliveredPurchaseIds.push(p.id);
        } else {
          // Sem nenhum link válido — avisa o cliente.
          await this.telegramsService.sendMessage(
            chatId,
            chatIdToTry
              ? `⚠️ *${title}*: link pendente. Avise o suporte que o bot precisa estar no grupo OU cadastrar um link de convite t.me/+ como fallback.`
              : `⚠️ *${title}*: link pendente, o suporte vai te enviar manualmente.`,
            sendOpts({ parse_mode: 'Markdown' }),
          );
        }
      }

      if (inlineButtons.length) {
        await this.telegramsService.sendMessage(
          chatId,
          businessConnectionId
            ? 'Tenha um ótimo filme 💕'
            : 'Clique nos botões abaixo:',
          sendOpts({ reply_markup: { inline_keyboard: inlineButtons } }),
        );
      }

      // Igor (03/07): marca delivery_sent nas purchases despachadas.
      // Só depois que a mensagem com os botões saiu com sucesso pro
      // Telegram — se der erro antes, cai no catch e o flag não é setado
      // (aí Igor pode reenviar via "Reenviar entrega"). Uso .in() em batch
      // pra economizar RTT e ignoro erro (best-effort — não queremos
      // impedir a entrega em si por causa de update em painel).
      if (deliveredPurchaseIds.length > 0) {
        try {
          await this.supabase.client
            .from('purchases')
            .update({ delivery_sent: true })
            .in('id', deliveredPurchaseIds);
        } catch (err: any) {
          this.logger.warn(`Failed to mark delivery_sent for order ${orderId}: ${err.message}`);
        }
      }

      // Mensagem final só no fluxo bot direto. No Business a IA
      // (Yanna) já encerra com "Tenha um ótimo filme 💕".
      if (!businessConnectionId) {
        await this.telegramsService.sendMessage(
          chatId,
          'Digite /start para iniciar o bot novamente.',
        );
      } else {
        await this.telegramsService.sendMessage(
          chatId,
          'Qualquer coisa estamos a disposição ❤️',
          sendOpts(),
        );
      }
    } catch (err: any) {
      this.logger.error(`Delivery for order ${orderId} failed: ${err.message}`);
    }
  }

  /**
   * Igor (04/07): Cenário 3 — cria order+purchase a partir de um
   * purchase_intent (originado no bot oficial, consumido no bot promo).
   *
   * Semelhante ao createOrderFromCart mas:
   * - sem cart (item único direto do intent)
   * - grava origin_promotional_bot_id + origin_official_bot_id + purchase_intent_id
   * - preço snapshot vem do intent.amount_cents (imutável — se admin
   *   mudar preço no meio, cliente paga o que viu quando clicou)
   *
   * Não gera PIX aqui — chamador (handlePurchaseIntent) chama
   * generateAndSendPixForOrder depois de UPDATE do intent (guard
   * de concorrência entre criar order e consumir intent).
   */
  async createOrderFromIntent(intent: any, user: any, chatId: number) {
    const orderToken = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // 1 item = subtotal == total (sem desconto de cart, sem cupom).
    const amountCents = intent.amount_cents;

    const { data: order, error: orderError } = await this.supabase.client
      .from('orders')
      .insert({
        user_id: user.id,
        order_token: orderToken,
        subtotal_cents: amountCents,
        discount_percent: 0,
        discount_cents: 0,
        total_cents: amountCents,
        total_items: 1,
        status: OrderStatus.PENDING,
        is_recovery_order: false,
        telegram_chat_id: chatId.toString(),
        expires_at: expiresAt.toISOString(),
        // Igor (04/07): rastreamento cross-bot
        origin_promotional_bot_id: intent.promo_bot_id,
        origin_official_bot_id: intent.origin_bot_id,
        purchase_intent_id: intent.id,
      })
      .select()
      .single();

    if (orderError || !order) {
      throw new BadRequestException(`Failed to create order from intent: ${orderError?.message}`);
    }

    // Verifica pré-venda pra flag na purchase
    const { data: contentRow } = await this.supabase.client
      .from('content')
      .select('id, is_presale')
      .eq('id', intent.content_id)
      .maybeSingle();

    const { error: purchaseError } = await this.supabase.client
      .from('purchases')
      .insert({
        user_id: user.id,
        content_id: intent.content_id,
        amount_cents: amountCents,
        currency: 'BRL',
        status: PurchaseStatus.PENDING,
        preferred_delivery: PurchaseDeliveryType.TELEGRAM,
        purchase_token: uuidv4(),
        order_id: order.id,
        is_presale_purchase: contentRow?.is_presale === true,
        provider_meta: {
          telegram_chat_id: chatId.toString(),
          from_promo_intent: true,
          intent_id: intent.id,
        },
      });

    if (purchaseError) {
      // Rollback best-effort da order (evita orphan)
      await this.supabase.client.from('orders').delete().eq('id', order.id);
      throw new BadRequestException(`Failed to create purchase from intent: ${purchaseError.message}`);
    }

    return order;
  }

  /**
   * Igor (04/07): gera PIX pra uma order e envia QR pelo Telegram.
   *
   * Usado no fluxo Cenário 3 — depois que handlePurchaseIntent criou a
   * order via createOrderFromIntent, precisa gerar PIX e mandar o QR
   * no chat do bot promo (via ALS, quem chamou está no contexto).
   *
   * Também usado pra reenviar QR de order já criada (idempotência —
   * cliente clicou 2x no link do intent).
   */
  async generateAndSendPixForOrder(orderId: string, chatId: number, telegramUserId?: number) {
    // Igor (12/07): UX unificada. Carrega order com purchases + payment
    // (mesmo shape que handleOrderDeepLink usa), gera PIX se ainda não
    // existe, e delega envio pro helper sendOrderPixDeepLinkUX do
    // TelegramsEnhancedService — mesma UX polida dos bots oficiais
    // (título do filme, QR imagem, copia-cola, 3 botões de ação).
    const { data: order, error } = await this.supabase.client
      .from('orders')
      .select(`
        *,
        order_token,
        purchases:purchases(id, amount_cents, content:content_id(title, content_type, is_release)),
        payment:payments!payments_order_id_fkey(provider_meta, status, amount_cents)
      `)
      .eq('id', orderId)
      .maybeSingle();
    if (error || !order) throw new Error(`Order ${orderId} not found`);

    if (order.status === OrderStatus.PAID) {
      // Já foi pago — só avisa cliente (não gera novo PIX)
      if (this.telegramsService) {
        await this.telegramsService.sendMessage(
          chatId,
          '✅ Sua compra já foi confirmada! Você deve ter recebido a mensagem com o link do filme. Se não recebeu, avise o suporte.',
        );
      }
      return;
    }

    // Guard idempotente: se PIX já existe no payment, reusa (cliente
    // pode ter clicado no link 2x rápido). Só gera novo se ainda não tem.
    const existingPayment = Array.isArray(order.payment) ? order.payment[0] : order.payment;
    if (!existingPayment?.provider_meta?.qr_code_base64) {
      await this.generatePixForOrder(order, order.user_id, chatId.toString());
      // Refetch pra pegar o payment recém-criado
      const { data: refreshed } = await this.supabase.client
        .from('orders')
        .select(`
          *,
          order_token,
          purchases:purchases(id, amount_cents, content:content_id(title, content_type, is_release)),
          payment:payments!payments_order_id_fkey(provider_meta, status, amount_cents)
        `)
        .eq('id', orderId)
        .single();
      if (refreshed) Object.assign(order, refreshed);
    }

    // Normaliza payment (Supabase pode devolver array ou objeto)
    (order as any).payment = Array.isArray(order.payment) ? order.payment[0] : order.payment;

    if (this.telegramsService) {
      await (this.telegramsService as any).sendOrderPixDeepLinkUX(chatId, order);
    }
  }
}
