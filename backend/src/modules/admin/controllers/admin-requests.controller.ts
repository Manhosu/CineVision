import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { RequestsService } from '../../requests/requests.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UpdateContentRequestDto, ContentRequestResponseDto } from '../../requests/dto';
import { RequestStatus } from '../../requests/entities/content-request.entity';

@ApiTags('Admin - Requests')
@Controller('admin/requests')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AdminRequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all content requests',
    description: 'Retrieve paginated list of content requests. Admin access required.',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', example: 20 })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status',
    enum: RequestStatus
  })
  @ApiResponse({
    status: 200,
    description: 'Content requests retrieved successfully',
  })
  async getAllRequests(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: RequestStatus,
  ) {
    return this.requestsService.findAllRequests(Number(page), Number(limit), status);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get request statistics',
    description: 'Get statistics about content requests. Admin access required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Request statistics retrieved successfully',
  })
  async getRequestStats() {
    return this.requestsService.getRequestStats();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get content request by ID',
    description: 'Retrieve a specific content request by its ID. Admin access required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Content request retrieved successfully',
    type: ContentRequestResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async getRequest(@Param('id') id: string): Promise<ContentRequestResponseDto> {
    return this.requestsService.findRequestById(id);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update content request',
    description: 'Update a content request status and notes. Admin access required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Content request updated successfully',
    type: ContentRequestResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async updateRequest(
    @Param('id') id: string,
    @Body(ValidationPipe) dto: UpdateContentRequestDto,
  ): Promise<ContentRequestResponseDto> {
    return this.requestsService.updateRequest(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete content request',
    description: 'Delete a content request. Admin access required.',
  })
  @ApiResponse({ status: 204, description: 'Content request deleted successfully' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async deleteRequest(@Param('id') id: string): Promise<void> {
    return this.requestsService.deleteRequest(id);
  }
}
