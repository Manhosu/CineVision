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
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('discounts')
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  // ─── Admin Endpoints (require ADMIN role) ─────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async create(@Body() data: CreateDiscountDto) {
    return this.discountsService.create(data);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async update(@Param('id') id: string, @Body() data: UpdateDiscountDto) {
    return this.discountsService.update(id, data);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
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
