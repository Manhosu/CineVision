import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { createClient } from '@supabase/supabase-js';

@ApiTags('Temp - Purchase Creation')
@Controller('temp-purchase')
export class TempPurchaseController {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
    );
  }

  @Get('user/:email')
  @ApiOperation({ summary: 'Get user by email' })
  async getUserByEmail(@Param('email') email: string) {
    const { data, error } = await this.supabase
      .from('users')
      .select('id, email, name, role')
      .eq('email', email)
      .single();

    if (error) throw error;
    return data;
  }

  @Post('create')
  @ApiOperation({ summary: 'Create purchase for user' })
  async createPurchase(@Body() body: { user_id: string; content_id: string }) {
    const { user_id, content_id } = body;

    const { data, error } = await this.supabase
      .from('purchases')
      .insert({
        user_id,
        content_id,
        amount_cents: 720,
        currency: 'BRL',
        status: 'paid',
        preferred_delivery: 'site',
        payment_confirmed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  @Get('verify/:userId/:contentId')
  @ApiOperation({ summary: 'Verify purchase exists' })
  async verifyPurchase(
    @Param('userId') userId: string,
    @Param('contentId') contentId: string,
  ) {
    const { data, error } = await this.supabase
      .from('purchases')
      .select(`
        id,
        user_id,
        content_id,
        amount_cents,
        status,
        created_at,
        users:user_id(email, name),
        contents:content_id(title)
      `)
      .eq('user_id', userId)
      .eq('content_id', contentId);

    if (error) throw error;
    return data;
  }
}
