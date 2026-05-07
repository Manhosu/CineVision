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
export type EditRequestType = 'update' | 'delete' | 'photo_replace';

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
        request_type: 'update',
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

  // A8 — solicitação de exclusão. Mesmo fluxo de aprovação que update,
  // só que `changes` é vazio e `request_type='delete'`. Aprovação
  // executa delete real via contentService.
  async submitDeleteRequest(input: { employeeId: string; contentId: string }) {
    const { employeeId, contentId } = input;

    const { data: content, error } = await this.supabase.client
      .from('content')
      .select('*')
      .eq('id', contentId)
      .single();

    if (error || !content) {
      throw new NotFoundException(`Content ${contentId} not found`);
    }

    // Bloqueia duplicata: se já existe delete pendente para este conteúdo,
    // não cria outro.
    const { data: existing } = await this.supabase.client
      .from('content_edit_requests')
      .select('id')
      .eq('content_id', contentId)
      .eq('request_type', 'delete')
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle();

    if (existing) {
      throw new BadRequestException(
        'Já existe uma solicitação de exclusão pendente para este conteúdo.',
      );
    }

    const { data: request, error: insErr } = await this.supabase.client
      .from('content_edit_requests')
      .insert({
        content_id: contentId,
        employee_id: employeeId,
        changes: {},
        original_snapshot: { title: content.title, content_type: content.content_type },
        status: 'pending',
        request_type: 'delete',
      })
      .select(
        `*, employee:employee_id(id, name, email), content:content_id(id, title, content_type, poster_url)`,
      )
      .single();

    if (insErr || !request) {
      throw new BadRequestException(
        `Falha ao registrar pedido de exclusão: ${insErr?.message}`,
      );
    }

    this.notifyAdminNewRequest(request).catch((e: any) =>
      this.logger.warn(`Notify admin failed: ${e.message}`),
    );

    return request;
  }

  // Igor (07/05): consolidacao do fluxo de aprovacao de foto de pessoa.
  // Antes tinha endpoint dedicado (/admin/photos-pending) com fila propria
  // em people.photo_pending_url. Agora substituicao FORA da janela vira
  // request aqui no mesmo painel de /admin/edit-requests.
  async submitPhotoReplaceRequest(input: {
    employeeId: string;
    personId: string;
    photoUrl: string;
  }) {
    const { employeeId, personId, photoUrl } = input;
    const trimmed = photoUrl?.trim();
    if (!trimmed) {
      throw new BadRequestException('photo_url e obrigatorio');
    }

    const { data: person, error } = await this.supabase.client
      .from('people')
      .select('id, name, role, photo_url')
      .eq('id', personId)
      .single();

    if (error || !person) {
      throw new NotFoundException(`Pessoa ${personId} nao encontrada`);
    }

    // Bloqueia duplicata: se ja existe photo_replace pendente, nao cria outro.
    const { data: existing } = await this.supabase.client
      .from('content_edit_requests')
      .select('id')
      .eq('person_id', personId)
      .eq('request_type', 'photo_replace')
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle();

    if (existing) {
      throw new BadRequestException(
        'Ja existe uma solicitacao de troca de foto pendente para esta pessoa.',
      );
    }

    const { data: request, error: insErr } = await this.supabase.client
      .from('content_edit_requests')
      .insert({
        content_id: null,
        person_id: personId,
        employee_id: employeeId,
        changes: { photo_url: trimmed },
        original_snapshot: { photo_url: person.photo_url, name: person.name, role: person.role },
        status: 'pending',
        request_type: 'photo_replace',
      })
      .select(
        `*, employee:employee_id(id, name, email), person:person_id(id, name, role, photo_url)`,
      )
      .single();

    if (insErr || !request) {
      throw new BadRequestException(
        `Falha ao registrar pedido de troca de foto: ${insErr?.message}`,
      );
    }

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
         content:content_id(id, title, content_type, poster_url, status),
         person:person_id(id, name, role, photo_url)`,
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
         person:person_id(id, name, role, photo_url),
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

    // Igor (07/05): photo_replace aplica a nova photo_url direto na pessoa
    // (mesmo padrao do approveDirect que existia em admin-people.service).
    if (request.request_type === 'photo_replace') {
      const newUrl = request.changes?.photo_url;
      if (!newUrl) {
        throw new BadRequestException('Pedido sem photo_url no changes.');
      }
      const now = new Date().toISOString();
      await this.supabase.client
        .from('people')
        .update({
          photo_url: newUrl,
          photo_added_by_user_id: request.employee_id,
          photo_added_at: now,
          // Limpa qualquer campo legado de pendencia/rejeicao.
          photo_pending_url: null,
          photo_pending_by_user_id: null,
          photo_pending_at: null,
          photo_rejected_at: null,
          photo_rejection_reason: null,
          updated_at: now,
        })
        .eq('id', request.person_id);

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

    // A8 — pedido de delete dispara delete real; pedido de update aplica
    // os changes. Update da request acontece antes do delete pra que
    // o status `approved` seja persistido mesmo se o conteúdo sumir
    // (FK `content_id` pode ficar órfã, mas o histórico continua).
    if (request.request_type === 'delete') {
      await this.supabase.client
        .from('content_edit_requests')
        .update({
          status: 'approved',
          reviewer_id: reviewerId,
          reviewer_notes: reviewerNotes || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);
      await this.contentService.deleteContent(request.content_id);
      // Após delete o getById falha (FK órfã); retorna o último estado conhecido.
      return { ...request, status: 'approved', reviewer_id: reviewerId, reviewed_at: new Date().toISOString() };
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
    const person = Array.isArray(request.person) ? request.person[0] : request.person;
    const fields = Object.keys(request.changes || {});

    const fieldsLine = fields.length > 6
      ? fields.slice(0, 6).join(', ') + ` (+${fields.length - 6})`
      : fields.join(', ');

    let text: string;
    if (request.request_type === 'photo_replace') {
      text =
        `📷 *Nova troca de foto aguardando aprovação*\n\n` +
        `*Funcionário:* ${employee?.name || '—'} (${employee?.email || '—'})\n` +
        `*Pessoa:* ${person?.name || request.person_id} (${person?.role || '—'})\n\n` +
        `Acesse o painel admin → "Edições pendentes" para revisar.`;
    } else if (request.request_type === 'delete') {
      text =
        `🗑️ *Nova solicitação de exclusão aguardando aprovação*\n\n` +
        `*Funcionário:* ${employee?.name || '—'} (${employee?.email || '—'})\n` +
        `*Conteúdo:* ${content?.title || request.content_id}\n\n` +
        `Acesse o painel admin → "Edições pendentes" para revisar.`;
    } else {
      text =
        `📝 *Nova edição aguardando aprovação*\n\n` +
        `*Funcionário:* ${employee?.name || '—'} (${employee?.email || '—'})\n` +
        `*Conteúdo:* ${content?.title || request.content_id}\n` +
        `*Campos alterados:* ${fieldsLine || '(nenhum)'}\n\n` +
        `Acesse o painel admin → "Edições pendentes" para revisar.`;
    }

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
