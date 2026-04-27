import { Controller, Get, Put, Delete, Post, Param, Query, Body, ValidationPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RequestsSupabaseService } from '../../requests/requests-supabase.service';
import { UpdateContentRequestDto } from '../../requests/dto';
import { RequestStatus } from '../../requests/entities/content-request.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';

@ApiTags('admin-requests')
@ApiBearerAuth()
@Controller('admin/requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminRequestsPublicController {
  constructor(private readonly requestsService: RequestsSupabaseService) {}

  @Get()
  @ApiOperation({ summary: 'Get all content requests' })
  async getAllRequests(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: RequestStatus,
  ) {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    return this.requestsService.findAllRequests(pageNum, limitNum, status);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get request statistics' })
  async getStats() {
    return this.requestsService.getRequestStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get content request by ID' })
  async getRequest(@Param('id') id: string) {
    return this.requestsService.findRequestById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update content request' })
  async updateRequest(
    @Param('id') id: string,
    @Body(ValidationPipe) dto: UpdateContentRequestDto,
  ) {
    return this.requestsService.updateRequest(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete content request' })
  async deleteRequest(@Param('id') id: string) {
    await this.requestsService.deleteRequest(id);
    return { message: 'Request deleted successfully', id };
  }
}
