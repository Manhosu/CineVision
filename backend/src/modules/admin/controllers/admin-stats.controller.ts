import {
  Controller,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { AdminStatsService } from '../services/admin-stats.service';

@ApiTags('Admin - Statistics')
@Controller('admin/stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminStatsController {
  constructor(private readonly statsService: AdminStatsService) {}

  // N22 (Igor 08/05): funcionarios precisam ver "Total de Conteudo" e
  // "Total de Usuarios" no painel pra ter contexto. Sao counts globais
  // — sem dados sensiveis. Liberado pra ADMIN, MODERATOR e EMPLOYEE.
  // 'stats/requests' continua restrito a ADMIN (pode revelar tickets
  // sensiveis pendentes).

  @Get('users')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.EMPLOYEE)
  @ApiOperation({
    summary: 'Get total users',
    description: 'Returns the total number of users who have accessed the site',
  })
  @ApiResponse({
    status: 200,
    description: 'Total users count retrieved successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getTotalUsers() {
    return this.statsService.getTotalUsers();
  }

  @Get('content')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.EMPLOYEE)
  @ApiOperation({
    summary: 'Get content statistics',
    description: 'Returns total content count and other content stats',
  })
  @ApiResponse({
    status: 200,
    description: 'Content statistics retrieved successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getContentStats() {
    return this.statsService.getContentStats();
  }

  @Get('bot-migration')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get bot migration stats (new vs old bot)' })
  @HttpCode(HttpStatus.OK)
  async getBotMigrationStats() {
    return this.statsService.getBotMigrationStats();
  }

  @Get('requests')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get content requests statistics',
    description: 'Returns pending and total content requests',
  })
  @ApiResponse({
    status: 200,
    description: 'Request statistics retrieved successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getRequestStats() {
    return this.statsService.getRequestStats();
  }
}
