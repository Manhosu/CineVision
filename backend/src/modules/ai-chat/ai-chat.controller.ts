import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { AiChatService } from './ai-chat.service';

@ApiTags('ai-chat')
@Controller()
export class AiChatController {
  constructor(
    private readonly aiChatService: AiChatService,
    private readonly configService: ConfigService,
  ) {}

  // Internal endpoint for bots/integrations (no guard — protect via network/token if needed)
  @Post('ai-chat/message')
  @ApiOperation({ summary: 'Process an incoming message through the AI (bot internal)' })
  async processMessage(
    @Body()
    body: {
      platform: 'telegram' | 'whatsapp' | 'telegram_business';
      external_chat_id: string;
      message: string;
      user_id?: string;
      business_connection_id?: string;
    },
  ) {
    return this.aiChatService.processIncomingMessage({
      platform: body.platform,
      externalChatId: body.external_chat_id,
      messageText: body.message,
      userId: body.user_id,
      businessConnectionId: body.business_connection_id,
    });
  }

  // ---------------------- Admin ----------------------
  @Get('admin/ai-chat/conversations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async listConversations(
    @Query('platform') platform?: string,
    @Query('paused') paused?: string,
  ) {
    return this.aiChatService.listConversations({
      platform,
      paused: paused === 'true' ? true : paused === 'false' ? false : undefined,
    });
  }

  @Get('admin/ai-chat/conversations/:id/messages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async getMessages(@Param('id') id: string) {
    return this.aiChatService.getConversationMessages(id);
  }

  /**
   * Proxy de mídia do Telegram. Recebe um `file_id` (que veio do
   * webhook quando cliente enviou foto/documento) e devolve o
   * conteúdo binário direto pro browser do admin renderizar.
   *
   * Não cacheia — Telegram file_id tem TTL longo, dá pra buscar
   * sob demanda. Se virar gargalo, cacheamos depois em S3/Supabase
   * Storage.
   */
  @Get('admin/ai-chat/media/:fileId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async getMedia(@Param('fileId') fileId: string, @Res() res: Response) {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new NotFoundException('Bot token não configurado');
    }

    // 1) getFile — Telegram retorna file_path
    const meta = await axios.get(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`,
      { timeout: 15000 },
    );
    const filePath = meta?.data?.result?.file_path;
    if (!filePath) {
      throw new NotFoundException('file_id inválido ou expirado');
    }

    // 2) Download do conteúdo e pipe pro client
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    const file = await axios.get(fileUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    // Telegram não devolve content-type confiável — inferimos pela ext.
    const ext = filePath.split('.').pop()?.toLowerCase() || 'bin';
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      pdf: 'application/pdf',
      mp4: 'video/mp4',
      mov: 'video/quicktime',
    };
    res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(Buffer.from(file.data));
  }

  @Post('admin/ai-chat/conversations/:id/takeover')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async takeover(@Param('id') id: string) {
    await this.aiChatService.pauseConversation(id, 'admin_takeover');
    return { ok: true };
  }

  @Post('admin/ai-chat/conversations/:id/resume')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async resume(@Param('id') id: string) {
    await this.aiChatService.resumeConversation(id);
    return { ok: true };
  }

  @Post('admin/ai-chat/conversations/:id/send')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async sendAdminMessage(
    @Param('id') id: string,
    @Body() body: { text: string },
  ) {
    await this.aiChatService.sendAdminMessage(id, body.text);
    return { ok: true };
  }

  @Get('admin/ai-chat/training')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async getTraining() {
    return this.aiChatService.getTraining();
  }

  @Get('admin/ai-chat/flags')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async getFlags() {
    return this.aiChatService.getEnabledFlags();
  }

  @Put('admin/ai-chat/flags')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async setFlags(
    @Body() body: { telegram?: boolean; whatsapp?: boolean; telegram_business?: boolean },
  ) {
    await this.aiChatService.setEnabledFlags(body);
    return this.aiChatService.getEnabledFlags();
  }

  @Get('admin/ai-chat/business-connections')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async getBusinessConnections() {
    return this.aiChatService.getBusinessConnections();
  }

  @Put('admin/ai-chat/training')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async updateTraining(
    @Body()
    body: {
      system_prompt: string;
      faq_pairs: Array<{ question: string; answer: string }>;
    },
  ) {
    await this.aiChatService.updateTraining(body.system_prompt, body.faq_pairs || []);
    return { ok: true };
  }
}
