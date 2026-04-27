import {
  Body,
  Controller,
  Post,
  Get,
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { SupabaseService } from '../../../config/supabase.service';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

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
  constructor(private readonly supabase: SupabaseService) {}

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

    // Notify bot to deliver (best-effort)
    try {
      const botUrl = process.env.BOT_WEBHOOK_URL;
      if (botUrl && user.telegram_chat_id) {
        await axios.post(
          `${botUrl}/webhook/payment-confirmed`,
          {
            purchase_id: purchase.id,
            telegram_chat_id: user.telegram_chat_id,
            manual: true,
          },
          { timeout: 5000 },
        );
      }
    } catch {
      // best-effort
    }

    return {
      ok: true,
      purchase,
      user: { id: user.id, name: user.name, email: user.email },
      content: { id: content.id, title: content.title },
    };
  }
}
