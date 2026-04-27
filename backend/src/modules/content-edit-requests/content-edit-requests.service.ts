import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../config/supabase.service';
import { AdminContentSimpleService } from '../admin/services/admin-content-simple.service';
import { TelegramsEnhancedService } from '../telegrams/telegrams-enhanced.service';

export type EditRequestStatus = 'pending' | 'approved' | 'rejected';

@Injectable()
export class ContentEditRequestsService {
  private readonly logger = new Logger(ContentEditRequestsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly contentService: AdminContentSimpleService,
    private readonly configService: ConfigService,
    @Optional()
    @Inject(forwardRef(() => TelegramsEnhancedService))
    private readonly telegramsService?: TelegramsEnhancedService,
  ) {}

  // ---------------------------------------------------------------------------
  // Filter changes — only keep keys that actually differ from the snapshot,
  // so admin reviews real diffs (not noise).
  // ---------------------------------------------------------------------------
  private diffOnly(snapshot: any, changes: any): Record<string, any> {
    const diff: Record<string, any> = {};
    for (const [k, v] of Object.entries(changes || {})) {
      if (v === undefined) continue;
      if (JSON.stringify(snapshot?.[k]) !== JSON.stringify(v)) {
        diff[k] = v;
      }
    }
    return diff;
  }

  async submitEditRequest(input: {
    employeeId: string;
    contentId: string;
    proposedChanges: Record<string, any>;
  }) {
    const { employeeId, contentId, proposedChanges } = input;

    const { data: content, error } = await this.supabase.client
      .from('content')
      .select('*')
      .eq('id', contentId)
      .single();

    if (error || !content) {
      throw new NotFoundException(`Content ${contentId} not found`);
    }

    const diff = this.diffOnly(content, proposedChanges);
    if (!Object.keys(diff).length) {
      throw new BadRequestException('Nenhuma alteração detectada nos campos.');
    }

    const snapshot: Record<string, any> = {};
    Object.keys(diff).forEach((k) => (snapshot[k] = (content as any)[k] ?? null));

    const { data: request, error: insErr } = await this.supabase.client
      .from('content_edit_requests')
      .insert({
        content_id: contentId,
        employee_id: employeeId,
        changes: diff,
        original_snapshot: snapshot,
        status: 'pending',
      })
      .select(
        `*, employee:employee_id(id, name, email), content:content_id(id, title, content_type, poster_url)`,
      )
      .single();

    if (insErr || !request) {
      throw new BadRequestException(
        `Falha ao registrar pedido de edição: ${insErr?.message}`,
      );
    }

    // Notify the master admin via Telegram (best-effort)
    this.notifyAdminNewRequest(request).catch((e: any) =>
      this.logger.warn(`Notify admin failed: ${e.message}`),
    );

    return request;
  }

  // ---------------------------------------------------------------------------
  // Listing / details
  // ---------------------------------------------------------------------------
  async list(status?: EditRequestStatus, limit = 50) {
    let q = this.supabase.client
      .from('content_edit_requests')
      .select(
        `*,
         employee:employee_id(id, name, email),
         content:content_id(id, title, content_type, poster_url, status)`,
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) q = q.eq('status', status);

    const { data, error } = await q;
    if (error) {
      this.logger.error('List edit requests failed', error);
      return [];
    }
    return data || [];
  }

  async getById(id: string) {
    const { data } = await this.supabase.client
      .from('content_edit_requests')
      .select(
        `*,
         employee:employee_id(id, name, email),
         content:content_id(id, title, content_type, poster_url, status),
         reviewer:reviewer_id(id, name, email)`,
      )
      .eq('id', id)
      .maybeSingle();
    if (!data) throw new NotFoundException('Pedido de edição não encontrado');
    return data;
  }

  async countPending(): Promise<number> {
    const { count } = await this.supabase.client
      .from('content_edit_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    return count || 0;
  }

  // ---------------------------------------------------------------------------
  // Approval flow
  // ---------------------------------------------------------------------------
  async approve(id: string, reviewerId: string, reviewerNotes?: string) {
    const request = await this.getById(id);
    if (request.status !== 'pending') {
      throw new BadRequestException('Pedido já foi processado.');
    }

    // Apply the changes to the content via the existing service
    await this.contentService.updateContent(request.content_id, request.changes);

    await this.supabase.client
      .from('content_edit_requests')
      .update({
        status: 'approved',
        reviewer_id: reviewerId,
        reviewer_notes: reviewerNotes || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id);

    return this.getById(id);
  }

  async reject(id: string, reviewerId: string, reviewerNotes?: string) {
    const request = await this.getById(id);
    if (request.status !== 'pending') {
      throw new BadRequestException('Pedido já foi processado.');
    }

    await this.supabase.client
      .from('content_edit_requests')
      .update({
        status: 'rejected',
        reviewer_id: reviewerId,
        reviewer_notes: reviewerNotes || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id);

    return this.getById(id);
  }

  // ---------------------------------------------------------------------------
  // Notify master admin via Telegram
  // ---------------------------------------------------------------------------
  private async notifyAdminNewRequest(request: any) {
    const adminChatId = this.configService.get<string>('TELEGRAM_ADMIN_CHAT_ID');
    if (!adminChatId || !this.telegramsService) return;

    const chatId = parseInt(adminChatId, 10);
    if (Number.isNaN(chatId)) return;

    const employee = Array.isArray(request.employee) ? request.employee[0] : request.employee;
    const content = Array.isArray(request.content) ? request.content[0] : request.content;
    const fields = Object.keys(request.changes || {});

    const fieldsLine = fields.length > 6
      ? fields.slice(0, 6).join(', ') + ` (+${fields.length - 6})`
      : fields.join(', ');

    const text =
      `📝 *Nova edição aguardando aprovação*\n\n` +
      `*Funcionário:* ${employee?.name || '—'} (${employee?.email || '—'})\n` +
      `*Conteúdo:* ${content?.title || request.content_id}\n` +
      `*Campos alterados:* ${fieldsLine || '(nenhum)'}\n\n` +
      `Acesse o painel admin → "Edições pendentes" para revisar.`;

    await this.telegramsService.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  }

  // ---------------------------------------------------------------------------
  // Employee-facing view: list their own requests
  // ---------------------------------------------------------------------------
  async listByEmployee(employeeId: string) {
    const { data } = await this.supabase.client
      .from('content_edit_requests')
      .select(
        `*,
         content:content_id(id, title, content_type, poster_url),
         reviewer:reviewer_id(id, name)`,
      )
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
      .limit(50);
    return data || [];
  }
}
