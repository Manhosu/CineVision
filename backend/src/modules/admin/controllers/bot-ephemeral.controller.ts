import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SupabaseService } from '../../../config/supabase.service';

@ApiTags('bot-ephemeral')
@Controller('bot/ephemeral-messages')
export class BotEphemeralController {
  constructor(private readonly supabase: SupabaseService) {}

  @Post()
  async track(
    @Body()
    body: { chat_id: string; message_id: number; step?: string },
  ) {
    await this.supabase.client.from('bot_ephemeral_messages').insert({
      chat_id: body.chat_id,
      message_id: body.message_id,
      step: body.step || null,
    });
    return { ok: true };
  }

  @Get()
  async list(@Query('chat_id') chatId: string) {
    if (!chatId) return [];
    const { data } = await this.supabase.client
      .from('bot_ephemeral_messages')
      .select('id, message_id, step, created_at')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(50);
    return data || [];
  }

  @Delete()
  async clear(
    @Query('chat_id') chatId: string,
    @Query('keep_step') keepStep?: string,
  ) {
    if (!chatId) return { ok: false };

    let q = this.supabase.client
      .from('bot_ephemeral_messages')
      .delete()
      .eq('chat_id', chatId);

    if (keepStep) {
      q = q.neq('step', keepStep);
    }

    await q;
    return { ok: true };
  }
}
