import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentRequest, RequestStatus } from './entities/content-request.entity';
import { CreateContentRequestDto, UpdateContentRequestDto, ContentRequestResponseDto } from './dto';

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(ContentRequest)
    private requestRepository: Repository<ContentRequest>,
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
    });

    if (!request) {
      throw new NotFoundException(`Request with ID ${id} not found`);
    }

    return this.mapToResponseDto(request);
  }

  async updateRequest(id: string, dto: UpdateContentRequestDto): Promise<ContentRequestResponseDto> {
    const request = await this.requestRepository.findOne({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException(`Request with ID ${id} not found`);
    }

    // Update fields if provided
    if (dto.status) {
      request.status = dto.status;
    }
    if (dto.admin_notes) {
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