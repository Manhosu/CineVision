import {
  Controller,
  Get,
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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { FavoritesService } from '../services/favorites.service';
import { AddFavoriteDto, FavoriteResponseDto } from '../dto/favorite.dto';

@ApiTags('User Favorites')
@Controller('favorites')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all user favorites',
    description: 'Retrieve all content favorited by the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Favorites retrieved successfully',
    type: [FavoriteResponseDto],
  })
  async getUserFavorites(@GetUser() user: any): Promise<FavoriteResponseDto[]> {
    return this.favoritesService.getUserFavorites(user.sub);
  }

  @Post()
  @ApiOperation({
    summary: 'Add content to favorites',
    description: 'Add a movie or series to user favorites list',
  })
  @ApiResponse({
    status: 201,
    description: 'Content added to favorites successfully',
    type: FavoriteResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Already in favorites' })
  @ApiResponse({ status: 404, description: 'Content not found' })
  async addFavorite(
    @Body() dto: AddFavoriteDto,
    @GetUser() user: any,
  ): Promise<FavoriteResponseDto> {
    return this.favoritesService.addFavorite(user.sub, dto.content_id);
  }

  @Delete(':content_id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove content from favorites',
    description: 'Remove a movie or series from user favorites list',
  })
  @ApiResponse({
    status: 204,
    description: 'Content removed from favorites successfully',
  })
  @ApiResponse({ status: 404, description: 'Favorite not found' })
  async removeFavorite(
    @Param('content_id') content_id: string,
    @GetUser() user: any,
  ): Promise<void> {
    await this.favoritesService.removeFavorite(user.sub, content_id);
  }

  @Get('check/:content_id')
  @ApiOperation({
    summary: 'Check if content is favorited',
    description: 'Check if a specific content is in user favorites',
  })
  @ApiResponse({
    status: 200,
    description: 'Favorite status retrieved',
    schema: {
      type: 'object',
      properties: {
        isFavorite: { type: 'boolean' },
      },
    },
  })
  async checkFavorite(
    @Param('content_id') content_id: string,
    @GetUser() user: any,
  ): Promise<{ isFavorite: boolean }> {
    const isFavorite = await this.favoritesService.isFavorite(user.sub, content_id);
    return { isFavorite };
  }
}
