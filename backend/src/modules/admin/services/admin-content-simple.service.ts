import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../../config/supabase.service';
import { ConfigService } from '@nestjs/config';
import { AdminPeopleService } from './admin-people.service';

@Injectable()
export class AdminContentSimpleService {
  private readonly logger = new Logger(AdminContentSimpleService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
    private readonly peopleService: AdminPeopleService,
  ) {
    console.log('AdminContentSimpleService instantiated successfully');
  }

  async getAllContent() {
    console.log('AdminContentSimpleService.getAllContent called');

    // Igor (07/05): soft-delete grava status=ARCHIVED. Esconde da lista
    // de gerenciamento — admin não quer ver itens deletados misturados.
    const { data, error } = await this.supabaseService.client
      .from('content')
      .select('*')
      .neq('status', 'ARCHIVED')
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('Error fetching content:', error);
      throw new Error(`Failed to fetch content: ${error.message}`);
    }

    const contents = data || [];

    // N14 (Igor 8:27 PM 04/05): incluir nome do criador (admin ou
    // funcionário) na lista pra Igor supervisionar sem clicar em editar.
    // Como `content` não tem FK formal pro users, fazemos lookup em
    // memória (1 query batch + map em JS). Não filtramos `users` por
    // role aqui pra também mostrar admin como criador.
    const creatorIds = Array.from(
      new Set(contents.map((c: any) => c.createdById).filter(Boolean)),
    );

    if (creatorIds.length === 0) {
      return contents;
    }

    const { data: users } = await this.supabaseService.client
      .from('users')
      .select('id, name, email, role')
      .in('id', creatorIds);

    const byId = new Map<string, { id: string; name: string; email: string; role: string }>(
      (users || []).map((u: any) => [u.id, u]),
    );

    return contents.map((c: any) => ({
      ...c,
      createdBy: c.createdById ? byId.get(c.createdById) || null : null,
    }));
  }

  // Igor (26/05): aba "Histórico" no admin — lista conteúdos arquivados
  // pra ele poder restaurar se deletou errado. Espelha `getAllContent` mas
  // filtra status='ARCHIVED'.
  async getArchivedContent() {
    const { data, error } = await this.supabaseService.client
      .from('content')
      .select('*')
      .eq('status', 'ARCHIVED')
      .order('updated_at', { ascending: false });

    if (error) {
      this.logger.error('Error fetching archived content:', error);
      throw new Error(`Failed to fetch archived content: ${error.message}`);
    }

    const contents = data || [];
    const creatorIds = Array.from(
      new Set(contents.map((c: any) => c.createdById).filter(Boolean)),
    );

    if (creatorIds.length === 0) return contents;

    const { data: users } = await this.supabaseService.client
      .from('users')
      .select('id, name, email, role')
      .in('id', creatorIds);

    const byId = new Map<string, { id: string; name: string; email: string; role: string }>(
      (users || []).map((u: any) => [u.id, u]),
    );

    return contents.map((c: any) => ({
      ...c,
      createdBy: c.createdById ? byId.get(c.createdById) || null : null,
    }));
  }

  async restoreContent(contentId: string) {
    this.logger.log(`Restoring content with ID: ${contentId}`);

    const { data: content, error: fetchError } = await this.supabaseService.client
      .from('content')
      .select('id, title, status')
      .eq('id', contentId)
      .single();

    if (fetchError || !content) {
      throw new NotFoundException(`Content with ID ${contentId} not found`);
    }

    if (content.status !== 'ARCHIVED') {
      this.logger.log(`Content ${contentId} não está arquivado — no-op idempotente`);
      return {
        success: true,
        message: `Content "${content.title}" não estava arquivado`,
        restoredContent: { id: content.id, title: content.title },
      };
    }

    const { error: updateError } = await this.supabaseService.client
      .from('content')
      .update({ status: 'PUBLISHED', updated_at: new Date().toISOString() })
      .eq('id', contentId);

    if (updateError) {
      this.logger.error('Error restoring content:', updateError);
      throw new Error(`Failed to restore content: ${updateError.message}`);
    }

    return {
      success: true,
      message: `Content "${content.title}" restaurado com sucesso`,
      restoredContent: { id: content.id, title: content.title },
    };
  }

  // Igor (01/06): hard-delete pra limpar testes que ficaram em ARCHIVED.
  // Só permite excluir de vez se status já for ARCHIVED (segurança — admin
  // não consegue apagar conteúdo ativo por acidente). Se o conteúdo tiver
  // purchases/episodes vinculados, Postgres devolve FK violation e o
  // método retorna erro estruturado pra UI mostrar mensagem clara.
  async purgeContent(contentId: string) {
    this.logger.log(`Hard-deleting content with ID: ${contentId}`);

    const { data: content, error: fetchError } = await this.supabaseService.client
      .from('content')
      .select('id, title, status')
      .eq('id', contentId)
      .single();

    if (fetchError || !content) {
      throw new NotFoundException(`Content with ID ${contentId} not found`);
    }

    if (content.status !== 'ARCHIVED') {
      return {
        success: false,
        reason: 'not_archived',
        message: 'Só dá pra excluir definitivamente itens que já estão arquivados.',
      };
    }

    const { error: deleteError } = await this.supabaseService.client
      .from('content')
      .delete()
      .eq('id', contentId);

    if (deleteError) {
      this.logger.error('Error purging content:', deleteError);
      // Postgres FK violation: 23503. Supabase devolve em error.code.
      const code = (deleteError as any).code;
      if (code === '23503' || /foreign key/i.test(deleteError.message || '')) {
        return {
          success: false,
          reason: 'has_dependencies',
          message:
            'Não dá pra apagar — tem venda ou episódio linkado. Use Restaurar se precisar acessar de novo.',
          detail: deleteError.message,
        };
      }
      throw new Error(`Failed to purge content: ${deleteError.message}`);
    }

    return {
      success: true,
      message: `Content "${content.title}" excluído definitivamente`,
      purgedContent: { id: content.id, title: content.title },
    };
  }

  async getContentById(id: string) {
    console.log(`AdminContentSimpleService.getContentById called with id: ${id}`);

    const { data, error } = await this.supabaseService.client
      .from('content')
      .select(`
        *,
        content_people(
          role,
          character_name,
          display_order,
          person:people(id, name, photo_url, role)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      this.logger.error(`Error fetching content by id ${id}:`, error);
      throw new NotFoundException(`Content with ID ${id} not found`);
    }

    return data;
  }

  async createContent(data: any, userId?: string, userRole?: string) {
    this.logger.log('Creating content with data:', JSON.stringify(data));

    // Igor (14/05): defesa em profundidade — se chegou aqui sem userId,
    // significa que algum endpoint ainda está usando OptionalAuthGuard ou
    // que o token expirou de forma não detectada. Loga warning pra auditoria
    // (o JwtAuthGuard nos endpoints de criação já deveria ter retornado 401).
    if (!userId) {
      this.logger.warn(
        `createContent called WITHOUT userId — content "${data?.title}" will be orphan (createdById=null)`,
      );
      try {
        await this.supabaseService.client.from('system_logs').insert({
          type: 'admin_content',
          level: 'warn',
          message: `Content created without userId: title="${data?.title || 'unknown'}"`,
        });
      } catch (logErr) {
        // não bloqueia criação se log falhar
      }
    }

    // A9 (vídeo IMG_8811) — Igor reclamou que conteúdo recém-criado
    // ficava em rascunho mesmo quando criado por admin. Agora:
    // - admin/moderator → PUBLISHED direto, vai pro site sem precisar
    //   "subir" depois.
    // - employee → DRAFT, segue o workflow de aprovação existente.
    // - sem role identificável → DRAFT (segurança).
    const isAdminLike =
      userRole === 'admin' || userRole === 'moderator';
    const initialStatus = isAdminLike ? 'PUBLISHED' : 'DRAFT';

    // Mapear campos do frontend para o formato do banco
    const contentData: any = {
      title: data.title,
      description: data.description || null,
      synopsis: data.synopsis || null,
      poster_url: data.poster_url || null,
      backdrop_url: data.backdrop_url || null,
      backdrop_position: data.backdrop_position || null,
      backdrop_position_mobile: data.backdrop_position_mobile || null,
      trailer_url: data.trailer_url || null,
      content_type: data.content_type || data.type || 'movie', // Mapeia para coluna content_type
      status: initialStatus,
      availability: 'site', // Padrão
      price_cents: data.price_cents || 0,
      currency: 'BRL',
      is_featured: data.is_featured || false,
      is_release: data.is_release || false,
      is_new_season: data.is_new_season || false,
      genres: data.genres ? (Array.isArray(data.genres) ? data.genres : [data.genres]) : null, // Coluna genres (plural), tipo array
      director: data.director || null,
      cast: data.cast ? (Array.isArray(data.cast) ? data.cast : data.cast.split(',').map((c: string) => c.trim())) : null, // Tipo array
      release_year: data.release_year || null,
      duration_minutes: data.duration_minutes || null,
      imdb_rating: data.imdb_rating && !isNaN(Number(data.imdb_rating)) ? Number(data.imdb_rating) : null,
      quality_label: data.quality_label || null,
      audio_type: data.audio_type || null,
      telegram_group_link: data.telegram_group_link || null,
      // Igor (07/05): Chat ID separado — opcional, pra invite auto via bot.
      telegram_chat_id: data.telegram_chat_id || null,
      // Igor (07/05): título secundário (geralmente em inglês) — busca também filtra por ele.
      title_en: data.title_en || null,
      age_rating: data.age_rating || null,
    };

    // Audit trail — register who created this content (for employee permissions)
    if (userId) {
      contentData.createdById = userId;
    }

    // Adicionar campos específicos de série se aplicável
    if (contentData.content_type === 'series') {
      contentData.total_seasons = data.total_seasons || null;
      contentData.total_episodes = data.total_episodes || null;
    }

    this.logger.log('Mapped content data:', JSON.stringify(contentData));

    const { data: insertedContent, error } = await this.supabaseService.client
      .from('content')
      .insert([contentData])
      .select()
      .single();

    if (error) {
      this.logger.error('Error creating content:', error);
      throw new Error(`Failed to create content: ${error.message}`);
    }

    this.logger.log('Content created successfully:', insertedContent.id);

    // Associar categorias se fornecidas
    if (data.genres && Array.isArray(data.genres) && data.genres.length > 0) {
      await this.associateCategories(insertedContent.id, data.genres);
    }

    // Sync people (cast + director) with content_people table
    try {
      const castArray = data.cast ? (Array.isArray(data.cast) ? data.cast : data.cast.split(',').map((c: string) => c.trim())) : [];
      await this.peopleService.syncContentPeople(insertedContent.id, castArray, data.director);
    } catch (e) {
      this.logger.warn(`Failed to sync people for content ${insertedContent.id}: ${e.message}`);
    }

    return insertedContent;
  }

  /**
   * Igor (13/05): sincroniza idempotentemente as categorias de um conteúdo
   * com base no array `genres[]`. Antes, esta função só fazia INSERT —
   * o que (1) era chamada apenas no createContent e (2) duplicava linhas
   * se chamada de novo. Agora faz DIFF: remove categorias não mais marcadas
   * E adiciona novas. Usado tanto no create quanto no update.
   *
   * Se categoryNames vier vazio/null, REMOVE todas as categorias do conteúdo.
   */
  private async associateCategories(contentId: string, categoryNames: string[]) {
    this.logger.log(`Syncing categories for content ${contentId}:`, categoryNames);

    // 1. Resolver IDs das categorias atualmente desejadas pelos nomes
    let desiredCategoryIds: string[] = [];
    if (categoryNames && categoryNames.length > 0) {
      const { data: categories, error: categoriesError } = await this.supabaseService.client
        .from('categories')
        .select('id, name')
        .in('name', categoryNames);

      if (categoriesError) {
        this.logger.error('Error fetching categories:', categoriesError);
        return;
      }
      desiredCategoryIds = (categories || []).map((c: any) => c.id);

      // Aviso quando algum gênero não tem categoria correspondente cadastrada
      const foundNames = new Set((categories || []).map((c: any) => c.name));
      const missing = categoryNames.filter((n) => !foundNames.has(n));
      if (missing.length > 0) {
        this.logger.warn(
          `Genres without matching categories (sync ignored): ${missing.join(', ')}`,
        );
      }
    }

    // 2. Buscar categorias atualmente vinculadas ao conteúdo
    const { data: existing, error: existingError } = await this.supabaseService.client
      .from('content_categories')
      .select('category_id')
      .eq('content_id', contentId);

    if (existingError) {
      this.logger.error('Error fetching existing content_categories:', existingError);
      return;
    }
    const existingIds = new Set((existing || []).map((r: any) => r.category_id));
    const desiredSet = new Set(desiredCategoryIds);

    // 3. Calcular DIFF
    const toAdd = desiredCategoryIds.filter((id) => !existingIds.has(id));
    const toRemove = Array.from(existingIds).filter((id) => !desiredSet.has(id as string)) as string[];

    // 4. Remover as que sobraram
    if (toRemove.length > 0) {
      const { error: deleteError } = await this.supabaseService.client
        .from('content_categories')
        .delete()
        .eq('content_id', contentId)
        .in('category_id', toRemove);
      if (deleteError) {
        this.logger.error('Error removing stale category associations:', deleteError);
      } else {
        this.logger.log(`Removed ${toRemove.length} category association(s).`);
      }
    }

    // 5. Adicionar as novas
    if (toAdd.length > 0) {
      const inserts = toAdd.map((category_id) => ({ content_id: contentId, category_id }));
      const { error: insertError } = await this.supabaseService.client
        .from('content_categories')
        .insert(inserts);
      if (insertError) {
        this.logger.error('Error creating category associations:', insertError);
      } else {
        this.logger.log(`Added ${toAdd.length} category association(s).`);
      }
    }
  }

  async initiateUpload(data: any, userId?: string) {
    console.log('AdminContentSimpleService.initiateUpload called');
    return {
      success: true,
      data: { uploadUrl: 'test-upload-url' },
      message: 'Upload initiated successfully'
    };
  }

  async completeUpload(data: any, userId?: string) {
    console.log('AdminContentSimpleService.completeUpload called');
    return {
      success: true,
      data: { id: 'test-upload-id' },
      message: 'Upload completed successfully'
    };
  }

  async getContentStatus(contentId: string) {
    console.log('AdminContentSimpleService.getContentStatus called with:', contentId);
    return {
      success: true,
      data: { status: 'active' },
      message: 'Status retrieved successfully'
    };
  }

  async publishContent(data: any, userId?: string) {
    const contentId = data.content_id;
    this.logger.log(`Publishing content with ID: ${contentId}`);

    // Validar que o conteúdo existe
    const { data: content, error: fetchError } = await this.supabaseService.client
      .from('content')
      .select('*')
      .eq('id', contentId)
      .single();

    if (fetchError || !content) {
      throw new NotFoundException(`Content with ID ${contentId} not found`);
    }

    // Atualizar status para PUBLISHED
    const { data: updatedContent, error: updateError } = await this.supabaseService.client
      .from('content')
      .update({
        status: 'PUBLISHED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', contentId)
      .select()
      .single();

    if (updateError) {
      this.logger.error('Error publishing content:', updateError);
      throw new Error(`Failed to publish content: ${updateError.message}`);
    }

    this.logger.log(`Content ${contentId} published successfully`);

    return {
      success: true,
      data: updatedContent,
      message: `Content "${content.title}" published successfully`
    };
  }

  async createSeries(data: any, userId?: string) {
    console.log('AdminContentSimpleService.createSeries called');
    return {
      success: true,
      data: { id: 'test-series-id', ...data },
      message: 'Series created successfully'
    };
  }

  async createEpisode(data: any, userId?: string) {
    console.log('AdminContentSimpleService.createEpisode called with:', data);

    // Validate series exists
    const { data: series, error: seriesError } = await this.supabaseService.client
      .from('content')
      .select('id, content_type')
      .eq('id', data.series_id)
      .single();

    if (seriesError || !series) {
      throw new NotFoundException(`Series with ID ${data.series_id} not found`);
    }

    if (series.content_type !== 'series') {
      throw new Error('Content is not a series');
    }

    // Insert episode into episodes table
    const episodeData = {
      series_id: data.series_id,
      season_number: data.season_number,
      episode_number: data.episode_number,
      title: data.title,
      description: data.description,
      duration_minutes: data.duration_minutes,
      thumbnail_url: data.thumbnail_url || null,
      video_url: data.video_url || null,
      storage_path: data.storage_path || null,
      file_storage_key: data.file_storage_key || null,
      processing_status: data.processing_status || 'pending',
      created_by_id: userId || null,
      updated_by_id: userId || null,
    };

    const { data: episode, error: insertError } = await this.supabaseService.client
      .from('episodes')
      .insert(episodeData)
      .select()
      .single();

    if (insertError) {
      this.logger.error('Error creating episode:', insertError);
      throw new Error(`Failed to create episode: ${insertError.message}`);
    }

    return {
      success: true,
      data: episode,
      message: 'Episode created successfully'
    };
  }

  async updateEpisode(seriesId: string, episodeId: string, updateData: any, userId?: string) {
    this.logger.log(`Updating episode ${episodeId} for series ${seriesId}`);

    // Verify episode belongs to series
    const { data: episode, error: fetchError } = await this.supabaseService.client
      .from('episodes')
      .select('*')
      .eq('id', episodeId)
      .eq('series_id', seriesId)
      .single();

    if (fetchError || !episode) {
      throw new NotFoundException(`Episode ${episodeId} not found in series ${seriesId}`);
    }

    // Prepare update data
    const episodeUpdate: any = {
      updated_by_id: userId || null,
      updated_at: new Date().toISOString(),
    };

    // Only update fields that are provided
    if (updateData.title !== undefined) episodeUpdate.title = updateData.title;
    if (updateData.description !== undefined) episodeUpdate.description = updateData.description;
    if (updateData.season_number !== undefined) episodeUpdate.season_number = updateData.season_number;
    if (updateData.episode_number !== undefined) episodeUpdate.episode_number = updateData.episode_number;
    if (updateData.duration_minutes !== undefined) episodeUpdate.duration_minutes = updateData.duration_minutes;
    if (updateData.thumbnail_url !== undefined) episodeUpdate.thumbnail_url = updateData.thumbnail_url;
    if (updateData.video_url !== undefined) episodeUpdate.video_url = updateData.video_url;
    if (updateData.storage_path !== undefined) episodeUpdate.storage_path = updateData.storage_path;
    if (updateData.file_storage_key !== undefined) episodeUpdate.file_storage_key = updateData.file_storage_key;
    if (updateData.file_size_bytes !== undefined) episodeUpdate.file_size_bytes = updateData.file_size_bytes;
    if (updateData.processing_status !== undefined) episodeUpdate.processing_status = updateData.processing_status;
    if (updateData.available_qualities !== undefined) episodeUpdate.available_qualities = updateData.available_qualities;

    // Update episode
    const { data: updatedEpisode, error: updateError } = await this.supabaseService.client
      .from('episodes')
      .update(episodeUpdate)
      .eq('id', episodeId)
      .select()
      .single();

    if (updateError) {
      this.logger.error('Error updating episode:', updateError);
      throw new Error(`Failed to update episode: ${updateError.message}`);
    }

    return {
      success: true,
      data: updatedEpisode,
      message: 'Episode updated successfully'
    };
  }

  async deleteContent(contentId: string, userId?: string) {
    this.logger.log(`Soft-deleting content with ID: ${contentId}`);

    // Igor (07/05): troca hard-delete por soft-delete (status=ARCHIVED).
    // Motivo: produtividade do funcionário e queries admin passam a
    // poder filtrar `.neq('status', 'ARCHIVED')` em vez de depender da
    // row sumir (que tinha edge case com edit-requests pendentes).
    // Reversibilidade é bônus — se Igor deletar errado dá pra restaurar.
    // Queries públicas já filtram status='PUBLISHED', então ARCHIVED
    // some do site naturalmente.

    // 1. Buscar o conteúdo para validar que existe antes de arquivar.
    const { data: content, error: fetchError } = await this.supabaseService.client
      .from('content')
      .select('id, title, status')
      .eq('id', contentId)
      .single();

    if (fetchError || !content) {
      this.logger.error(`Content not found: ${contentId}`);
      throw new NotFoundException(`Content with ID ${contentId} not found`);
    }

    if (content.status === 'ARCHIVED') {
      this.logger.log(`Content ${contentId} já está arquivado — no-op idempotente`);
      return {
        success: true,
        message: `Content "${content.title}" já estava arquivado`,
        deletedContent: { id: content.id, title: content.title },
      };
    }

    // 2. Soft-delete: marca como ARCHIVED. Mantém episódios/languages/
    // purchases/favorites linkados — queries públicas filtram por status
    // PUBLISHED, então não aparecem no site. Purchases ficam preservadas
    // pra cliente que já comprou continuar tendo acesso.
    const { error: deleteError } = await this.supabaseService.client
      .from('content')
      .update({
        status: 'ARCHIVED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', contentId);

    if (deleteError) {
      this.logger.error('Error archiving content:', deleteError);
      throw new Error(`Failed to archive content: ${deleteError.message}`);
    }

    this.logger.log(`Content ${contentId} archived successfully`);

    return {
      success: true,
      message: `Content "${content.title}" deleted successfully`,
      deletedContent: {
        id: content.id,
        title: content.title,
      },
    };
  }

  async updateContent(contentId: string, updateData: any) {
    this.logger.log(`Updating content ${contentId} with data:`, updateData);

    // Validar que o conteúdo existe
    const { data: existingContent, error: fetchError } = await this.supabaseService.client
      .from('content')
      .select('*')
      .eq('id', contentId)
      .single();

    if (fetchError || !existingContent) {
      throw new NotFoundException(`Content with ID ${contentId} not found`);
    }

    // Preparar dados de atualização
    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    // Mapear campos permitidos
    const allowedFields = [
      'title', 'description', 'synopsis', 'poster_url', 'backdrop_url',
      'backdrop_position', 'backdrop_position_mobile',
      'trailer_url', 'telegram_group_link', 'telegram_chat_id', 'title_en', 'release_year',
      'duration_minutes', 'imdb_rating', 'age_rating', 'director', 'cast',
      'genres', 'price_cents', 'is_featured', 'is_release', 'is_new_season', 'total_seasons', 'total_episodes',
      'status', 'availability', 'quality_label', 'audio_type'
    ];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updatePayload[field] = updateData[field];
      }
    }

    // Atualizar no banco
    const { data: updatedContent, error: updateError } = await this.supabaseService.client
      .from('content')
      .update(updatePayload)
      .eq('id', contentId)
      .select()
      .single();

    if (updateError) {
      this.logger.error('Error updating content:', updateError);
      throw new Error(`Failed to update content: ${updateError.message}`);
    }

    this.logger.log(`Content ${contentId} updated successfully`);

    // Sync people (cast + director) if provided
    try {
      const cast = updateData.cast;
      const director = updateData.director;
      if (cast !== undefined || director !== undefined) {
        const castArray = cast ? (Array.isArray(cast) ? cast : cast.split(',').map((c: string) => c.trim())) : [];
        await this.peopleService.syncContentPeople(contentId, castArray, director);
      }
    } catch (e) {
      this.logger.warn(`Failed to sync people for content ${contentId}: ${e.message}`);
    }

    // Igor (13/05): sync de genres → content_categories. Antes esse passo só
    // rodava no create — agora roda também no update, garantindo que se o
    // admin adiciona/remove um gênero (ex: "Família"), o carrossel da home
    // correspondente atualiza imediatamente.
    if (updateData.genres !== undefined) {
      try {
        const genresArr = Array.isArray(updateData.genres)
          ? updateData.genres
          : updateData.genres
            ? [updateData.genres]
            : [];
        await this.associateCategories(contentId, genresArr);
      } catch (e) {
        this.logger.warn(`Failed to sync categories for content ${contentId}: ${e.message}`);
      }
    }

    return {
      success: true,
      message: 'Content updated successfully',
      data: updatedContent,
    };
  }

  async getAudioTracks(contentId: string) {
    this.logger.log(`Fetching audio tracks for content: ${contentId}`);

    const { data, error } = await this.supabaseService.client
      .from('content_languages')
      .select('*')
      .eq('content_id', contentId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('Error fetching audio tracks:', error);
      throw new Error(`Failed to fetch audio tracks: ${error.message}`);
    }

    return {
      success: true,
      data: data || [],
      count: data?.length || 0,
    };
  }

  async addAudioTrack(contentId: string, audioData: any) {
    this.logger.log(`Adding audio track to content ${contentId}:`, audioData);

    // Validar que o conteúdo existe
    const { data: content, error: contentError } = await this.supabaseService.client
      .from('content')
      .select('id, title')
      .eq('id', contentId)
      .single();

    if (contentError || !content) {
      throw new NotFoundException(`Content with ID ${contentId} not found`);
    }

    // Preparar dados do audio track
    const audioTrackData = {
      content_id: contentId,
      language_type: audioData.language_type || 'dubbed',
      language_code: audioData.language_code || 'pt-BR',
      language_name: audioData.language_name,
      audio_type: audioData.audio_type,
      quality: audioData.quality || '1080p',
      video_url: audioData.video_url || null,
      video_storage_key: audioData.video_storage_key || null,
      hls_master_url: audioData.hls_master_url || null,
      hls_base_path: audioData.hls_base_path || null,
      is_active: true,
      is_primary: audioData.is_primary || false,
      status: audioData.status || 'ready',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: insertedAudio, error: insertError } = await this.supabaseService.client
      .from('content_languages')
      .insert([audioTrackData])
      .select()
      .single();

    if (insertError) {
      this.logger.error('Error adding audio track:', insertError);
      throw new Error(`Failed to add audio track: ${insertError.message}`);
    }

    this.logger.log(`Audio track added successfully: ${insertedAudio.id}`);

    return {
      success: true,
      message: 'Audio track added successfully',
      data: insertedAudio,
    };
  }

  async deleteAudioTrack(contentId: string, audioId: string) {
    this.logger.log(`Deleting audio track ${audioId} from content ${contentId}`);

    // Buscar o audio track
    const { data: audioTrack, error: fetchError } = await this.supabaseService.client
      .from('content_languages')
      .select('*')
      .eq('id', audioId)
      .eq('content_id', contentId)
      .single();

    if (fetchError || !audioTrack) {
      throw new NotFoundException(`Audio track with ID ${audioId} not found for content ${contentId}`);
    }

    // Deletar do banco
    const { error: deleteError } = await this.supabaseService.client
      .from('content_languages')
      .delete()
      .eq('id', audioId);

    if (deleteError) {
      this.logger.error('Error deleting audio track:', deleteError);
      throw new Error(`Failed to delete audio track: ${deleteError.message}`);
    }

    this.logger.log(`Audio track ${audioId} deleted successfully`);

    return {
      success: true,
      message: 'Audio track deleted successfully',
      deletedAudio: {
        id: audioTrack.id,
        language_name: audioTrack.language_name,
      },
    };
  }

  async deleteEpisode(episodeId: string) {
    this.logger.log(`Deleting episode: ${episodeId}`);

    // Buscar o episódio primeiro
    const { data: episode, error: fetchError } = await this.supabaseService.client
      .from('episodes')
      .select('*')
      .eq('id', episodeId)
      .single();

    if (fetchError || !episode) {
      throw new NotFoundException(`Episode with ID ${episodeId} not found`);
    }

    // Deletar do banco
    const { error: deleteError } = await this.supabaseService.client
      .from('episodes')
      .delete()
      .eq('id', episodeId);

    if (deleteError) {
      this.logger.error('Error deleting episode:', deleteError);
      throw new Error(`Failed to delete episode: ${deleteError.message}`);
    }

    this.logger.log(`Episode ${episodeId} deleted successfully`);

    return {
      success: true,
      message: 'Episode deleted successfully',
      deletedEpisode: {
        id: episode.id,
        title: episode.title,
        season: episode.season_number,
        episode: episode.episode_number,
      },
    };
  }

  /**
   * Sync/create all categories based on AVAILABLE_GENRES
   */
  async syncCategories() {
    this.logger.log('Syncing categories...');

    const AVAILABLE_GENRES = [
      'Ação',
      'Aventura',
      'Animação',
      'Comédia',
      'Crime',
      'Documentário',
      'Drama',
      'Fantasia',
      'Ficção Científica',
      'Guerra',
      'História',
      'Horror',
      'Musical',
      'Mistério',
      'Romance',
      'Suspense',
      'Terror',
      'Thriller',
      'Western',
      'Séries', // Special category for all series
    ];

    const createdCategories = [];
    const skippedCategories = [];

    for (const genreName of AVAILABLE_GENRES) {
      // Generate slug
      const slug = genreName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      // Check if category exists
      const { data: existingCategory } = await this.supabaseService.client
        .from('categories')
        .select('id, name')
        .eq('slug', slug)
        .single();

      if (existingCategory) {
        skippedCategories.push(genreName);
        continue;
      }

      // Create category
      const { data: newCategory, error } = await this.supabaseService.client
        .from('categories')
        .insert({
          name: genreName,
          slug: slug,
          description: `Filmes e séries de ${genreName}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        this.logger.error(`Error creating category ${genreName}:`, error);
      } else {
        createdCategories.push(genreName);
        this.logger.log(`Created category: ${genreName}`);
      }
    }

    return {
      success: true,
      created: createdCategories,
      skipped: skippedCategories,
      message: `Synced ${createdCategories.length} categories, ${skippedCategories.length} already existed`,
    };
  }

  /**
   * Populate content_categories for all existing content based on their genres column
   */
  async populateContentCategories() {
    this.logger.log('Populating content categories...');

    // Fetch all content
    const { data: allContent, error: contentError } = await this.supabaseService.client
      .from('content')
      .select('id, title, content_type, genres, status');

    if (contentError) {
      this.logger.error('Error fetching content:', contentError);
      throw new Error(`Failed to fetch content: ${contentError.message}`);
    }

    if (!allContent || allContent.length === 0) {
      return {
        success: true,
        message: 'No content found',
        populated: 0,
      };
    }

    let populatedCount = 0;

    for (const content of allContent) {
      try {
        // Clear existing associations
        await this.supabaseService.client
          .from('content_categories')
          .delete()
          .eq('content_id', content.id);

        const categoriesToAssociate: string[] = [];

        // Add genre-based categories
        if (content.genres && Array.isArray(content.genres) && content.genres.length > 0) {
          categoriesToAssociate.push(...content.genres);
        }

        // Add "Séries" category for all series
        if (content.content_type === 'series') {
          categoriesToAssociate.push('Séries');
        }

        // Associate categories
        if (categoriesToAssociate.length > 0) {
          await this.associateCategories(content.id, categoriesToAssociate);
          populatedCount++;
          this.logger.log(`Populated categories for: ${content.title}`);
        }
      } catch (error) {
        this.logger.error(`Error populating categories for ${content.title}:`, error);
      }
    }

    return {
      success: true,
      message: `Populated categories for ${populatedCount} content items`,
      total: allContent.length,
      populated: populatedCount,
    };
  }
}
