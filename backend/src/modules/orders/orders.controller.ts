import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
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

  // Endpoint chamado pelo bot quando alguém clica
  // t.me/cinevisionv2bot?start=order_TOKEN. Linka uma order paga
  // mas órfã (sem telegram_chat_id) ao chat de quem chegou via deep
  // link e dispara a entrega. Sem auth — o bot é o caller.
  @Post('token/:token/claim')
  @ApiOperation({ summary: 'Claim a paid orphan order via Telegram deep-link' })
  async claimOrphan(
    @Param('token') token: string,
    @Body() body: { telegram_chat_id: string; user_id?: string },
  ) {
    return this.ordersService.claimOrphanOrder(
      token,
      body.telegram_chat_id,
      body.user_id,
    );
  }
}
