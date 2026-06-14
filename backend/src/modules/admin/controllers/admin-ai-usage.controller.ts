import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { AdminAiUsageService } from '../services/admin-ai-usage.service';

@ApiTags('admin-ai-usage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/ai-usage')
export class AdminAiUsageController {
  constructor(private readonly svc: AdminAiUsageService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Totais 24h/7d/30d + top users + histograma' })
  async summary() {
    const [totals, top, hourly] = await Promise.all([
      this.svc.getTotals(),
      this.svc.getTopUsers(20),
      this.svc.getHourlyDistribution(),
    ]);
    return { totals, top_users: top, hourly };
  }
}
