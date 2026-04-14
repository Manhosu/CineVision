import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { DiscountsService, CreateDiscountDto, UpdateDiscountDto } from './discounts.service';

@Controller('discounts')
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  // ─── Admin Endpoints ───────────────────────────────────────────

  @Post()
  async create(@Body() data: CreateDiscountDto) {
    return this.discountsService.create(data);
  }

  @Get()
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
  async update(@Param('id') id: string, @Body() data: UpdateDiscountDto) {
    return this.discountsService.update(id, data);
  }

  @Delete(':id')
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
