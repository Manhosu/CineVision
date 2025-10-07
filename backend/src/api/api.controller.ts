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
import { RequestsService } from '../modules/requests/requests.service';
import { PurchasesService } from '../modules/purchases/purchases.service';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../modules/auth/guards/optional-auth.guard';
import { GetUser } from '../modules/auth/decorators/get-user.decorator';
import {
  CreateContentRequestDto,
  UpdateContentRequestDto,
  ContentRequestResponseDto,
} from '../modules/requests/dto';

@ApiTags('api')
@Controller('api')
export class ApiController {
  constructor(
    private readonly requestsService: RequestsService,
    private readonly purchasesService: PurchasesService,
  ) {}

  // Requests endpoints with /api/ prefix for bot compatibility
  @Post('requests')
  @UseGuards(OptionalAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create new content request (Bot API)',
    description: 'Submit a new content request via /api/ endpoint for bot compatibility.',
  })
  @ApiBody({ type: CreateContentRequestDto })
  @ApiResponse({
    status: 201,
    description: 'Content request created successfully',
    type: ContentRequestResponseDto,
  })
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

  @Get('requests')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all content requests (Bot API)',
    description: 'Retrieve paginated list of content requests via /api/ endpoint.',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getAllRequests(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.requestsService.findAllRequests(Number(page), Number(limit));
  }

  // Purchases endpoints with /api/ prefix for bot compatibility
  @Get('purchases/user/:telegramId')
  @ApiOperation({
    summary: 'Get purchases by Telegram ID (Bot API)',
    description: 'Retrieve all purchases made by a specific Telegram user via /api/ endpoint.',
  })
  @ApiResponse({ status: 200, description: 'User purchases retrieved successfully' })
  async getPurchasesByTelegramId(@Param('telegramId') telegramId: string) {
    return this.purchasesService.findByTelegramId(telegramId);
  }

  @Get('purchases/:id')
  @ApiOperation({
    summary: 'Get purchase by ID (Bot API)',
    description: 'Retrieve a specific purchase by ID via /api/ endpoint.',
  })
  @ApiResponse({ status: 200, description: 'Purchase retrieved successfully' })
  async getPurchase(@Param('id') id: string) {
    return this.purchasesService.findById(id);
  }
}