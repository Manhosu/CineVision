import { Injectable, NotFoundException, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { RequestStatus } from './entities/content-request.entity';
import { CreateContentRequestDto, UpdateContentRequestDto, ContentRequestResponseDto } from './dto';
import { SupabaseService } from '../../config/supabase.service';
import { TelegramsEnhancedService } from '../telegrams/telegrams-enhanced.service';

@Injectable()
export class RequestsSupabaseService {
  private readonly logger = new Logger(RequestsSupabaseService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject(forwardRef(() => TelegramsEnhancedService))
    private readonly telegramsService: TelegramsEnhancedService,
  ) {}

  private get supabase() {
    return this.supabaseService.client;
  }

  async createRequest(dto: CreateContentRequestDto): Promise<ContentRequestResponseDto> {
    // Check if request for this title already exists and is pending
    const { data: existingRequest } = await this.supabase
      .from('content_requests')
      .select('*')
      .eq('requested_title', dto.title)
      .eq('status', RequestStatus.PENDING)
      .single();

    if (existingRequest) {
      throw new BadRequestException('A request for this movie already exists and is pending review');
    }

    const { data, error } = await this.supabase
      .from('content_requests')
      .insert({
        requested_title: dto.title,
        description: dto.description,
        telegram_chat_id: dto.telegram_id,
        user_id: dto.user_id,
        user_email: dto.user_email,
        notify_when_added: dto.notify_when_added !== undefined ? dto.notify_when_added : true,
        status: RequestStatus.PENDING,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Failed to create request: ${error.message}`);
    }

    return this.mapToResponseDto(data);
  }

  /**
   * Notifica usuários que solicitaram um conteúdo quando ele for adicionado
   */
  async notifyRequesters(contentTitle: string, contentId: string): Promise<void> {
    try {
      // Buscar todas as solicitações pendentes para este título que querem notificação
      const { data: requests, error } = await this.supabase
        .from('content_requests')
        .select('*')
        .ilike('requested_title', `%${contentTitle}%`)
        .eq('status', RequestStatus.PENDING)
        .eq('notify_when_added', true)
        .is('notified_at', null);

      if (error || !requests || requests.length === 0) {
        return;
      }

      console.log(`[RequestsService] Found ${requests.length} requests to notify for: ${contentTitle}`);

      // Enviar notificação para cada solicitante via Telegram
      for (const request of requests) {
        try {
          if (request.telegram_chat_id) {
            // Enviar notificação via Telegram
            const message = `🎬 Boa notícia!\n\nO conteúdo "${contentTitle}" que você solicitou já foi adicionado ao nosso site!\n\n✨ Assista agora: ${process.env.FRONTEND_URL || 'https://www.cinevisionapp.com.br'}/watch/${contentId}\n\n🎉 Aproveite!`;

            await fetch(`${process.env.API_URL || 'http://localhost:3001'}/api/v1/telegrams/send-notification`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chatId: request.telegram_chat_id,
                message,
              }),
            });

            console.log(`[RequestsService] Telegram notification sent to chat_id: ${request.telegram_chat_id}`);
          }

          // Marcar como notificado
          await this.supabase
            .from('content_requests')
            .update({
              notified_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', request.id);

        } catch (notifyError) {
          console.error(`[RequestsService] Error notifying request ${request.id}:`, notifyError);
        }
      }

      console.log(`[RequestsService] Notification process completed for: ${contentTitle}`);
    } catch (error) {
      console.error(`[RequestsService] Error in notifyRequesters:`, error);
    }
  }

  async findAllRequests(page = 1, limit = 20, status?: RequestStatus) {
    let query = this.supabase
      .from('content_requests')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, count, error} = await query
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      throw new BadRequestException(`Failed to fetch requests: ${error.message}`);
    }

    // Fetch user data for each request
    const requestsWithUsers = await Promise.all(
      (data || []).map(async (request) => {
        if (request.user_id) {
          const { data: userData } = await this.supabase
            .from('users')
            .select('telegram_id, telegram_username, name')
            .eq('id', request.user_id)
            .single();

          return { ...request, users: userData };
        }
        return { ...request, users: null };
      })
    );

    return {
      requests: requestsWithUsers.map(request => this.mapToResponseDto(request)),
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasNext: page < Math.ceil((count || 0) / limit),
        hasPrev: page > 1,
      },
    };
  }

  async getRequestStats() {
    const { data, error } = await this.supabase
      .from('content_requests')
      .select('status');

    if (error) {
      throw new BadRequestException(`Failed to fetch request stats: ${error.message}`);
    }

    const stats = {
      total: data?.length || 0,
      pending: data?.filter(r => r.status === RequestStatus.PENDING).length || 0,
      approved: data?.filter(r => r.status === RequestStatus.COMPLETED).length || 0,
      rejected: data?.filter(r => r.status === RequestStatus.REJECTED).length || 0,
    };

    return stats;
  }

  async findRequestById(id: string): Promise<ContentRequestResponseDto> {
    const { data, error } = await this.supabase
      .from('content_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Request with ID ${id} not found`);
    }

    // Fetch user data if user_id exists
    let userData = null;
    if (data.user_id) {
      const { data: user } = await this.supabase
        .from('users')
        .select('telegram_id, telegram_username, name')
        .eq('id', data.user_id)
        .single();
      userData = user;
    }

    return this.mapToResponseDto({ ...data, users: userData });
  }

  async findRequestsByUser(userId: string): Promise<ContentRequestResponseDto[]> {
    const { data, error } = await this.supabase
      .from('content_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`Failed to fetch user requests: ${error.message}`);
    }

    return (data || []).map(request => this.mapToResponseDto(request));
  }

  async findRequestsByTelegramId(telegramId: string): Promise<ContentRequestResponseDto[]> {
    const { data, error } = await this.supabase
      .from('content_requests')
      .select('*')
      .eq('telegram_chat_id', telegramId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`Failed to fetch telegram requests: ${error.message}`);
    }

    return (data || []).map(request => this.mapToResponseDto(request));
  }

  async updateRequest(id: string, dto: UpdateContentRequestDto): Promise<ContentRequestResponseDto> {
    const { data: existingRequest, error: fetchError } = await this.supabase
      .from('content_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingRequest) {
      throw new NotFoundException(`Request with ID ${id} not found`);
    }

    const wasNotCompleted = existingRequest.status !== RequestStatus.COMPLETED;
    const isBeingCompleted = dto.status === RequestStatus.COMPLETED;

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (dto.status) {
      updateData.status = dto.status;
    }
    if (dto.admin_notes !== undefined) {
      updateData.admin_notes = dto.admin_notes;
    }
    if (dto.priority) {
      updateData.priority = dto.priority;
    }

    // Set completed date if status is being changed to completed
    if (dto.status && dto.status === RequestStatus.COMPLETED && !existingRequest.completed_at) {
      updateData.completed_at = new Date().toISOString();
    }

    const { data, error } = await this.supabase
      .from('content_requests')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new BadRequestException(`Failed to update request: ${error.message}`);
    }

    // Send Telegram notification if status changed to completed
    if (wasNotCompleted && isBeingCompleted && existingRequest.telegram_chat_id) {
      await this.sendCompletionNotification(existingRequest);
    }

    // Fetch user data if user_id exists
    let userData = null;
    if (data.user_id) {
      const { data: user } = await this.supabase
        .from('users')
        .select('telegram_id, telegram_username, name')
        .eq('id', data.user_id)
        .single();
      userData = user;
    }

    return this.mapToResponseDto({ ...data, users: userData });
  }

  /**
   * Send Telegram notification when a content request is marked as completed
   */
  private async sendCompletionNotification(request: any): Promise<void> {
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
      await this.supabase
        .from('content_requests')
        .update({
          notification_sent: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      this.logger.log(`Completion notification sent for request ${request.id} to chat ${request.telegram_chat_id}`);
    } catch (error) {
      this.logger.error(`Failed to send completion notification for request ${request.id}:`, error);
      // Don't throw - we don't want to fail the update if notification fails
    }
  }

  async deleteRequest(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('content_requests')
      .delete()
      .eq('id', id);

    if (error) {
      throw new BadRequestException(`Failed to delete request: ${error.message}`);
    }
  }

  private mapToResponseDto(request: any): ContentRequestResponseDto {
    // Handle joined user data - Supabase returns it as an object or null
    const user = request.users;

    return {
      id: request.id,
      title: request.requested_title,
      description: request.description,
      status: request.status,
      priority: request.priority,
      requester_telegram_id: request.telegram_chat_id,
      requester_telegram_first_name: user?.name,
      requester_telegram_username: user?.telegram_username,
      telegram_user_id: user?.telegram_id,
      user_id: request.user_id,
      admin_notes: request.admin_notes,
      created_at: request.created_at,
      updated_at: request.updated_at,
      completed_at: request.completed_at,
      processed_at: request.completed_at,
    };
  }
}
