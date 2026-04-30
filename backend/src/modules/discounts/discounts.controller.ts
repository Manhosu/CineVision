import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { DiscountsService, CreateDiscountDto, UpdateDiscountDto } from './discounts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';

@Controller('discounts')
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  // ─── Admin Endpoints (require ADMIN role) ─────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('can_manage_discounts')
  @ApiBearerAuth()
  async create(@Body() data: CreateDiscountDto) {
    return this.discountsService.create(data);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('can_manage_discounts')
  @ApiBearerAuth()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.discountsService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('can_manage_discounts')
  @ApiBearerAuth()
  async update(@Param('id') id: string, @Body() data: UpdateDiscountDto) {
    return this.discountsService.update(id, data);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('can_manage_discounts')
  @ApiBearerAuth()
  async delete(@Param('id') id: string) {
    await this.discountsService.delete(id);
    return { success: true, message: 'Discount deactivated' };
  }

  // ─── Public Endpoints ──────────────────────────────────────────

  @Get('active')
  async findActive() {
    return this.discountsService.findActiveDiscounts();
  }

  @Get('flash')
  async findFlash() {
    return this.discountsService.findActiveFlashPromotions();
  }

  @Get('content/:contentId')
  async getDiscountForContent(@Param('contentId') contentId: string) {
    const discount = await this.discountsService.getDiscountForContent(contentId);
    if (!discount) {
      return { discount: null };
    }
    return { discount };
  }
}
