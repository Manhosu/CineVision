import {
  Controller,
  Get,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { AdminTop10Service } from '../services/admin-top10.service';

@ApiTags('Admin - Top 10')
@Controller('admin/top10')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminTop10Controller {
  constructor(private readonly top10Service: AdminTop10Service) {}

  @Get('current')
  @ApiOperation({ summary: 'Get current top 10 content' })
  @ApiQuery({ name: 'type', enum: ['movie', 'series'], required: false })
  @ApiResponse({ status: 200, description: 'Current top 10 retrieved successfully' })
  @HttpCode(HttpStatus.OK)
  async getCurrentTop10(@Query('type') type: 'movie' | 'series' = 'movie') {
    return this.top10Service.getCurrentTop10(type);
  }

  @Get('history')
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
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminSalesController {
  constructor(private readonly top10Service: AdminTop10Service) {}

  @Get('weekly')
  @ApiOperation({ summary: 'Get daily sales data' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Daily sales data retrieved successfully' })
  @HttpCode(HttpStatus.OK)
  async getDailySales(@Query('days') days: string = '7') {
    return this.top10Service.getDailySalesData(parseInt(days, 10) || 7);
  }
}
