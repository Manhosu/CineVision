import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../../config/supabase.service';
import { LanguageType, LanguageCode } from '../entities/content-language.entity';

export interface CreateContentLanguageDto {
  content_id: string;
  language_type: LanguageType;
  language_code: LanguageCode;
  language_name: string;
  video_storage_key?: string;
  is_default?: boolean;
}

export interface UpdateContentLanguageDto {
  video_url?: string;
  video_storage_key?: string;
  hls_master_url?: string;
  hls_base_path?: string;
  file_size_bytes?: number;
  duration_minutes?: number;
  video_codec?: string;
  audio_codec?: string;
  bitrate_kbps?: number;
  width?: number;
  height?: number;
  frame_rate?: number;
  available_qualities?: string;
  upload_status?: string;
  is_active?: boolean;
  is_default?: boolean;
}

@Injectable()
export class ContentLanguageSupabaseService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async create(createDto: CreateContentLanguageDto): Promise<any> {
    // Verificar se o conteúdo existe
    const { data: content, error: contentError } = await this.supabaseService.client
      .from('contents')
      .select('id')
      .eq('id', createDto.content_id)
      .single();

    if (contentError || !content) {
      throw new NotFoundException(`Conteúdo com ID ${createDto.content_id} não encontrado`);
    }

    // Verificar se já existe um arquivo do mesmo tipo (dublado ou legendado) para este conteúdo
    const { data: existingLanguageType } = await this.supabaseService.client
      .from('content_languages')
      .select('id, language_type')
      .eq('content_id', createDto.content_id)
      .eq('language_type', createDto.language_type)
      .single();

    if (existingLanguageType) {
      const tipoTexto = createDto.language_type === LanguageType.DUBBED ? 'dublado' : 'legendado';
      throw new BadRequestException(`Já existe um arquivo ${tipoTexto} para este conteúdo`);
    }

    // Verificar se já existe um idioma padrão para este conteúdo
    if (createDto.is_default) {
      const { data: existingDefault } = await this.supabaseService.client
        .from('content_languages')
        .select('id')
        .eq('content_id', createDto.content_id)
        .eq('is_default', true)
        .single();

      if (existingDefault) {
        // Remover o padrão do idioma existente
        await this.supabaseService.client
          .from('content_languages')
          .update({ is_default: false })
          .eq('id', existingDefault.id);
      }
    }

    // Criar o novo idioma de conteúdo
    const { data, error } = await this.supabaseService.client
      .from('content_languages')
      .insert({
        content_id: createDto.content_id,
        language_type: createDto.language_type,
        language_code: createDto.language_code,
        language_name: createDto.language_name,
        video_storage_key: createDto.video_storage_key,
        is_default: createDto.is_default || false,
        is_active: true,
        upload_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Erro ao criar idioma de conteúdo: ${error.message}`);
    }

    return data;
  }

  async findByContentId(contentId: string): Promise<any[]> {
    const { data, error } = await this.supabaseService.client
      .from('content_languages')
      .select('*')
      .eq('content_id', contentId)
      .order('is_default', { ascending: false });

    if (error) {
      throw new BadRequestException(`Erro ao buscar idiomas do conteúdo: ${error.message}`);
    }

    return data || [];
  }

  async findOne(id: string): Promise<any> {
    const { data, error } = await this.supabaseService.client
      .from('content_languages')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Idioma de conteúdo com ID ${id} não encontrado`);
    }

    return data;
  }

  // Alias para compatibilidade com o controller
  async findById(id: string): Promise<any> {
    return this.findOne(id);
  }

  async update(id: string, updateDto: UpdateContentLanguageDto): Promise<any> {
    const { data, error } = await this.supabaseService.client
      .from('content_languages')
      .update({
        ...updateDto,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Erro ao atualizar idioma de conteúdo: ${error.message}`);
    }

    if (!data) {
      throw new NotFoundException(`Idioma de conteúdo com ID ${id} não encontrado`);
    }

    return data;
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabaseService.client
      .from('content_languages')
      .delete()
      .eq('id', id);

    if (error) {
      throw new BadRequestException(`Erro ao remover idioma de conteúdo: ${error.message}`);
    }
  }

  // Alias para compatibilidade com o controller
  async delete(id: string): Promise<void> {
    return this.remove(id);
  }

  async setDefault(id: string): Promise<any> {
    // Primeiro, buscar o idioma de conteúdo
    const contentLanguage = await this.findOne(id);

    // Remover o padrão de outros idiomas do mesmo conteúdo
    await this.supabaseService.client
      .from('content_languages')
      .update({ is_default: false })
      .eq('content_id', contentLanguage.content_id);

    // Definir este como padrão
    return this.update(id, { is_default: true });
  }

  // Alias para compatibilidade com o controller
  async setAsDefault(id: string): Promise<any> {
    return this.setDefault(id);
  }

  async getLanguageOptions(): Promise<{ code: LanguageCode; name: string }[]> {
    return [
      { code: LanguageCode.PT_BR, name: 'Português (Brasil)' },
      { code: LanguageCode.EN_US, name: 'English (US)' },
      { code: LanguageCode.ES_ES, name: 'Español (España)' },
      { code: LanguageCode.FR_FR, name: 'Français (France)' },
      { code: LanguageCode.IT_IT, name: 'Italiano (Italia)' },
      { code: LanguageCode.DE_DE, name: 'Deutsch (Deutschland)' },
      { code: LanguageCode.JA_JP, name: '日本語 (日本)' },
      { code: LanguageCode.KO_KR, name: '한국어 (대한민국)' },
      { code: LanguageCode.ZH_CN, name: '中文 (中国)' },
    ];
  }
}