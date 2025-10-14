import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LogsService } from './logs.service';
import { LogType, LogLevel } from './entities/system-log.entity';

@ApiTags('logs')
@Controller('logs')
export class LogsController {
  constructor(private logsService: LogsService) {}

  @Get()
  @ApiOperation({ summary: 'Get system logs' })
  @ApiQuery({ name: 'type', enum: LogType, required: false })
  @ApiQuery({ name: 'level', enum: LogLevel, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiResponse({
    status: 200,
    description: 'Logs retrieved successfully',
  })
  async getLogs(
    @Query('type') type?: LogType,
    @Query('level') level?: LogLevel,
    @Query('limit') limit?: number,
  ) {
    return this.logsService.getLogs(type, level, limit || 50);
  }
}