import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
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

  // Lista orders órfãs (paga sem telegram_chat_id) — admin only.
  // Usada pelo painel /admin/orphan-orders pra Igor recuperar
  // compras de clientes que pagaram via web sem login.
  @Get('orphan')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List paid orders without Telegram chat link (admin)' })
  async listOrphan(@Query('limit') limit?: string) {
    return this.ordersService.listOrphanOrders(limit ? parseInt(limit, 10) : 100);
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

  // Salva o WhatsApp do comprador na order. Chamado pela tela de
  // sucesso do checkout quando a compra é órfã (paga via web sem
  // login). O admin usa esse número no painel de órfãs pra recuperar
  // a venda via wa.me. Sem auth — quem tem o token tem permissão.
  @Post('token/:token/whatsapp')
  @ApiOperation({ summary: 'Save customer WhatsApp on a paid order' })
  async setWhatsapp(
    @Param('token') token: string,
    @Body() body: { whatsapp: string },
  ) {
    return this.ordersService.setCustomerWhatsapp(token, body.whatsapp);
  }
}
