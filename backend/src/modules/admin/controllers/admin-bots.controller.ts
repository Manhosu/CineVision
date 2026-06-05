import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { AdminBotsService } from '../services/admin-bots.service';

/**
 * Igor (07/06): CRUD dos bots Telegram do sistema multi-bot.
 * Painel `/admin/bots` consome esses endpoints.
 */
@ApiTags('admin-bots')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/bots')
export class AdminBotsController {
  constructor(private readonly adminBotsService: AdminBotsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista todos os bots cadastrados' })
  @ApiResponse({ status: 200, description: 'Lista de bots' })
  async list() {
    const bots = await this.adminBotsService.listBots();
    return { bots };
  }

  @Post()
  @ApiOperation({ summary: 'Cadastra novo bot (valida token via getMe)' })
  @ApiResponse({ status: 201, description: 'Bot cadastrado' })
  @ApiResponse({ status: 400, description: 'Token inválido' })
  async create(@Body() body: { token: string; display_name?: string; roles?: string[] }) {
    return this.adminBotsService.createBot(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza bot (papéis, peso, status, default)' })
  async update(
    @Param('id') id: string,
    @Body() patch: any,
  ) {
    return this.adminBotsService.updateBot(id, patch);
  }

  @Post(':id/setup-webhook')
  @ApiOperation({ summary: 'Configura webhook do bot apontando pra /webhook/:botId' })
  async setupWebhook(@Param('id') id: string) {
    return this.adminBotsService.setupWebhook(id);
  }

  @Post(':id/healthcheck')
  @ApiOperation({ summary: 'getMe — testa se token responde + atualiza last_seen_ok_at' })
  async healthcheck(@Param('id') id: string) {
    return this.adminBotsService.healthcheck(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove bot (não permite remover o default)' })
  async remove(@Param('id') id: string) {
    return this.adminBotsService.deleteBot(id);
  }
}
