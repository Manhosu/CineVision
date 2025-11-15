import { Injectable, NotFoundException, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentRequest, RequestStatus } from './entities/content-request.entity';
import { CreateContentRequestDto, UpdateContentRequestDto, ContentRequestResponseDto } from './dto';
import { TelegramsEnhancedService } from '../telegrams/telegrams-enhanced.service';

@Injectable()
export class RequestsService {
  private readonly logger = new Logger(RequestsService.name);

  constructor(
    @InjectRepository(ContentRequest)
    private requestRepository: Repository<ContentRequest>,
    @Inject(forwardRef(() => TelegramsEnhancedService))
    private readonly telegramsService: TelegramsEnhancedService,
  ) {}

  async createRequest(dto: CreateContentRequestDto): Promise<ContentRequestResponseDto> {
    // Check if request for this title already exists and is pending
    const existingRequest = await this.requestRepository.findOne({
      where: {
        requested_title: dto.title,
        status: RequestStatus.PENDING,
      },
    });

    if (existingRequest) {
      throw new BadRequestException('A request for this movie already exists and is pending review');
    }

    const request = this.requestRepository.create({
      requested_title: dto.title,
      description: dto.description,
      telegram_chat_id: dto.telegram_id,
      user_id: dto.user_id,
      status: RequestStatus.PENDING,
    });

    const savedRequest = await this.requestRepository.save(request);

    return this.mapToResponseDto(savedRequest);
  }

  async findAllRequests(page = 1, limit = 20, status?: RequestStatus) {
    const queryBuilder = this.requestRepository.createQueryBuilder('request')
      .leftJoinAndSelect('request.user', 'user')
      .select([
        'request',
        'user.id',
        'user.name',
        'user.email',
        'user.telegram_id',
        'user.telegram_username'
      ])
      .orderBy('request.created_at', 'DESC');

    if (status) {
      queryBuilder.where('request.status = :status', { status });
    }

    const [requests, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      requests: requests.map(request => this.mapToResponseDto(request)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  async findRequestById(id: string): Promise<ContentRequestResponseDto> {
    const request = await this.requestRepository.findOne({
      where: { id },
      relations: ['user'],
      select: {
        user: {
          id: true,
          name: true,
          email: true,
          telegram_id: true,
          telegram_username: true,
        },
      },
    });

    if (!request) {
      throw new NotFoundException(`Request with ID ${id} not found`);
    }

    return this.mapToResponseDto(request);
  }

  async updateRequest(id: string, dto: UpdateContentRequestDto): Promise<ContentRequestResponseDto> {
    const request = await this.requestRepository.findOne({
      where: { id },
      relations: ['user'],
      select: {
        user: {
          id: true,
          name: true,
          email: true,
          telegram_id: true,
          telegram_username: true,
        },
      },
    });

    if (!request) {
      throw new NotFoundException(`Request with ID ${id} not found`);
    }

    const wasNotCompleted = request.status !== RequestStatus.COMPLETED;
    const isBeingCompleted = dto.status === RequestStatus.COMPLETED;

    // Update fields if provided
    if (dto.status) {
      request.status = dto.status;
    }
    if (dto.admin_notes !== undefined) {
      request.admin_notes = dto.admin_notes;
    }
    if (dto.priority) {
      request.priority = dto.priority as any;
    }

    // Set completed date if status is being changed to completed
    if (dto.status && dto.status === RequestStatus.COMPLETED && !request.completed_at) {
      request.completed_at = new Date();
    }

    const updatedRequest = await this.requestRepository.save(request);

    // Send Telegram notification if status changed to completed
    if (wasNotCompleted && isBeingCompleted && request.telegram_chat_id) {
      await this.sendCompletionNotification(request);
    }

    return this.mapToResponseDto(updatedRequest);
  }

  async deleteRequest(id: string): Promise<void> {
    const result = await this.requestRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`Request with ID ${id} not found`);
    }
  }

  async findRequestsByUser(userId: string): Promise<ContentRequestResponseDto[]> {
    const requests = await this.requestRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });

    return requests.map(request => this.mapToResponseDto(request));
  }

  async findRequestsByTelegramId(telegramId: string): Promise<ContentRequestResponseDto[]> {
    const requests = await this.requestRepository.find({
      where: { telegram_chat_id: telegramId },
      order: { created_at: 'DESC' },
    });

    return requests.map(request => this.mapToResponseDto(request));
  }

  async getRequestStats() {
    const [pending, completed, rejected, total] = await Promise.all([
      this.requestRepository.count({ where: { status: RequestStatus.PENDING } }),
      this.requestRepository.count({ where: { status: RequestStatus.COMPLETED } }),
      this.requestRepository.count({ where: { status: RequestStatus.REJECTED } }),
      this.requestRepository.count(),
    ]);

    return {
      pending,
      approved: completed, // Map completed to approved for frontend compatibility
      rejected,
      total,
    };
  }

  /**
   * Send Telegram notification when a content request is marked as completed
   */
  private async sendCompletionNotification(request: ContentRequest): Promise<void> {
    try {
      if (!request.telegram_chat_id) {
        this.logger.warn(`Cannot send notification - no telegram_chat_id for request ${request.id}`);
        return;
      }

      const message = `🎉 **Pedido Concluído!**\n\n` +
        `✅ Seu pedido de "${request.requested_title}" foi adicionado à plataforma!\n\n` +
        `🎬 O conteúdo já está disponível para compra.\n\n` +
        `📱 Digite /start para iniciar o bot e efetuar a compra do filme ou série solicitado.`;

      await this.telegramsService.sendMessage(
        parseInt(request.telegram_chat_id),
        message,
        { parse_mode: 'Markdown' }
      );

      // Mark notification as sent
      await this.requestRepository.update(request.id, { notification_sent: true });

      this.logger.log(`Completion notification sent for request ${request.id} to chat ${request.telegram_chat_id}`);
    } catch (error) {
      this.logger.error(`Failed to send completion notification for request ${request.id}:`, error);
      // Don't throw - we don't want to fail the update if notification fails
    }
  }

  private mapToResponseDto(request: ContentRequest): ContentRequestResponseDto {
    return {
      id: request.id,
      title: request.requested_title,
      description: request.description,
      status: request.status,
      priority: request.priority,
      admin_notes: request.admin_notes,
      assigned_to: undefined, // Not available in current entity
      requester_telegram_id: request.telegram_chat_id,
      requester_telegram_username: request.user?.telegram_username,
      requester_telegram_first_name: request.user?.name,
      user_id: request.user_id,
      telegram_user_id: request.user?.telegram_id,
      created_at: request.created_at,
      updated_at: request.updated_at,
      processed_at: request.completed_at,
      completed_at: request.completed_at,
    };
  }
}