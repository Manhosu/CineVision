import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  Param,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../users/entities/user.entity';
import {
  GetMetricsDto,
  MetricsResponseDto,
  UpdateUserStatusDto,
  UpdateUserBalanceDto,
  RetryPaymentDto,
  RefundPaymentDto,
  NotifyUserDto,
} from './dto/metrics.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats/content')
  @ApiOperation({ summary: 'Get content statistics' })
  @ApiResponse({ status: 200, description: 'Content stats retrieved successfully' })
  async getContentStats(@GetUser() user: User) {
    return this.adminService.getContentStats();
  }

  @Get('stats/users')
  @ApiOperation({ summary: 'Get users statistics' })
  @ApiResponse({ status: 200, description: 'User stats retrieved successfully' })
  async getUserStats(@GetUser() user: User) {
    return this.adminService.getUserStats();
  }

  @Get('stats/requests')
  @ApiOperation({ summary: 'Get content requests statistics' })
  @ApiResponse({ status: 200, description: 'Requests stats retrieved successfully' })
  async getRequestsStats(@GetUser() user: User) {
    return this.adminService.getRequestsStats();
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get admin dashboard metrics' })
  @ApiResponse({ status: 200, description: 'Metrics retrieved successfully', type: MetricsResponseDto })
  async getMetrics(
    @Query() query: GetMetricsDto,
    @GetUser() user: User,
  ): Promise<MetricsResponseDto> {
    // TODO: Add admin role check
    // if (user.role !== 'admin') throw new ForbiddenException('Admin access required');

    return this.adminService.getMetrics(query);
  }

  @Put('users/:id/status')
  @ApiOperation({ summary: 'Update user status (block/unblock)' })
  @HttpCode(HttpStatus.OK)
  async updateUserStatus(
    @Param('id') userId: string,
    @Body() body: { status: 'active' | 'blocked' },
    @GetUser() user: User,
  ) {
    return this.adminService.updateUserStatus({
      user_id: userId,
      status: body.status,
    });
  }

  @Put('users/:id/balance')
  @ApiOperation({ summary: 'Update user balance' })
  @HttpCode(HttpStatus.OK)
  async updateUserBalance(
    @Param('id') userId: string,
    @Body() body: { amount: number; reason: string },
    @GetUser() user: User,
  ) {
    return this.adminService.updateUserBalance({
      user_id: userId,
      amount: body.amount,
      reason: body.reason,
    });
  }

  @Post('payments/:id/retry')
  @ApiOperation({ summary: 'Retry payment webhook processing' })
  @HttpCode(HttpStatus.OK)
  async retryPaymentWebhook(
    @Param('id') paymentId: string,
    @GetUser() user: User,
  ) {
    return this.adminService.retryPaymentWebhook({
      payment_id: paymentId,
    });
  }

  @Post('payments/:id/refund')
  @ApiOperation({ summary: 'Refund a payment' })
  @HttpCode(HttpStatus.OK)
  async refundPayment(
    @Param('id') paymentId: string,
    @Body() body: { amount?: number; reason: string },
    @GetUser() user: User,
  ) {
    return this.adminService.refundPayment({
      payment_id: paymentId,
      amount: body.amount,
      reason: body.reason,
    });
  }

  @Post('users/:userId/notify')
  @ApiOperation({ summary: 'Notify user about content availability' })
  @HttpCode(HttpStatus.OK)
  async notifyUser(
    @Param('userId') userId: string,
    @Body() body: { content_id: string; message: string },
    @GetUser() user: User,
  ) {
    return this.adminService.notifyUserContentAvailable({
      user_id: userId,
      content_id: body.content_id,
      message: body.message,
    });
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users with pagination and filters' })
  async getUsers(
    @GetUser() user: User,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
    @Query('status') status?: 'active' | 'blocked',
  ) {
    return this.adminService.getAllUsers(
      parseInt(page),
      parseInt(limit),
      search,
      status,
    );
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user details with purchase history' })
  async getUserDetails(
    @Param('id') userId: string,
    @GetUser() user: User,
  ) {
    return this.adminService.getUserDetails(userId);
  }

  @Get('content')
  @ApiOperation({ summary: 'List all content with admin details' })
  async getContent(
    @GetUser() user: User,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getAllContent(
      parseInt(page),
      parseInt(limit),
      search,
      status,
    );
  }

  @Put('content/:id/availability')
  @ApiOperation({ summary: 'Update content availability' })
  @HttpCode(HttpStatus.OK)
  async updateContentAvailability(
    @Param('id') contentId: string,
    @Body() body: { availability: 'site' | 'telegram' | 'both' },
    @GetUser() user: User,
  ) {
    return this.adminService.updateContentAvailability(contentId, body.availability);
  }

  @Get('payments')
  @ApiOperation({ summary: 'List payments with admin filters' })
  async getPayments(
    @GetUser() user: User,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
    @Query('provider') provider?: string,
  ) {
    return this.adminService.getAllPayments(
      parseInt(page),
      parseInt(limit),
      status,
      provider,
    );
  }

  @Get('orders')
  @ApiOperation({ summary: 'List content requests/orders' })
  async getOrders(
    @GetUser() user: User,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
  ) {
    return this.adminService.getAllOrders(
      parseInt(page),
      parseInt(limit),
      status,
    );
  }

  @Get('logs')
  @ApiOperation({ summary: 'Get system logs' })
  async getLogs(
    @GetUser() user: User,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('level') level?: string,
    @Query('entity') entity?: string,
    @Query('type') type?: string,
  ) {
    return this.adminService.getSystemLogs(
      parseInt(page),
      parseInt(limit),
      level,
      entity,
      type,
    );
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get system settings' })
  async getSettings(@GetUser() user: User) {
    // Return masked/safe settings
    return {
      pix_key: '***@***.com',
      stripe_connected: true,
      cdn_configured: true,
      telegram_bot_connected: true,
    };
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update system settings' })
  @HttpCode(HttpStatus.OK)
  async updateSettings(
    @Body() settings: any,
    @GetUser() user: User,
  ) {
    // Implementation would go here
    // This would update various system configurations
    return { success: true };
  }
}