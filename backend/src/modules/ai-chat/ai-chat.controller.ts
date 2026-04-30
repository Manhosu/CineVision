import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { AiChatService } from './ai-chat.service';

@ApiTags('ai-chat')
@Controller()
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

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
