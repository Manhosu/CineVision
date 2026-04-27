import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { PixRecoveryService } from './pix-recovery.service';

@ApiTags('admin-pix-recovery')
@Controller('admin/pix-recovery')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class PixRecoveryController {
  constructor(private readonly recovery: PixRecoveryService) {}

  @Get('history')
  @ApiOperation({ summary: 'List PIX recovery history' })
  async history(@Query('limit') limit?: string) {
    return this.recovery.listHistory(limit ? parseInt(limit, 10) : 100);
  }

  @Get('stats')
  @ApiOperation({ summary: 'PIX recovery statistics' })
  async stats() {
    return this.recovery.getStats();
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update PIX recovery settings' })
  async updateSettings(
    @Body()
    body: {
      enabled?: boolean;
      delayMinutes?: number;
      discountPercent?: number;
      cooldownHours?: number;
      maxItems?: number;
    },
  ) {
    await this.recovery.setSettings(body);
    return { ok: true };
  }
}
