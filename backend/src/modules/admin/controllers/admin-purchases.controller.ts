import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  SetMetadata,
} from '@nestjs/common';
import { AdminPurchasesSimpleService } from '../services/admin-purchases-simple.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { User } from '../../users/entities/user.entity';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';

@ApiTags('Admin Purchases')
@Controller('admin/purchases')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AdminPurchasesController {
  constructor(private readonly adminPurchasesService: AdminPurchasesSimpleService) {}

  @Get('orders')
  @ApiOperation({ 
    summary: 'List all purchase orders',
    description: 'Retrieve paginated list of purchase orders with optional status filtering'
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 20)' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by order status (paid, pending, failed)' })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  async getAllOrders(
    @GetUser() user: User,
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
    summary: 'Get order by ID',
    description: 'Retrieve detailed information about a specific order'
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrderById(
    @GetUser() user: User,
    @Param('id') orderId: string,
  ) {
    return this.adminPurchasesService.getOrderById(orderId);
  }

  @Get('stats')
  @ApiOperation({ 
    summary: 'Get purchase statistics',
    description: 'Retrieve overall statistics about purchases and revenue'
  })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getOrderStats(
    @GetUser() user: User,
  ) {
    return this.adminPurchasesService.getOrderStats();
  }


}