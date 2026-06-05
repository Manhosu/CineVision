import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { AdminBotsService } from '../services/admin-bots.service';
import { BotMigrationService } from '../services/bot-migration.service';

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
  constructor(
    private readonly adminBotsService: AdminBotsService,
    private readonly botMigrationService: BotMigrationService,
  ) {}

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

  /**
   * Igor (07/06): Fase C — marca bot como caído e dispara WhatsApp pra
   * todos os usuários daquele bot avisando do bot novo. Fire-and-forget:
   * retorna o run_id imediatamente, processamento corre em background.
   */
  @Post(':id/migrate')
  @ApiOperation({ summary: 'Marca bot como caído + dispara migração WhatsApp pros usuários' })
  async migrate(@Param('id') id: string, @Req() req: any) {
    const userId = req?.user?.sub || req?.user?.id;
    return this.botMigrationService.startMigration(id, userId);
  }

  @Get('migrations/runs')
  @ApiOperation({ summary: 'Lista runs de migração WhatsApp (últimas 20)' })
  async listMigrationRuns(@Query('bot_id') botId?: string) {
    const runs = await this.botMigrationService.listRuns(botId);
    return { runs };
  }
}
