import {
  Controller,
  Get,
  Query,
  Param,
  Logger,
} from '@nestjs/common';
import { AdminPurchasesSimpleService } from '../services/admin-purchases-simple.service';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';

@ApiTags('Admin Purchases')
@Controller('admin/purchases')
export class AdminPurchasesController {
  private readonly logger = new Logger(AdminPurchasesController.name);

  constructor(private readonly adminPurchasesService: AdminPurchasesSimpleService) {}

  @Get('orders')
  @ApiOperation({
    summary: 'List all purchase orders (Admin endpoint - no auth required)',
    description: 'Retrieve paginated list of purchase orders with user and content information'
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 20)' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by order status (paid, pending, failed)' })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  async getAllOrders(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
  ) {
    return this.adminPurchasesService.getAllOrders(
      parseInt(page),
      parseInt(limit),
      status,
    );
  }

  @Get('orders/:id')
  @ApiOperation({
    summary: 'Get order by ID (Admin endpoint - no auth required)',
    description: 'Retrieve detailed information about a specific order'
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
    summary: 'Get purchase statistics (Admin endpoint - no auth required)',
    description: 'Retrieve overall statistics about purchases and revenue'
  })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getOrderStats() {
    return this.adminPurchasesService.getOrderStats();
  }
}