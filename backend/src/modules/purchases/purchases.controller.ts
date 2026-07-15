import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  Inject,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import {
  InitiatePurchaseDto,
  InitiatePurchaseResponseDto,
  PaymentWebhookDto,
  PaymentWebhookResponseDto,
} from './dto';

@ApiTags('purchases')
@Controller('purchases')
export class PurchasesController {
  constructor(@Inject('PurchasesService') private readonly purchasesService: any) {}

  @Post('initiate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Initiate new purchase',
    description: 'Creates a pending purchase and returns Telegram deep link',
  })
  @ApiBody({ type: InitiatePurchaseDto })
  @ApiResponse({
    status: 201,
    description: 'Purchase initiated successfully',
    type: InitiatePurchaseResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Content not found' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  async initiatePurchase(
    @Body(ValidationPipe) dto: InitiatePurchaseDto,
  ): Promise<InitiatePurchaseResponseDto> {
    return this.purchasesService.initiatePurchase(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get authenticated user purchases' })
  @ApiResponse({ status: 200, description: 'Purchases retrieved successfully' })
  async getUserPurchases(@GetUser() user: any) {
    return this.purchasesService.findByUserId(user.sub);
  }

  @Get('token/:token')
  @ApiOperation({
    summary: 'Get purchase by token',
    description: 'Used by Telegram bot to retrieve purchase details',
  })
  @ApiResponse({ status: 200, description: 'Purchase found' })
  @ApiResponse({ status: 404, description: 'Purchase not found' })
  async getPurchaseByToken(@Param('token') token: string) {
    const purchase = await this.purchasesService.findByPurchaseToken(token);
    if (!purchase) {
      throw new Error('Purchase not found');
    }
    return purchase;
  }

  @Get('verify-access/:token')
  @ApiOperation({
    summary: 'Verify access token',
    description: 'Verifies if an access token is valid and returns content access information',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Token is valid',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
        content_id: { type: 'string' },
        purchase_id: { type: 'string' },
        user_id: { type: 'string' },
        expires_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyAccessToken(@Param('token') token: string) {
    const payload = await this.purchasesService.verifyAccessToken(token);
    return {
      valid: true,
      content_id: payload.content_id,
      purchase_id: payload.purchase_id,
      user_id: payload.sub,
      expires_at: new Date(payload.exp * 1000).toISOString(),
    };
  }

  @Get('progress/:contentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get watch progress for content' })
  @ApiResponse({ status: 200, description: 'Watch progress retrieved successfully' })
  async getWatchProgress(@Param('contentId') contentId: string, @GetUser() user: any) {
    return this.purchasesService.getWatchProgress(user.sub, contentId);
  }

  @Post('progress/:contentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update watch progress for content' })
  @ApiResponse({ status: 200, description: 'Watch progress updated successfully' })
  async updateWatchProgress(
    @Param('contentId') contentId: string,
    @Body() body: { progress_seconds: number; total_duration_seconds: number },
    @GetUser() user: any
  ) {
    return this.purchasesService.updateWatchProgress(
      user.sub,
      contentId,
      body.progress_seconds,
      body.total_duration_seconds
    );
  }

  // Eduardo (15/07): ADICIONADO ownership check nas 3 rotas /user/:userId*.
  // ANTES qualquer authed user chamava com userId de outro cliente e
  // recebia lista + access_token de streaming (JWT 24h). IDOR clássico
  // + vazamento de credencial que dava acesso ao vídeo alheio.
  // Agora: se userId != user.sub e user não é admin/employee → 403.
  private assertUserOwnership(userId: string, user: any): void {
    if (!user?.sub) throw new ForbiddenException();
    if (userId === user.sub) return;
    const role = String(user.role || '').toLowerCase();
    if (role === 'admin' || role === 'master' || role === 'employee') return;
    throw new ForbiddenException('Cannot access another user purchases');
  }

  @Get('user/:userId/content')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user purchased content list' })
  @ApiResponse({ status: 200, description: 'User content list retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Cannot access another user purchases' })
  async getUserContent(@Param('userId') userId: string, @GetUser() user: any) {
    this.assertUserOwnership(userId, user);
    return this.purchasesService.findUserContentList(userId);
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user purchase history' })
  @ApiResponse({ status: 200, description: 'User purchases retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Cannot access another user purchases' })
  async getUserPurchaseHistory(@Param('userId') userId: string, @GetUser() user: any) {
    this.assertUserOwnership(userId, user);
    return this.purchasesService.findByUserId(userId);
  }

  @Get('user/:userId/grouped')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get purchase history grouped by order' })
  @ApiResponse({ status: 200, description: 'Grouped purchase history retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Cannot access another user purchases' })
  async getUserPurchaseHistoryGrouped(@Param('userId') userId: string, @GetUser() user: any) {
    this.assertUserOwnership(userId, user);
    return this.purchasesService.findGroupedByOrder(userId);
  }

  @Get('check/:contentId')
  @ApiOperation({ summary: 'Check if user owns content' })
  @ApiResponse({ status: 200, description: 'Ownership check completed' })
  async checkOwnership(
    @Param('contentId') contentId: string,
    @GetUser() user?: any
  ) {
    // Return false if user is not authenticated
    if (!user || !user.sub) {
      return { isOwned: false };
    }

    const isOwned = await this.purchasesService.checkUserOwnership(user.sub, contentId);
    return { isOwned };
  }

  // Eduardo (15/07): ADICIONADO JwtAuthGuard + ownership check.
  // ANTES completamente público — telegramId é numérico e enumerável
  // (9-10 dígitos). Attacker fazia curl /purchases/telegram/<qualquer>
  // e recebia purchases + access_token (JWT streaming 24h) do dono.
  // Agora: exige auth E o telegram_id do JWT bate com o param
  // (ou role admin/employee).
  @Get('telegram/:telegramId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get purchases by Telegram ID (owner-only)',
    description: 'Retrieve all purchases made by a specific Telegram user. Requires auth + ownership match.',
  })
  @ApiResponse({ status: 200, description: 'User purchases retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Cannot access another Telegram user purchases' })
  async getPurchasesByTelegramId(@Param('telegramId') telegramId: string, @GetUser() user: any) {
    const role = String(user?.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'master' || role === 'employee';
    if (!isAdmin && String(user?.telegram_id || '') !== String(telegramId)) {
      throw new ForbiddenException('Cannot access another Telegram user purchases');
    }
    return this.purchasesService.findByTelegramId(telegramId);
  }

  // Eduardo (15/07): busca a purchase primeiro pra checar ownership.
  // ANTES qualquer authed user acessava purchase pelo id (UUID) — devolvia
  // dados sensíveis (access_token) de compra alheia.
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get purchase by ID (owner-only)' })
  @ApiResponse({ status: 200, description: 'Purchase retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Not your purchase' })
  @ApiResponse({ status: 404, description: 'Purchase not found' })
  async getPurchase(@Param('id') id: string, @GetUser() user: any) {
    const purchase = await this.purchasesService.findById(id);
    if (purchase && (purchase as any).user_id) {
      this.assertUserOwnership((purchase as any).user_id, user);
    }
    return purchase;
  }
}