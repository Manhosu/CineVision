import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import {
  HomepageCarouselsService,
  UpdateCarouselDto,
  CreateCarouselDto,
  ReorderItem,
} from '../services/homepage-carousels.service';

@ApiTags('Admin - Homepage')
@ApiBearerAuth()
@Controller('admin/homepage')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminHomepageController {
  constructor(private readonly carouselsService: HomepageCarouselsService) {}

  @Get('carousels')
  @ApiOperation({ summary: 'Get all homepage carousels (including hidden)' })
  @ApiResponse({ status: 200, description: 'Carousels retrieved successfully' })
  @HttpCode(HttpStatus.OK)
  async findAll() {
    return this.carouselsService.findAll();
  }

  @Put('carousels/:id')
  @ApiOperation({ summary: 'Update a homepage carousel' })
  @ApiParam({ name: 'id', description: 'Carousel UUID' })
  @ApiResponse({ status: 200, description: 'Carousel updated successfully' })
  @HttpCode(HttpStatus.OK)
  async update(@Param('id') id: string, @Body() body: UpdateCarouselDto) {
    return this.carouselsService.update(id, body);
  }

  @Post('carousels')
  @ApiOperation({ summary: 'Create a new manual carousel' })
  @ApiResponse({ status: 201, description: 'Carousel created successfully' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: CreateCarouselDto) {
    return this.carouselsService.create(body);
  }

  @Delete('carousels/:id')
  @ApiOperation({ summary: 'Delete a manual carousel' })
  @ApiParam({ name: 'id', description: 'Carousel UUID' })
  @ApiResponse({ status: 204, description: 'Carousel deleted successfully' })
  @ApiResponse({ status: 400, description: 'Only manual carousels can be deleted' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.carouselsService.delete(id);
  }

  @Post('carousels/reorder')
  @ApiOperation({ summary: 'Batch update display_order for carousels' })
  @ApiResponse({ status: 200, description: 'Carousels reordered successfully' })
  @HttpCode(HttpStatus.OK)
  async reorder(@Body() body: { items: ReorderItem[] }) {
    await this.carouselsService.reorder(body.items);
    return { success: true };
  }
}
