import {
  Body,
  Controller,
  Post,
  Get,
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
  Logger,
  Optional,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../../config/supabase.service';
import { TelegramsEnhancedService } from '../../telegrams/telegrams-enhanced.service';
import { v4 as uuidv4 } from 'uuid';

interface GrantAccessBody {
  content_id: string;
  user_identifier: string; // email, telegram_id, user_id, or name fragment
}

@ApiTags('admin-manual-grant')
@Controller('admin/grant-access')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminManualGrantController {
  private readonly logger = new Logger(AdminManualGrantController.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly configService: ConfigService,
    @Optional() private readonly telegrams?: TelegramsEnhancedService,
  ) {}

  @Get('user-search')
  @ApiOperation({ summary: 'Search users by email, telegram_id, id, or name (autocomplete)' })
  async searchUsers(@Query('q') q: string) {
    const term = (q || '').trim();
    if (!term) return [];

    const { data } = await this.supabase.client
      .from('users')
      .select('id, name, email, telegram_id, telegram_username, role')
      .or(
        `email.ilike.%${term}%,name.ilike.%${term}%,telegram_username.ilike.%${term}%,telegram_id.eq.${term}`,
      )
      .limit(15);

    return data || [];
  }

  @Post()
  @ApiOperation({ summary: 'Manually grant access to a content item for a user' })
  async grantAccess(@Body() body: GrantAccessBody) {
    if (!body.content_id || !body.user_identifier) {
      throw new BadRequestException('content_id and user_identifier are required');
    }

    // Resolve user
    const identifier = body.user_identifier.trim();
    const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      identifier,
    );

    let user: any = null;

    if (uuidLike) {
      const { data } = await this.supabase.client
        .from('users')
        .select('*')
        .eq('id', identifier)
        .maybeSingle();
      user = data;
    }

    if (!user) {
      const { data } = await this.supabase.client
        .from('users')
        .select('*')
        .or(
          `email.eq.${identifier},telegram_id.eq.${identifier},telegram_username.eq.${identifier}`,
        )
        .maybeSingle();
      user = data;
    }

    if (!user) {
      throw new NotFoundException(`User "${identifier}" not found`);
    }

    // Resolve content
    const { data: content } = await this.supabase.client
      .from('content')
      .select('*')
      .eq('id', body.content_id)
      .single();

    if (!content) {
      throw new NotFoundException(`Content ${body.content_id} not found`);
    }

    // Check if already owned
    const { data: existingPurchase } = await this.supabase.client
      .from('purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('content_id', content.id)
      .eq('status', 'paid')
      .maybeSingle();

    if (existingPurchase) {
      return {
        ok: true,
        already_owned: true,
        purchase_id: existingPurchase.id,
      };
    }

    // Create manual purchase
    const purchaseToken = uuidv4();
    const now = new Date().toISOString();
    const { data: purchase, error } = await this.supabase.client
      .from('purchases')
      .insert({
        user_id: user.id,
        content_id: content.id,
        amount_cents: 0,
        currency: 'BRL',
        status: 'paid',
        preferred_delivery: 'telegram',
        purchase_token: purchaseToken,
        payment_confirmed_at: now,
        provider_meta: { manual_grant: true, granted_at: now },
      })
      .select()
      .single();

    if (error || !purchase) {
      throw new BadRequestException(`Failed to create purchase: ${error?.message}`);
    }

    // Entrega direta via TelegramsEnhancedService — substitui o webhook
    // antigo que dependia de BOT_WEBHOOK_URL (frágil) e do
    // telegram_chat_id estar populado (nem todo user tem). Em chat
    // privado, telegram_chat_id == telegram_id, então usamos qualquer
    // um dos dois.
    const chatIdRaw = user.telegram_chat_id || user.telegram_id;
    let delivered = false;
    if (chatIdRaw && this.telegrams) {
      const chatId = parseInt(String(chatIdRaw), 10);
      if (!Number.isNaN(chatId)) {
        try {
          // Igor (07/05): split de chat_id vs group_link.
          // Tenta Chat ID primeiro (single-use); se falha, fallback pra
          // link de convite regular. Suporta também row legada onde
          // Chat ID estava em group_link (regex detecta).
          const rawChatId: string | null = content.telegram_chat_id?.trim() || null;
          const rawLink: string | null = content.telegram_group_link?.trim() || null;
          let chatIdToTry = rawChatId;
          if (!chatIdToTry && rawLink && /^-?\d{6,}$/.test(rawLink)) {
            chatIdToTry = rawLink;
          }

          let buttonUrl: string | null = null;

          if (chatIdToTry) {
            try {
              // Igor (07/06): usa bot admin do grupo (delivery_bot_id).
              buttonUrl = await this.telegrams.createInviteLinkForUser(
                chatIdToTry,
                purchase.id,
                (content as any).delivery_bot_id || null,
              );
            } catch (err: any) {
              this.logger.warn(
                `Manual grant: createInviteLinkForUser failed for chat ${chatIdToTry} (bot ${(content as any).delivery_bot_id || 'default'}): ${err.message}`,
              );
            }
          }

          if (!buttonUrl && rawLink && rawLink !== chatIdToTry) {
            buttonUrl = rawLink;
          }

          const header =
            `🎁 *Liberação manual de conteúdo*\n\n` +
            `Você recebeu acesso a *${content.title}*. ` +
            (buttonUrl
              ? 'Clique no botão abaixo pra assistir.'
              : 'Em breve o suporte enviará o link.');
          await this.telegrams.sendMessage(chatId, header, {
            parse_mode: 'Markdown',
            ...(buttonUrl
              ? {
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: `🎬 ${content.title}`, url: buttonUrl }],
                    ],
                  },
                }
              : {}),
          });
          delivered = true;
        } catch (err: any) {
          this.logger.warn(`Manual grant delivery failed for ${chatId}: ${err.message}`);
        }
      }
    }

    return {
      ok: true,
      purchase,
      delivered,
      user: { id: user.id, name: user.name, email: user.email },
      content: { id: content.id, title: content.title },
    };
  }

  /**
   * Igor (25/06): liberação manual sem usuário cadastrado. Cliente pagou
   * PIX manual (chave direta) e mandou comprovante pelo WhatsApp, mas não
   * tem cadastro nem Telegram. Admin escolhe o conteúdo, sistema cria
   * order+purchase pago manual e retorna URL ROTATIVA pra mandar pro
   * cliente. Cada clique do cliente sorteia bot ativo (round-robin).
   *
   * URL retornada: https://<backend>/api/v1/telegrams/r/watch?p=<purchaseId>
   * Cliente abre → cai num bot sorteado → bot reconhece purchase paga →
   * gera invite single-use do grupo → manda no chat dele.
   */
  @Post('manual-pix-link')
  @ApiOperation({ summary: 'Cria purchase manual e retorna link rotativo single-use' })
  async manualPixLink(@Body() body: { content_id: string }) {
    if (!body?.content_id) {
      throw new BadRequestException('content_id é obrigatório');
    }

    const { data: content } = await this.supabase.client
      .from('content')
      .select('id, title, price_cents, telegram_chat_id, telegram_group_link, delivery_bot_id')
      .eq('id', body.content_id)
      .single();
    if (!content) throw new NotFoundException(`Content ${body.content_id} not found`);

    const orderToken = uuidv4();
    const purchaseToken = uuidv4();
    const now = new Date().toISOString();

    // 1. Cria order paga manualmente (telegram_chat_id NULL — cliente vai
    // preencher quando clicar no link rotativo e o bot reconhecer ele).
    // Igor (25/06): orders não tem provider_meta (só purchases tem) — flag
    // de manual_grant fica só na purchase.
    const { data: order, error: orderErr } = await this.supabase.client
      .from('orders')
      .insert({
        order_token: orderToken,
        subtotal_cents: content.price_cents || 0,
        total_cents: content.price_cents || 0,
        total_items: 1,
        status: 'paid',
        paid_at: now,
        is_recovery_order: false,
      })
      .select()
      .single();
    if (orderErr || !order) {
      throw new BadRequestException(`Failed to create order: ${orderErr?.message}`);
    }

    // 2. Cria purchase linkada à order.
    const { data: purchase, error: purchaseErr } = await this.supabase.client
      .from('purchases')
      .insert({
        order_id: order.id,
        content_id: content.id,
        amount_cents: content.price_cents || 0,
        currency: 'BRL',
        status: 'paid',
        preferred_delivery: 'telegram',
        purchase_token: purchaseToken,
        payment_confirmed_at: now,
        delivery_sent: false,
        provider_meta: { manual_grant: true, manual_pix: true, granted_at: now },
      })
      .select()
      .single();
    if (purchaseErr || !purchase) {
      // Limpa order órfã pra não poluir
      await this.supabase.client.from('orders').delete().eq('id', order.id);
      throw new BadRequestException(`Failed to create purchase: ${purchaseErr?.message}`);
    }

    const backendUrl =
      this.configService.get<string>('BACKEND_URL') ||
      this.configService.get<string>('API_URL') ||
      'https://cinevisionn.onrender.com';
    const accessUrl = `${backendUrl}/api/v1/telegrams/r/watch?p=${purchase.id}`;

    this.logger.log(
      `[manual-pix-link] criado: content=${content.title}, purchase=${purchase.id}, url=${accessUrl}`,
    );

    return {
      ok: true,
      content: { id: content.id, title: content.title, price_cents: content.price_cents },
      order_id: order.id,
      purchase_id: purchase.id,
      access_url: accessUrl,
      // Mensagem pronta pra colar no WhatsApp do cliente
      whatsapp_message:
        `Olá! Aqui está o link de acesso pro filme/série *${content.title}* que você comprou.\n\n` +
        `${accessUrl}\n\n` +
        `É só clicar e seguir as instruções. Qualquer coisa estamos por aqui 🍿`,
    };
  }
}
