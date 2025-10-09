import {
  Controller,
  Get,
  Post,
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
  ApiBody,
} from '@nestjs/swagger';
import { RequestsService } from './requests.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import {
  CreateContentRequestDto,
  UpdateContentRequestDto,
  ContentRequestResponseDto,
} from './dto';
import { RequestStatus } from './entities/content-request.entity';

@ApiTags('requests')
@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  @UseGuards(OptionalAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create new content request',
    description: 'Submit a new content request. Can be called by authenticated users or via Telegram bot.',
  })
  @ApiBody({ type: CreateContentRequestDto })
  @ApiResponse({
    status: 201,
    description: 'Content request created successfully',
    type: ContentRequestResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request data or duplicate request' })
  async createRequest(
    @Body(ValidationPipe) dto: CreateContentRequestDto,
    @GetUser() user?: any,
  ): Promise<ContentRequestResponseDto> {
    // If user is authenticated, add their user ID
    if (user && user.sub) {
      dto.user_id = user.sub;
    }

    return this.requestsService.createRequest(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
    schema: {
      type: 'object',
      properties: {
        requests: {
          type: 'array',
          items: { $ref: '#/components/schemas/ContentRequestResponseDto' },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' },
            hasNext: { type: 'boolean' },
            hasPrev: { type: 'boolean' },
          },
        },
      },
    },
  })
  async getAllRequests(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: RequestStatus,
  ) {
    return this.requestsService.findAllRequests(Number(page), Number(limit), status);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get request statistics',
    description: 'Get statistics about content requests. Admin access required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Request statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        pending: { type: 'number' },
        approved: { type: 'number' },
        rejected: { type: 'number' },
        total: { type: 'number' },
      },
    },
  })
  async getRequestStats() {
    return this.requestsService.getRequestStats();
  }

  @Get('my-requests')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user\'s requests',
    description: 'Retrieve all content requests made by the authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'User requests retrieved successfully',
    type: [ContentRequestResponseDto],
  })
  async getMyRequests(@GetUser() user: any): Promise<ContentRequestResponseDto[]> {
    return this.requestsService.findRequestsByUser(user.sub);
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user requests by ID',
    description: 'Retrieve all content requests made by a specific user.',
  })
  @ApiResponse({
    status: 200,
    description: 'User requests retrieved successfully',
    type: [ContentRequestResponseDto],
  })
  async getUserRequests(@Param('userId') userId: string): Promise<ContentRequestResponseDto[]> {
    return this.requestsService.findRequestsByUser(userId);
  }

  @Get('telegram/:telegramId')
  @ApiOperation({
    summary: 'Get requests by Telegram ID',
    description: 'Retrieve all content requests made by a specific Telegram user. For bot use.',
  })
  @ApiResponse({
    status: 200,
    description: 'Telegram user requests retrieved successfully',
    type: [ContentRequestResponseDto],
  })
  async getRequestsByTelegramId(
    @Param('telegramId') telegramId: string,
  ): Promise<ContentRequestResponseDto[]> {
    return this.requestsService.findRequestsByTelegramId(telegramId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update content request',
    description: 'Update a content request status and notes. Admin access required.',
  })
  @ApiBody({ type: UpdateContentRequestDto })
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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