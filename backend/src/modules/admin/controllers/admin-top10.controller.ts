import {
  Controller,
  Get,
  Post,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { AdminTop10Service } from '../services/admin-top10.service';
import { WeeklyResetService } from '../../content/services/weekly-reset.service';

@ApiTags('Admin - Top 10')
@Controller('admin/top10')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class AdminTop10Controller {
  constructor(
    private readonly top10Service: AdminTop10Service,
    private readonly weeklyResetService: WeeklyResetService,
  ) {}

  /**
   * Igor (11/07): backfill one-shot do previous_rank pro fix do Top 10
   * sticky não precisar esperar o cron de domingo. Chamar imediato após
   * deploy da migration 20260712000000_top10_previous_rank.
   */
  @Post('backfill-previous-ranks')
  @RequirePermission('can_view_top10')
  @ApiOperation({ summary: 'Backfill previous_rank do Top 10 sem esperar cron semanal' })
  @HttpCode(HttpStatus.OK)
  async backfillPreviousRanks() {
    await this.weeklyResetService.snapshotPreviousRanks();
    return { ok: true, message: 'Snapshot dos ranks anteriores gravado' };
  }

  @Get('current')
  @RequirePermission('can_view_top10')
  @ApiOperation({ summary: 'Get current top 10 content' })
  @ApiQuery({ name: 'type', enum: ['movie', 'series', 'novelinha'], required: false })
  @ApiResponse({ status: 200, description: 'Current top 10 retrieved successfully' })
  @HttpCode(HttpStatus.OK)
  async getCurrentTop10(
    @Query('type') type: 'movie' | 'series' | 'novelinha' = 'movie',
  ) {
    return this.top10Service.getCurrentTop10(type);
  }

  @Get('history')
  @RequirePermission('can_view_top10')
  @ApiOperation({ summary: 'Get weekly ranking history' })
  @ApiQuery({ name: 'weeks', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Weekly history retrieved successfully' })
  @HttpCode(HttpStatus.OK)
  async getWeeklyHistory(@Query('weeks') weeks: string = '4') {
    return this.top10Service.getWeeklyHistory(parseInt(weeks, 10) || 4);
  }
}

@ApiTags('Admin - Sales')
@Controller('admin/sales')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class AdminSalesController {
  constructor(private readonly top10Service: AdminTop10Service) {}

  @Get('weekly')
  @RequirePermission('can_view_top10')
  @ApiOperation({ summary: 'Get daily sales data' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Daily sales data retrieved successfully' })
  @HttpCode(HttpStatus.OK)
  async getDailySales(@Query('days') days: string = '7') {
    return this.top10Service.getDailySalesData(parseInt(days, 10) || 7);
  }
}
