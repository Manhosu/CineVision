import { Controller, Get, Delete, Param, Query, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { ContentService } from './content.service';

@ApiTags('content')
@Controller('content')
export class ContentController {
  constructor(
    private readonly contentService: ContentService,
  ) {}

  @Get('movies')
  @ApiOperation({ summary: 'Get all movies' })
  @ApiQuery({ name: 'page', description: 'Page number', required: false, type: Number })
  @ApiQuery({ name: 'limit', description: 'Items per page', required: false, type: Number })
  @ApiQuery({ name: 'genre', description: 'Filter by genre', required: false, type: String })
  @ApiQuery({ name: 'search', description: 'Search movies by title', required: false, type: String })
  @ApiQuery({ name: 'sort', description: 'Sort order', required: false, enum: ['newest', 'popular', 'rating', 'price_low', 'price_high'] })
  @ApiResponse({ status: 200, description: 'Movies retrieved successfully' })
  async getMovies(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('genre') genre?: string,
    @Query('search') search?: string,
    @Query('sort') sort = 'newest',
  ) {
    return this.contentService.findAllMovies(Number(page), Number(limit), genre, sort, search);
  }

  @Get('movies/:id')
  @ApiOperation({ summary: 'Get movie by ID' })
  @ApiResponse({ status: 200, description: 'Movie retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Movie not found' })
  async getMovie(@Param('id') id: string) {
    return this.contentService.findMovieById(id);
  }

  /**
   * Igor (11/07): rota agnóstica de tipo pra painel admin buscar
   * content por UUID quando não sabe se é movie/series/novelinha
   * (usado pra renderizar poster do filme vinculado nos cards de
   * bot promocional em /admin/bots).
   */
  @Get('by-id/:id')
  @ApiOperation({ summary: 'Get content by ID (agnostic of type)' })
  async getContentById(@Param('id') id: string) {
    // Tenta movie, series e novelinha em cascata — retorna o que achar
    const movie = await this.contentService.findMovieById(id).catch(() => null);
    if (movie) return movie;
    const series = await this.contentService.findSeriesById(id).catch(() => null);
    if (series) return series;
    return this.contentService.findNovelinhaById(id).catch(() => null);
  }

  @Get('series/:id')
  @ApiOperation({ summary: 'Get series by ID' })
  @ApiResponse({ status: 200, description: 'Series retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Series not found' })
  async getSeriesById(@Param('id') id: string) {
    return this.contentService.findSeriesById(id);
  }

  @Get('series')
  @ApiOperation({ summary: 'Get all series' })
  @ApiQuery({ name: 'page', description: 'Page number', required: false, type: Number })
  @ApiQuery({ name: 'limit', description: 'Items per page', required: false, type: Number })
  @ApiQuery({ name: 'genre', description: 'Filter by genre', required: false, type: String })
  @ApiQuery({ name: 'search', description: 'Search series by title', required: false, type: String })
  @ApiQuery({ name: 'sort', description: 'Sort order', required: false, enum: ['newest', 'popular', 'rating', 'price_low', 'price_high'] })
  @ApiResponse({ status: 200, description: 'Series retrieved successfully' })
  async getAllSeries(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('genre') genre?: string,
    @Query('search') search?: string,
    @Query('sort') sort = 'newest',
  ) {
    return this.contentService.findAllSeries(Number(page), Number(limit), genre, sort, search);
  }

  // Igor (16/05): catálogo público de novelinhas (minisséries verticais).
  @Get('novelinhas')
  @ApiOperation({ summary: 'Get all novelinhas (vertical mini-series)' })
  @ApiQuery({ name: 'page', description: 'Page number', required: false, type: Number })
  @ApiQuery({ name: 'limit', description: 'Items per page', required: false, type: Number })
  @ApiQuery({ name: 'genre', description: 'Filter by genre', required: false, type: String })
  @ApiQuery({ name: 'search', description: 'Search by title', required: false, type: String })
  @ApiQuery({ name: 'sort', description: 'Sort order', required: false, enum: ['newest', 'popular', 'rating', 'price_low', 'price_high'] })
  @ApiResponse({ status: 200, description: 'Novelinhas retrieved successfully' })
  async getAllNovelinhas(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('genre') genre?: string,
    @Query('search') search?: string,
    @Query('sort') sort = 'newest',
  ) {
    return this.contentService.findAllNovelinhas(Number(page), Number(limit), genre, sort, search);
  }

  // Igor (24/05): detalhe de novelinha. Antes não existia rota → o card caía
  // em /movies/:id e dava 404. findSeriesById é genérico (retorna qualquer
  // conteúdo publicado pelo id, independente do content_type).
  @Get('novelinhas/:id')
  @ApiOperation({ summary: 'Get novelinha by ID' })
  @ApiResponse({ status: 200, description: 'Novelinha retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Novelinha not found' })
  async getNovelinhaById(@Param('id') id: string) {
    return this.contentService.findNovelinhaById(id);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all categories' })
  @ApiResponse({ status: 200, description: 'Categories retrieved successfully' })
  async getCategories() {
    return this.contentService.findAllCategories();
  }

  @Get('top10/films')
  @ApiOperation({ summary: 'Get Top 10 films of the week' })
  @ApiResponse({ status: 200, description: 'Top 10 films retrieved successfully' })
  async getTop10Films() {
    return this.contentService.findTop10Films();
  }

  @Get('top10/series')
  @ApiOperation({ summary: 'Get Top 10 series of the week' })
  @ApiResponse({ status: 200, description: 'Top 10 series retrieved successfully' })
  async getTop10Series() {
    return this.contentService.findTop10Series();
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured content for homepage banner' })
  @ApiQuery({ name: 'limit', description: 'Maximum number of featured items', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Featured content retrieved successfully' })
  async getFeaturedContent(@Query('limit') limit = 10) {
    return this.contentService.findFeaturedContent(Number(limit));
  }

  @Get('releases')
  @ApiOperation({ summary: 'Get content marked as releases' })
  @ApiQuery({ name: 'limit', description: 'Maximum number of releases', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Releases retrieved successfully' })
  async getReleases(@Query('limit') limit = 20) {
    console.log('[ContentController] Getting releases with limit:', limit);
    return this.contentService.findReleases(Number(limit));
  }

  @Get('movies/related/:id')
  @ApiOperation({ summary: 'Get related movies' })
  @ApiParam({ name: 'id', description: 'Movie ID' })
  @ApiQuery({ name: 'genres', description: 'Comma-separated genres', required: false, type: String })
  @ApiQuery({ name: 'limit', description: 'Number of related movies', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Related movies retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Movie not found' })
  async getRelatedMovies(
    @Param('id') movieId: string,
    @Query('genres') genres?: string,
    @Query('limit') limit = 6,
  ) {
    const genreArray = genres ? genres.split(',').map(g => g.trim()) : [];
    return this.contentService.findRelatedMovies(movieId, genreArray, Number(limit));
  }

  @Get('series/:id/episodes')
  @ApiOperation({ summary: 'Get all episodes for a series' })
  @ApiParam({ name: 'id', description: 'Series ID' })
  @ApiQuery({ name: 'season', description: 'Filter by season number', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Episodes retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Series not found' })
  async getSeriesEpisodes(
    @Param('id') seriesId: string,
    @Query('season') season?: number,
  ) {
    return this.contentService.findSeriesEpisodes(seriesId, season ? Number(season) : undefined);
  }

  // Eduardo (15/07): REMOVIDOS os endpoints DELETE /movies/all e /all.
  // Estavam sem @UseGuards nem @Roles — 1 curl anônimo zerava o catálogo
  // inteiro (`.from('content').delete()` em massa). Se algum dia precisar
  // de reset admin, criar em AdminController com JwtAuthGuard + RolesGuard(ADMIN)
  // + confirmação por senha. Métodos deleteAllMovies/deleteAllContent no
  // service continuam existindo mas não têm mais caller.

  @Get('people/:id')
  @ApiOperation({ summary: 'Get person (actor/director) with their content' })
  async getPersonWithContent(@Param('id') id: string) {
    return this.contentService.findPersonWithContent(id);
  }

  @Get('homepage')
  @ApiOperation({ summary: 'Get homepage carousels with populated content' })
  @ApiResponse({ status: 200, description: 'Homepage carousel data retrieved successfully' })
  async getHomepageData() {
    return this.contentService.getHomepageData();
  }
}