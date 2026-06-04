import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../../auth/guards/optional-auth.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { User, UserRole } from '../../users/entities/user.entity';
import { AdminContentSimpleService } from '../services/admin-content-simple.service';
import { EmployeesService } from '../../employees/employees.service';
import { ContentEditRequestsService } from '../../content-edit-requests/content-edit-requests.service';
import { HomepageCarouselsService } from '../services/homepage-carousels.service';
import { TelegramsEnhancedService } from '../../telegrams/telegrams-enhanced.service';
import { SupabaseService } from '../../../config/supabase.service';
import {
  CreateContentDto,
  InitiateUploadDto,
  CompleteUploadDto,
  PublishContentDto,
  CreateSeriesDto,
  CreateEpisodeDto,
} from '../dto/create-content.dto';

@ApiTags('Admin - Content Management')
@Controller('admin/content')
@ApiBearerAuth()
export class AdminContentController {
  constructor(
    private readonly adminContentService: AdminContentSimpleService,
    private readonly employeesService: EmployeesService,
    private readonly editRequestsService: ContentEditRequestsService,
    private readonly homepageCarousels: HomepageCarouselsService,
    private readonly telegramsService: TelegramsEnhancedService,
    private readonly supabaseService: SupabaseService,
  ) {
    console.log('AdminContentController loaded successfully');
  }

  // ---------------------------------------------------------------------------
  // Helpers — resolve user role + employee permissions
  // ---------------------------------------------------------------------------
  private async assertCanAddContent(user: any, kind: 'movie' | 'series' | 'novelinha') {
    if (!user) return; // public-mode endpoints (legacy)
    const role = user.role;
    if (role === UserRole.ADMIN || role === UserRole.MODERATOR) return;
    if (role !== UserRole.EMPLOYEE) {
      throw new ForbiddenException('Você não tem permissão para criar conteúdo');
    }
    const perms = await this.employeesService.getPermissions(user.sub || user.id);
    if (!perms) throw new ForbiddenException('Permissões de funcionário não configuradas');
    if (kind === 'movie' && !perms.can_add_movies) {
      throw new ForbiddenException('Funcionário não pode adicionar filmes');
    }
    if (kind === 'series' && !perms.can_add_series) {
      throw new ForbiddenException('Funcionário não pode adicionar séries');
    }
    // Igor (16/05): permissão de novelinhas.
    if (kind === 'novelinha' && !perms.can_add_novelinhas) {
      throw new ForbiddenException('Funcionário não pode adicionar novelinhas');
    }
    await this.employeesService.checkDailyLimitAndIncrement(user.sub || user.id);
  }

  private async assertCanEditContent(user: any, contentId: string) {
    if (!user) return;
    const role = user.role;
    if (role === UserRole.ADMIN || role === UserRole.MODERATOR) return;
    if (role !== UserRole.EMPLOYEE) {
      throw new ForbiddenException('Sem permissão de edição');
    }
    const ok = await this.employeesService.canEditContent(user.sub || user.id, contentId);
    if (!ok) {
      throw new ForbiddenException(
        'Você só pode editar conteúdos que adicionou (dentro da janela permitida)',
      );
    }
  }

  /**
   * Returns the edit capability for the given user on the content.
   * Used by `updateContent` to decide between direct apply vs approval queue.
   */
  private async resolveEditCapability(
    user: any,
    contentId: string,
  ): Promise<'direct' | 'needs_approval' | 'blocked'> {
    if (!user) return 'direct'; // legacy / public mode
    const role = user.role;
    if (role === UserRole.ADMIN || role === UserRole.MODERATOR) return 'direct';
    if (role !== UserRole.EMPLOYEE) return 'blocked';
    return this.employeesService.getEditCapability(user.sub || user.id, contentId);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all content',
    description: 'Retrieves all content for admin management',
  })
  @ApiResponse({
    status: 200,
    description: 'Content retrieved successfully',
  })
  async getAllContent() {
    return this.adminContentService.getAllContent();
  }

  // Igor (26/05): aba "Histórico" mostra os arquivados pra ele poder
  // restaurar se arquivou errado. Endpoint separado pra não poluir a
  // listagem principal.
  @Get('archived')
  @ApiOperation({ summary: 'List archived content', description: 'Conteúdos com status=ARCHIVED' })
  async getArchivedContent() {
    return this.adminContentService.getArchivedContent();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get content by ID',
    description: 'Retrieves a single content item by its ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Content retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Content not found',
  })
  async getContentById(@Param('id') id: string) {
    return this.adminContentService.getContentById(id);
  }

  @Post('create')
  // Igor (14/05): exige auth válido. Antes (OptionalAuthGuard) aceitava
  // request sem token e gravava createdById=null, fazendo conteúdo upado
  // por funcionário virar "sistema" e sumir da contagem de pagamento.
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Create new content (movie/series/documentary)',
    description: 'Creates content in database and automatically generates Stripe Product + Price',
  })
  @ApiResponse({
    status: 201,
    description: 'Content created successfully with Stripe integration',
  })
  @ApiResponse({ status: 400, description: 'Invalid input or Stripe error' })
  async createContent(
    @Body() dto: CreateContentDto,
    @GetUser() user: any,
  ) {
    // Igor (16/05): suporta os 3 tipos — movie, series, novelinha.
    const ct = (dto as any).content_type;
    const kind: 'movie' | 'series' | 'novelinha' =
      ct === 'series' ? 'series' : ct === 'novelinha' ? 'novelinha' : 'movie';
    await this.assertCanAddContent(user, kind);
    return this.adminContentService.createContent(
      dto,
      user?.sub || user?.id || null,
      user?.role || null,
    );
  }

  @Post('initiate-upload')
  @ApiOperation({
    summary: 'Initiate multipart upload for content video file',
    description: 'Generates presigned URLs for S3 multipart upload with validation',
  })
  @ApiResponse({
    status: 200,
    description: 'Upload initiated with presigned URLs for each part',
  })
  async initiateUpload(
    @Body() dto: InitiateUploadDto,
    // @GetUser() user: User, // Temporarily disabled
  ) {
    return this.adminContentService.initiateUpload(dto, null);
  }

  @Post('complete-upload')
  @ApiOperation({
    summary: 'Complete multipart upload and trigger transcoding',
    description: 'Finalizes S3 upload, validates parts, and queues content for HLS transcoding',
  })
  @ApiResponse({
    status: 200,
    description: 'Upload completed, transcoding initiated',
  })
  @HttpCode(HttpStatus.OK)
  async completeUpload(
    @Body() dto: CompleteUploadDto,
    // @GetUser() user: User, // Temporarily disabled
  ) {
    return this.adminContentService.completeUpload(dto, null);
  }

  @Get(':id/status')
  @ApiOperation({
    summary: 'Get content processing status',
    description: 'Returns upload/processing/transcoding status with progress',
  })
  @ApiResponse({
    status: 200,
    description: 'Content status retrieved',
  })
  async getContentStatus(@Param('id') contentId: string) {
    return this.adminContentService.getContentStatus(contentId);
  }

  @Put(':id/publish')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Publish content (make available to users)',
    description: 'Sets content status to PUBLISHED and optionally sends Telegram notifications',
  })
  @ApiResponse({
    status: 200,
    description: 'Content published successfully',
  })
  @HttpCode(HttpStatus.OK)
  async publishContent(
    @Param('id') contentId: string,
    @Body() dto: Omit<PublishContentDto, 'content_id'>,
    @GetUser() user: any,
  ) {
    await this.assertCanEditContent(user, contentId);
    return this.adminContentService.publishContent(
      { content_id: contentId, ...dto },
      user?.sub || user?.id || null,
    );
  }

  // Igor (08/05): aprovacao em batch — Igor verifica varios filmes
  // adicionados pelo Mattheus em segundo monitor, marca checkboxes e
  // aprova todos de uma vez. Antes precisava clicar 1 por 1 e a pagina
  // recarregava cada vez.
  @Post('publish-batch')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Publish multiple contents at once',
    description: 'Itera por uma lista de IDs e publica cada um. Retorna sumario.',
  })
  @HttpCode(HttpStatus.OK)
  async publishContentBatch(
    @Body() body: { content_ids: string[]; notify_users?: boolean },
    @GetUser() user: any,
  ) {
    const ids = Array.isArray(body?.content_ids) ? body.content_ids : [];
    if (ids.length === 0) {
      throw new BadRequestException('content_ids vazio');
    }
    if (ids.length > 100) {
      throw new BadRequestException('Maximo 100 ids por batch');
    }

    const userId = user?.sub || user?.id || null;
    const published: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const contentId of ids) {
      try {
        await this.assertCanEditContent(user, contentId);
        await this.adminContentService.publishContent(
          { content_id: contentId, notify_users: body?.notify_users },
          userId,
        );
        published.push(contentId);
      } catch (err: any) {
        failed.push({ id: contentId, error: err?.message || 'unknown' });
      }
    }

    return {
      published_count: published.length,
      failed_count: failed.length,
      published,
      failed,
    };
  }

  // Series Management Endpoints

  @Post('series/create')
  // Igor (14/05): mesma correção do POST /create — auth obrigatório.
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Create new TV series',
    description: 'Creates series with optional per-series or per-episode pricing',
  })
  @ApiResponse({
    status: 201,
    description: 'Series created successfully',
  })
  async createSeries(
    @Body() dto: CreateSeriesDto,
    @GetUser() user: any,
  ) {
    await this.assertCanAddContent(user, 'series');
    return this.adminContentService.createSeries(dto, user?.sub || user?.id || null);
  }

  @Post('series/:seriesId/episodes')
  @ApiOperation({
    summary: 'Add episode to series',
    description: 'Creates episode with optional individual Stripe product/price',
  })
  @ApiResponse({
    status: 201,
    description: 'Episode created successfully',
  })
  async createEpisode(
    @Param('seriesId') seriesId: string,
    @Body() dto: Omit<CreateEpisodeDto, 'series_id'>,
    // @GetUser() user: User, // Temporarily disabled
  ) {
    return this.adminContentService.createEpisode(
      { series_id: seriesId, ...dto },
      null, // Pass null instead of invalid user ID
    );
  }

  @Put('series/:seriesId/episodes/:episodeId')
  @ApiOperation({
    summary: 'Update episode',
    description: 'Updates episode metadata, video URL, or processing status',
  })
  @ApiResponse({
    status: 200,
    description: 'Episode updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Episode not found',
  })
  @HttpCode(HttpStatus.OK)
  async updateEpisode(
    @Param('seriesId') seriesId: string,
    @Param('episodeId') episodeId: string,
    @Body() updateData: any,
    // @GetUser() user: User, // Temporarily disabled
  ) {
    return this.adminContentService.updateEpisode(seriesId, episodeId, updateData, null);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Delete content',
    description:
      'Admins/moderators delete directly. Employees within their edit window delete directly; outside the window, the request goes to the admin approval queue (request_type=delete).',
  })
  @ApiResponse({ status: 200, description: 'Content deleted or queued for approval' })
  @ApiResponse({ status: 404, description: 'Content not found' })
  @HttpCode(HttpStatus.OK)
  async deleteContent(
    @Param('id') contentId: string,
    @GetUser() user: any,
  ) {
    const cap = await this.resolveEditCapability(user, contentId);
    if (cap === 'blocked') {
      throw new ForbiddenException(
        'Você não tem permissão para excluir este conteúdo.',
      );
    }
    if (cap === 'needs_approval') {
      const request = await this.editRequestsService.submitDeleteRequest({
        employeeId: user.sub || user.id,
        contentId,
      });
      return {
        status: 'pending_approval',
        message:
          'Sua solicitação de exclusão foi enviada para aprovação do administrador. O conteúdo só será removido após a aprovação.',
        request,
      };
    }
    return this.adminContentService.deleteContent(contentId, user?.sub || user?.id || null);
  }

  // Igor (26/05): restaura um conteúdo arquivado de volta pra PUBLISHED.
  // Só admin/moderator — funcionário não tem alçada de restaurar.
  @Post(':id/restore')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Restore archived content', description: 'Volta status para PUBLISHED' })
  @HttpCode(HttpStatus.OK)
  async restoreContent(
    @Param('id') contentId: string,
    @GetUser() user: any,
  ) {
    const role = user?.role;
    if (role !== UserRole.ADMIN && role !== UserRole.MODERATOR) {
      throw new ForbiddenException('Apenas administradores podem restaurar conteúdo arquivado.');
    }
    return this.adminContentService.restoreContent(contentId);
  }

  // Igor (04/06): libera a pré-venda — vira filme normal e dispara
  // notificação Telegram pra todos que pré-compraram. Idempotente.
  @Post(':id/release-presale')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Release a presale', description: 'Notifica todos que pré-compraram via Telegram' })
  @HttpCode(HttpStatus.OK)
  async releasePresale(
    @Param('id') contentId: string,
    @GetUser() user: any,
  ) {
    const role = user?.role;
    if (role !== UserRole.ADMIN && role !== UserRole.MODERATOR) {
      throw new ForbiddenException('Apenas administradores podem liberar pré-venda.');
    }
    return this.adminContentService.releasePresale(contentId);
  }

  // Igor (01/06): hard-delete de conteúdo arquivado (limpar testes).
  // Só admin/moderator. Backend bloqueia se status != ARCHIVED e devolve
  // erro estruturado se houver FK violation (purchases/episodes).
  @Delete(':id/purge')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Hard-delete archived content', description: 'Exclui definitivamente da base' })
  @HttpCode(HttpStatus.OK)
  async purgeContent(
    @Param('id') contentId: string,
    @GetUser() user: any,
  ) {
    const role = user?.role;
    if (role !== UserRole.ADMIN && role !== UserRole.MODERATOR) {
      throw new ForbiddenException('Apenas administradores podem excluir definitivamente.');
    }
    return this.adminContentService.purgeContent(contentId);
  }

  @Put(':id')
  // Igor (14/05): resolveEditCapability precisa de user válido pra checar
  // role e janela de edição do funcionário. Sem auth caía em "blocked".
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Update content metadata',
    description:
      'Admins/moderators apply changes directly. Employees apply directly within their edit window; after the window, the change goes to an admin approval queue.',
  })
  @ApiResponse({ status: 200, description: 'Update applied or queued for approval' })
  @HttpCode(HttpStatus.OK)
  async updateContent(
    @Param('id') contentId: string,
    @Body() updateData: any,
    @GetUser() user: any,
  ) {
    const cap = await this.resolveEditCapability(user, contentId);
    if (cap === 'blocked') {
      throw new ForbiddenException(
        'Você não tem permissão para editar este conteúdo.',
      );
    }
    if (cap === 'needs_approval') {
      const request = await this.editRequestsService.submitEditRequest({
        employeeId: user.sub || user.id,
        contentId,
        proposedChanges: updateData,
      });
      return {
        status: 'pending_approval',
        message:
          'Sua edição foi enviada para aprovação do administrador. Você será notificado assim que ela for aceita ou rejeitada.',
        request,
      };
    }
    // direct apply
    return this.adminContentService.updateContent(contentId, updateData);
  }

  // ---------------------------------------------------------------------------
  // Igor (12/05): seletor de carrosséis na criação/edição de conteúdo.
  // Substitui o antigo checkbox "Destacar na página inicial" por uma
  // associação N:N entre conteúdo e carrosséis manuais (featured + manual).
  // ---------------------------------------------------------------------------

  @Get('homepage-carousels/eligible')
  @ApiOperation({
    summary: 'List carousels eligible for manual content insertion',
    description:
      'Retorna apenas carrosséis dos tipos "featured" e "manual" — os outros (top10, releases, all_movies, all_series, category) populam por regras automáticas e ignoram content_ids[].',
  })
  async listEligibleCarousels() {
    const carousels = await this.homepageCarousels.findEligibleForManualInsertion();
    return carousels.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      type: c.type,
      is_visible: c.is_visible,
    }));
  }

  @Get(':id/carousels')
  @ApiOperation({
    summary: 'Get IDs of carousels where this content appears',
    description: 'Usado para pré-selecionar checkboxes no form de edição.',
  })
  async getContentCarousels(@Param('id') contentId: string) {
    const carouselIds = await this.homepageCarousels.findCarouselsContaining(contentId);
    return { carouselIds };
  }

  @Post(':id/carousels')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Sync content to carousels (atomic)',
    description:
      'Adiciona o conteúdo aos carrosséis em carouselIds[] e remove dos outros (entre os elegíveis). Idempotente.',
  })
  @HttpCode(HttpStatus.OK)
  async setContentCarousels(
    @Param('id') contentId: string,
    @Body() body: { carouselIds?: string[] },
    @GetUser() user: any,
  ) {
    const cap = await this.resolveEditCapability(user, contentId);
    if (cap === 'blocked') {
      throw new ForbiddenException('Sem permissão para alterar carrosséis deste conteúdo.');
    }
    const carouselIds = Array.isArray(body?.carouselIds) ? body.carouselIds : [];
    await this.homepageCarousels.syncContentToCarousels(contentId, carouselIds);
    return { success: true, carouselIds };
  }

  // ---------------------------------------------------------------------------
  // Igor (12/05): botão "Testar" do grupo Telegram no admin. Antes caía
  // no fallback genérico "Conteúdo Indisponível" sem motivo. Agora retorna
  // erro estruturado para o frontend mostrar toast específico.
  // ---------------------------------------------------------------------------

  @Post(':id/test-telegram-group')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Test access to the Telegram group of a content',
    description:
      'Tenta gerar um invite link real para o grupo. Aceita ?type=bot ou ?type=link para forçar o modo de teste. Retorna { success, inviteLink } ou { success: false, error, detail }.',
  })
  @HttpCode(HttpStatus.OK)
  async testContentTelegramGroup(
    @Param('id') contentId: string,
    @Query('type') type?: string,
  ) {
    const { data: content, error } = await this.supabaseService.client
      .from('content')
      .select('id, telegram_chat_id, telegram_group_link, title')
      .eq('id', contentId)
      .maybeSingle();

    if (error || !content) {
      throw new BadRequestException('Conteúdo não encontrado.');
    }

    // Igor (15/05): aceita type=bot|link para Igor distinguir 2 botões no UI.
    const preferType = type === 'bot' || type === 'link' ? type : undefined;

    const result = await this.telegramsService.testTelegramGroupForContent(
      {
        id: content.id,
        telegram_chat_id: content.telegram_chat_id,
        telegram_group_link: content.telegram_group_link,
      },
      preferType as 'bot' | 'link' | undefined,
    );

    return { ...result, contentTitle: content.title };
  }

  // Audio/Language Management Endpoints

  @Get(':id/audio-tracks')
  @ApiOperation({
    summary: 'Get all audio tracks for content',
    description: 'Retrieves all audio/language versions for a movie or series',
  })
  @ApiResponse({
    status: 200,
    description: 'Audio tracks retrieved successfully',
  })
  async getAudioTracks(@Param('id') contentId: string) {
    return this.adminContentService.getAudioTracks(contentId);
  }

  @Post(':id/audio-tracks')
  @ApiOperation({
    summary: 'Add new audio track to content',
    description: 'Adds a new dubbed or subtitled version',
  })
  @ApiResponse({
    status: 201,
    description: 'Audio track added successfully',
  })
  async addAudioTrack(
    @Param('id') contentId: string,
    @Body() audioData: any,
  ) {
    return this.adminContentService.addAudioTrack(contentId, audioData);
  }

  @Delete(':id/audio-tracks/:audioId')
  @ApiOperation({
    summary: 'Delete audio track',
    description: 'Removes audio track from content and deletes from S3',
  })
  @ApiResponse({
    status: 200,
    description: 'Audio track deleted successfully',
  })
  @HttpCode(HttpStatus.OK)
  async deleteAudioTrack(
    @Param('id') contentId: string,
    @Param('audioId') audioId: string,
  ) {
    return this.adminContentService.deleteAudioTrack(contentId, audioId);
  }

  @Delete('episodes/:episodeId')
  @ApiOperation({
    summary: 'Delete episode',
    description: 'Removes episode from series and deletes from S3',
  })
  @ApiResponse({
    status: 200,
    description: 'Episode deleted successfully',
  })
  @HttpCode(HttpStatus.OK)
  async deleteEpisode(@Param('episodeId') episodeId: string) {
    return this.adminContentService.deleteEpisode(episodeId);
  }

  @Post('categories/sync')
  @ApiOperation({
    summary: 'Sync categories',
    description: 'Creates all standard categories in the database if they don\'t exist',
  })
  @ApiResponse({
    status: 200,
    description: 'Categories synced successfully',
  })
  @HttpCode(HttpStatus.OK)
  async syncCategories() {
    return this.adminContentService.syncCategories();
  }

  @Post('categories/populate')
  @ApiOperation({
    summary: 'Populate content categories',
    description: 'Associates all existing content with their respective categories based on genres',
  })
  @ApiResponse({
    status: 200,
    description: 'Content categories populated successfully',
  })
  @HttpCode(HttpStatus.OK)
  async populateContentCategories() {
    return this.adminContentService.populateContentCategories();
  }
}
