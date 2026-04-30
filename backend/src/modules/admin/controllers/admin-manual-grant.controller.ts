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
          const link = content.telegram_group_link;
          const header =
            `🎁 *Liberação manual de conteúdo*\n\n` +
            `Você recebeu acesso a *${content.title}*. ` +
            (link
              ? 'Clique no botão abaixo pra assistir.'
              : 'Em breve o suporte enviará o link.');
          await this.telegrams.sendMessage(chatId, header, {
            parse_mode: 'Markdown',
            ...(link
              ? {
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: `🎬 ${content.title}`, url: link }],
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
}
