import { Controller, Get, Post, Delete, Patch, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { BroadcastGroupsService } from '../services/broadcast-groups.service';

/**
 * N31 (Igor 07/06): Broadcast para grupos Telegram onde os bots são admins.
 */
@ApiTags('admin-broadcast-groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/broadcast-groups')
export class BroadcastGroupsController {
  constructor(private readonly svc: BroadcastGroupsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista grupos cadastrados' })
  async list() {
    return this.svc.listGroups();
  }

  @Post()
  @ApiOperation({ summary: 'Cadastra grupo (bot_id + chat_id)' })
  async add(@Body() body: { bot_id: string; chat_id: string; title?: string }) {
    return this.svc.addGroup(body.bot_id, body.chat_id, body.title);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Ativa/desativa grupo no broadcast' })
  async toggle(@Param('id') id: string, @Body() body: { is_active: boolean }) {
    return this.svc.toggleGroup(id, body.is_active);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove grupo' })
  async remove(@Param('id') id: string) {
    return this.svc.removeGroup(id);
  }

  @Get('broadcasts')
  @ApiOperation({ summary: 'Histórico de broadcasts para grupos' })
  async listBroadcasts() {
    return this.svc.listBroadcasts();
  }

  @Post('send')
  @ApiOperation({ summary: 'Envia mensagem para TODOS os grupos ativos' })
  async send(@Body() body: { message_text: string; image_url?: string }, @Req() req: any) {
    const adminId = req?.user?.sub || req?.user?.id;
    return this.svc.sendBroadcast({
      messageText: body.message_text,
      imageUrl: body.image_url,
      adminId,
    });
  }

  @Delete('broadcasts/:id')
  @ApiOperation({ summary: 'Apaga mensagem do broadcast de todos os grupos' })
  async deleteBroadcast(@Param('id') id: string) {
    return this.svc.deleteBroadcast(id);
  }
}
