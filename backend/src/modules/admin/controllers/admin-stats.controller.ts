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
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminStatsController {
  constructor(private readonly statsService: AdminStatsService) {}

  @Get('users')
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

  @Get('requests')
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
