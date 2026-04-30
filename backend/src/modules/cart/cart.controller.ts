import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ValidationPipe,
  Inject,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { CartService, CartDiscountTier } from './cart.service';
import { AddCartItemDto, CheckoutCartDto } from './dto';

@ApiTags('cart')
@Controller('cart')
export class CartController {
  constructor(
    private readonly cartService: CartService,
    @Inject('OrdersService') private readonly ordersService: any,
  ) {}

  @Get()
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get current cart with items and discount preview' })
  async getCart(@GetUser() user: any, @Query('session_id') sessionId?: string) {
    const userId = user?.sub;
    return this.cartService.getCartWithItems(userId, sessionId);
  }

  @Get('discount-preview')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get discount preview for current cart' })
  async getPreview(@GetUser() user: any, @Query('session_id') sessionId?: string) {
    return this.cartService.getDiscountPreview(user?.sub, sessionId);
  }

  @Get('discount-tiers')
  @ApiOperation({ summary: 'Get configured discount tiers (public read)' })
  async getTiers() {
    const tiers = await this.cartService.getDiscountTiers();
    return { tiers };
  }

  @Post('items')
  @UseGuards(OptionalAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add item to cart' })
  async addItem(
    @Body(ValidationPipe) dto: AddCartItemDto,
    @GetUser() user: any,
  ) {
    return this.cartService.addItem(
      dto.content_id,
      user?.sub,
      dto.session_id,
      dto.business_connection_id,
    );
  }

  @Delete('items/:contentId')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Remove item from cart' })
  async removeItem(
    @Param('contentId') contentId: string,
    @GetUser() user: any,
    @Query('session_id') sessionId?: string,
  ) {
    return this.cartService.removeItem(contentId, user?.sub, sessionId);
  }

  @Delete()
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Clear the entire cart' })
  async clearCart(@GetUser() user: any, @Query('session_id') sessionId?: string) {
    return this.cartService.clearCart(user?.sub, sessionId);
  }

  @Post('checkout')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Checkout cart and create an aggregated order' })
  async checkout(
    @Body(ValidationPipe) dto: CheckoutCartDto,
    @GetUser() user: any,
  ) {
    return this.ordersService.createOrderFromCart({
      userId: user?.sub,
      sessionId: dto.session_id,
      preferredDelivery: dto.preferred_delivery,
      telegramChatId: dto.telegram_chat_id,
    });
  }
}

@ApiTags('admin-cart-settings')
@Controller('admin/cart')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class CartSettingsController {
  constructor(private readonly cartService: CartService) {}

  @Get('discount-tiers')
  @ApiOperation({ summary: 'Get configured cart discount tiers' })
  async getTiers() {
    return { tiers: await this.cartService.getDiscountTiers() };
  }

  @Put('discount-tiers')
  @ApiOperation({ summary: 'Update cart discount tiers (replaces all)' })
  async setTiers(@Body() body: { tiers: CartDiscountTier[] }) {
    await this.cartService.setDiscountTiers(body.tiers || []);
    return { ok: true, tiers: await this.cartService.getDiscountTiers() };
  }
}
