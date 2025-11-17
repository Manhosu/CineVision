import {
  Controller,
  Get,
  Delete,
  Post,
  Query,
  Param,
  Logger,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminPurchasesSimpleService } from '../services/admin-purchases-simple.service';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';

@ApiTags('Admin Purchases')
@ApiBearerAuth()
@Controller('admin/purchases')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminPurchasesController {
  private readonly logger = new Logger(AdminPurchasesController.name);

  constructor(private readonly adminPurchasesService: AdminPurchasesSimpleService) {}

  @Get('orders')
  @ApiOperation({
    summary: 'List all purchase orders with REAL Telegram data (Admin only)',
    description: 'Retrieve paginated list of purchase orders with REAL user Telegram information and real-time payment status from Stripe. Shows actual telegram_id and @username from provider_meta, not synthetic data. Requires admin authentication.'
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 20)' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by order status (paid, pending, failed)' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by user email, name, telegram username, or content title' })
  @ApiQuery({ name: 'syncWithStripe', required: false, description: 'Sync payment status with Stripe in real-time (default: true)' })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully with real Telegram data and real-time payment status' })
  async getAllOrders(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('syncWithStripe') syncWithStripe = 'true',
  ) {
    return this.adminPurchasesService.getAllOrders(
      parseInt(page),
      parseInt(limit),
      status,
      search,
      syncWithStripe === 'true',
    );
  }

  @Get('orders/:id')
  @ApiOperation({
    summary: 'Get order by ID (Admin only)',
    description: 'Retrieve detailed information about a specific order. Requires admin authentication.'
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrderById(
    @Param('id') orderId: string,
  ) {
    return this.adminPurchasesService.getOrderById(orderId);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get purchase statistics (Admin only)',
    description: 'Retrieve overall statistics about purchases and revenue. Requires admin authentication.'
  })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getOrderStats() {
    return this.adminPurchasesService.getOrderStats();
  }

  @Delete('orders/:id')
  @ApiOperation({
    summary: 'Delete purchase order by ID (Admin only)',
    description: 'Permanently delete a purchase order. Use with caution. Requires admin authentication.'
  })
  @ApiParam({ name: 'id', description: 'Order ID to delete' })
  @ApiResponse({ status: 200, description: 'Order deleted successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @HttpCode(HttpStatus.OK)
  async deleteOrder(
    @Param('id') orderId: string,
  ) {
    return this.adminPurchasesService.deleteOrder(orderId);
  }

  @Post('expire-pending')
  @ApiOperation({
    summary: 'Expire old pending purchases (Admin only)',
    description: 'Marks pending purchases older than specified hours as expired. Default is 24 hours.'
  })
  @ApiQuery({ name: 'maxAgeHours', required: false, description: 'Maximum age in hours before expiration (default: 24)' })
  @ApiResponse({ status: 200, description: 'Pending purchases expired successfully' })
  @HttpCode(HttpStatus.OK)
  async expirePendingPurchases(
    @Query('maxAgeHours') maxAgeHours = '24',
  ) {
    this.logger.log(`Admin triggered expire pending purchases (max age: ${maxAgeHours}h)`);
    return this.adminPurchasesService.expirePendingPurchases(parseInt(maxAgeHours));
  }

  @Delete('cleanup-expired')
  @ApiOperation({
    summary: 'Clean up old expired purchases (Admin only)',
    description: 'Permanently deletes expired purchases older than specified days. Default is 7 days.'
  })
  @ApiQuery({ name: 'deleteOlderThanDays', required: false, description: 'Delete expired purchases older than this many days (default: 7)' })
  @ApiResponse({ status: 200, description: 'Expired purchases cleaned up successfully' })
  @HttpCode(HttpStatus.OK)
  async cleanupExpiredPurchases(
    @Query('deleteOlderThanDays') deleteOlderThanDays = '7',
  ) {
    this.logger.log(`Admin triggered cleanup expired purchases (older than ${deleteOlderThanDays} days)`);
    return this.adminPurchasesService.cleanupExpiredPurchases(parseInt(deleteOlderThanDays));
  }
}