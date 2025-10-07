import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentLanguage, LanguageType, LanguageCode } from '../entities/content-language.entity';
import { Content } from '../entities/content.entity';

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
export class ContentLanguageService {
  constructor(
    @InjectRepository(ContentLanguage)
    private readonly contentLanguageRepository: Repository<ContentLanguage>,
    @InjectRepository(Content)
    private readonly contentRepository: Repository<Content>,
  ) {}

  async create(createDto: CreateContentLanguageDto): Promise<ContentLanguage> {
    // Verificar se o conteúdo existe
    const content = await this.contentRepository.findOne({
      where: { id: createDto.content_id },
    });

    if (!content) {
      throw new NotFoundException('Conteúdo não encontrado');
    }

    // Verificar se já existe um idioma com o mesmo tipo e código para este conteúdo
    const existingLanguage = await this.contentLanguageRepository.findOne({
      where: {
        content_id: createDto.content_id,
        language_type: createDto.language_type,
        language_code: createDto.language_code,
      },
    });

    if (existingLanguage) {
      throw new BadRequestException(
        `Já existe um ${createDto.language_type} em ${createDto.language_code} para este conteúdo`,
      );
    }

    // Se este for marcado como padrão, desmarcar outros como padrão
    if (createDto.is_default) {
      await this.contentLanguageRepository.update(
        { content_id: createDto.content_id },
        { is_default: false },
      );
    }

    const contentLanguage = this.contentLanguageRepository.create(createDto);
    return await this.contentLanguageRepository.save(contentLanguage);
  }

  async findByContentId(contentId: string): Promise<ContentLanguage[]> {
    return await this.contentLanguageRepository.find({
      where: { content_id: contentId, is_active: true },
      order: { is_default: 'DESC', language_code: 'ASC' },
    });
  }

  async findById(id: string): Promise<ContentLanguage> {
    const contentLanguage = await this.contentLanguageRepository.findOne({
      where: { id },
      relations: ['content'],
    });

    if (!contentLanguage) {
      throw new NotFoundException('Idioma de conteúdo não encontrado');
    }

    return contentLanguage;
  }

  async update(id: string, updateDto: UpdateContentLanguageDto): Promise<ContentLanguage> {
    const contentLanguage = await this.findById(id);

    // Se este for marcado como padrão, desmarcar outros como padrão
    if (updateDto.is_default) {
      await this.contentLanguageRepository.update(
        { content_id: contentLanguage.content_id, id: { $ne: id } as any },
        { is_default: false },
      );
    }

    Object.assign(contentLanguage, updateDto);
    return await this.contentLanguageRepository.save(contentLanguage);
  }

  async delete(id: string): Promise<void> {
    const contentLanguage = await this.findById(id);
    await this.contentLanguageRepository.remove(contentLanguage);
  }

  async setAsDefault(id: string): Promise<ContentLanguage> {
    const contentLanguage = await this.findById(id);

    // Desmarcar outros como padrão
    await this.contentLanguageRepository.update(
      { content_id: contentLanguage.content_id },
      { is_default: false },
    );

    // Marcar este como padrão
    contentLanguage.is_default = true;
    return await this.contentLanguageRepository.save(contentLanguage);
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