import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('token/:token')
  @ApiOperation({ summary: 'Get order details by token (for bot / success page)' })
  async getByToken(@Param('token') token: string) {
    return this.ordersService.findByToken(token);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List authenticated user orders' })
  async listMine(@GetUser() user: any) {
    return this.ordersService.findByUser(user.sub);
  }
}
