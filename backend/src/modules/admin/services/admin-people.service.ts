import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { SupabaseService } from '../../../config/supabase.service';
import { EmployeesService } from '../../employees/employees.service';
import { ContentEditRequestsService } from '../../content-edit-requests/content-edit-requests.service';

export type PhotoStatus = 'missing' | 'pending' | 'approved' | 'all';

@Injectable()
export class AdminPeopleService {
  private readonly logger = new Logger(AdminPeopleService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly employeesService: EmployeesService,
    @Optional()
    @Inject(forwardRef(() => ContentEditRequestsService))
    private readonly editRequestsService?: ContentEditRequestsService,
  ) {}

  async findAll(search?: string, role?: string, photoStatus: PhotoStatus = 'all') {
    // Igor (16/05): o Supabase corta queries em 1000 rows por padrão.
    // people tem ~1440 e content_people ~2140 — sem paginar, a lista
    // travava em 1000 pessoas e a contagem de conteúdos saía errada
    // (a maioria dos atores aparecia com 0 ou 1). Agora paginamos as
    // duas queries em loop até esgotar.
    const PAGE = 1000;

    // 1. people (com filtros) — paginado
    const buildPeopleQuery = (from: number, to: number) => {
      let q = this.supabaseService.client
        .from('people')
        .select('*')
        .order('name', { ascending: true })
        .range(from, to);
      if (search) q = q.ilike('name', `%${search}%`);
      if (role) q = q.eq('role', role);
      if (photoStatus === 'missing') {
        q = q.is('photo_url', null).is('photo_pending_url', null);
      } else if (photoStatus === 'pending') {
        q = q.not('photo_pending_url', 'is', null);
      } else if (photoStatus === 'approved') {
        q = q.not('photo_url', 'is', null);
      }
      return q;
    };

    const people: any[] = [];
    for (let page = 0; page < 100; page++) {
      const from = page * PAGE;
      const { data, error } = await buildPeopleQuery(from, from + PAGE - 1);
      if (error) throw new Error(`Failed to fetch people: ${error.message}`);
      if (data && data.length) people.push(...data);
      if (!data || data.length < PAGE) break;
    }

    // 2. content_people — paginado, pra contagem real de conteúdos/pessoa
    const countMap = new Map<string, number>();
    for (let page = 0; page < 100; page++) {
      const from = page * PAGE;
      const { data, error } = await this.supabaseService.client
        .from('content_people')
        .select('person_id')
        .range(from, from + PAGE - 1);
      if (error) {
        this.logger.warn(`Failed to page content_people: ${error.message}`);
        break;
      }
      if (data && data.length) {
        for (const row of data) {
          countMap.set(row.person_id, (countMap.get(row.person_id) || 0) + 1);
        }
      }
      if (!data || data.length < PAGE) break;
    }

    return people.map((person) => ({
      ...person,
      content_count: countMap.get(person.id) || 0,
    }));
  }

  async findById(id: string) {
    const { data, error } = await this.supabaseService.client
      .from('people')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException(`Person not found`);
    return data;
  }

  async findByIdWithContent(id: string) {
    const person = await this.findById(id);

    const { data: links } = await this.supabaseService.client
      .from('content_people')
      .select('content_id, role, character_name, display_order')
      .eq('person_id', id)
      .order('display_order', { ascending: true });

    if (!links || links.length === 0) {
      return { ...person, contents: [] };
    }

    const contentIds = links.map((l) => l.content_id);
    const { data: contents } = await this.supabaseService.client
      .from('content')
      .select('*')
      .in('id', contentIds)
      .eq('status', 'PUBLISHED');

    return { ...person, contents: contents || [] };
  }

  async create(data: { name: string; role?: string; photo_url?: string; bio?: string }) {
    const { data: person, error } = await this.supabaseService.client
      .from('people')
      .insert({
        name: data.name.trim(),
        role: data.role || 'actor',
        photo_url: data.photo_url || null,
        bio: data.bio || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        const { data: existing } = await this.supabaseService.client
          .from('people')
          .select('*')
          .ilike('name', data.name.trim())
          .eq('role', data.role || 'actor')
          .single();
        return existing;
      }
      throw new Error(`Failed to create person: ${error.message}`);
    }
    return person;
  }

  async findOrCreate(name: string, role: string = 'actor') {
    const trimmed = name.trim();
    if (!trimmed) return null;

    const { data: existing } = await this.supabaseService.client
      .from('people')
      .select('*')
      .ilike('name', trimmed)
      .eq('role', role)
      .limit(1)
      .single();

    if (existing) return existing;

    return this.create({ name: trimmed, role });
  }

  async update(
    id: string,
    data: { name?: string; photo_url?: string; bio?: string; role?: string },
  ) {
    // Admin update path (sem ownership tracking).
    const updatePayload: any = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) updatePayload.name = data.name.trim();
    if (data.photo_url !== undefined) updatePayload.photo_url = data.photo_url;
    if (data.bio !== undefined) updatePayload.bio = data.bio;
    if (data.role !== undefined) updatePayload.role = data.role;

    const { data: person, error } = await this.supabaseService.client
      .from('people')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update person: ${error.message}`);
    return person;
  }

  async delete(id: string) {
    const { error } = await this.supabaseService.client
      .from('people')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete person: ${error.message}`);
    return { success: true };
  }

  async syncContentPeople(contentId: string, actors: string[], director?: string) {
    await this.supabaseService.client
      .from('content_people')
      .delete()
      .eq('content_id', contentId);

    const inserts: any[] = [];

    for (let i = 0; i < actors.length; i++) {
      const name = actors[i]?.trim();
      if (!name) continue;
      const person = await this.findOrCreate(name, 'actor');
      if (person) {
        inserts.push({
          content_id: contentId,
          person_id: person.id,
          role: 'actor',
          display_order: i,
        });
      }
    }

    if (director?.trim()) {
      const directors = director.split(',').map((d) => d.trim()).filter(Boolean);
      for (let i = 0; i < directors.length; i++) {
        const person = await this.findOrCreate(directors[i], 'director');
        if (person) {
          inserts.push({
            content_id: contentId,
            person_id: person.id,
            role: 'director',
            display_order: i,
          });
        }
      }
    }

    if (inserts.length > 0) {
      const { error } = await this.supabaseService.client
        .from('content_people')
        .insert(inserts);
      if (error) {
        this.logger.error(`Failed to sync content_people: ${error.message}`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // IMG_8846 — Photo workflow (admin direct, employee submits to pending)
  // ---------------------------------------------------------------------------

  /**
   * Admin: foto sempre direto em `photo_url`, com ownership.
   * Employee (Igor 07/05):
   *   - Pessoa SEM foto (criação inicial) → DIRETO em photo_url (auto-aprovado).
   *   - Pessoa COM foto + dentro da janela `edit_window_hours` → DIRETO (substitui).
   *   - Pessoa COM foto + fora da janela → vai pra `photo_pending_url` (fila).
   *   - Pendência ativa de outro funcionário → bloqueia pra evitar race.
   * Roles abaixo de admin/employee são bloqueadas (validado no controller).
   */
  async submitPhoto(personId: string, photoUrl: string, actorUserId: string, isAdmin: boolean) {
    if (!photoUrl?.trim()) {
      throw new BadRequestException('photo_url é obrigatório');
    }

    const person = await this.findById(personId);
    const now = new Date().toISOString();
    const trimmed = photoUrl.trim();

    // Helper: aplicar foto direto em photo_url (path "approved").
    const approveDirect = async () => {
      const { data: updated, error } = await this.supabaseService.client
        .from('people')
        .update({
          photo_url: trimmed,
          photo_added_by_user_id: actorUserId,
          photo_added_at: now,
          // Limpa qualquer pendência/rejeição prévia.
          photo_pending_url: null,
          photo_pending_by_user_id: null,
          photo_pending_at: null,
          photo_rejected_at: null,
          photo_rejection_reason: null,
          updated_at: now,
        })
        .eq('id', personId)
        .select()
        .single();
      if (error) throw new Error(`Failed to set photo: ${error.message}`);
      return { status: 'approved' as const, person: updated };
    };

    // Igor (07/05): substituicao de foto fora da janela vai pro mesmo
    // sistema de aprovacao do /admin/edit-requests (em vez do
    // photo_pending_url legado). Mantem coerencia com fluxo de delete/edit.
    const submitToEditRequest = async () => {
      if (!this.editRequestsService) {
        throw new Error('ContentEditRequestsService unavailable');
      }
      await this.editRequestsService.submitPhotoReplaceRequest({
        employeeId: actorUserId,
        personId,
        photoUrl: trimmed,
      });
      return { status: 'pending' as const, person };
    };

    // Admin: sempre direto.
    if (isAdmin) {
      return approveDirect();
    }

    // Path do funcionário.
    const perms = await this.employeesService.getPermissions(actorUserId);
    if (!perms?.can_add_people_photos) {
      throw new ForbiddenException('Sem permissão para adicionar fotos');
    }

    // Caso 1: pessoa NUNCA teve foto → criação inicial → aprovação direta.
    if (!person.photo_url) {
      return approveDirect();
    }

    // Caso 2: pessoa JÁ tem foto → substituição. Aplica janela de edição.
    // Janela usa `edit_window_hours` do funcionário, com referência em
    // `photo_added_at` (último approve) ou `created_at` da pessoa como
    // fallback. Mesmo padrão do `getEditCapability` em conteúdo.
    const windowHours = perms.edit_window_hours ?? 5;
    const referenceTime = person.photo_added_at || person.created_at;
    const ageMs = referenceTime
      ? Date.now() - new Date(referenceTime).getTime()
      : Number.POSITIVE_INFINITY;
    const maxMs = windowHours * 60 * 60 * 1000;

    if (ageMs <= maxMs) {
      // Dentro da janela → substitui direto em photo_url.
      return approveDirect();
    }

    // Fora da janela → vai pro /admin/edit-requests (mesmo sistema de
    // aprovacao que delete/update de conteudo). submitPhotoReplaceRequest
    // ja trata bloqueio de duplicata pendente.
    return submitToEditRequest();
  }

  /**
   * Stats do workflow de fotos pra admin entender o estado:
   *  - pending: fotos aguardando aprovação (o que o /admin/photos-pending mostra)
   *  - missing: pessoas sem foto e sem submissão pendente
   *  - approved_by_employee: histórico de aprovações de fotos enviadas por funcionário
   *  - rejected_recent: rejeições nos últimos 7 dias (pra admin acompanhar)
   *  - employees_with_perm: quantos funcionários têm `can_add_people_photos`
   *
   * Igor (06/05): reportou que o painel de fotos pendentes "não mostra nada".
   * Stats explicitas ajudam a entender se é estado vazio legítimo ou bug.
   */
  async getPhotoWorkflowStats() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: pending },
      { count: missing },
      { count: rejectedRecent },
      employeesWithPerm,
    ] = await Promise.all([
      this.supabaseService.client
        .from('people')
        .select('id', { count: 'exact', head: true })
        .not('photo_pending_url', 'is', null),
      this.supabaseService.client
        .from('people')
        .select('id', { count: 'exact', head: true })
        .is('photo_url', null)
        .is('photo_pending_url', null),
      this.supabaseService.client
        .from('people')
        .select('id', { count: 'exact', head: true })
        .gte('photo_rejected_at', sevenDaysAgo),
      this.supabaseService.client
        .from('employee_permissions')
        .select('user_id, users!inner(id, name, email, status)', { count: 'exact' })
        .eq('can_add_people_photos', true),
    ]);

    return {
      pending: pending || 0,
      missing: missing || 0,
      rejected_last_7d: rejectedRecent || 0,
      employees_with_perm: (employeesWithPerm.data || []).map((row: any) => ({
        id: row.users?.id,
        name: row.users?.name,
        email: row.users?.email,
        status: row.users?.status,
      })),
    };
  }

  /** Lista fotos pendentes (admin). */
  async listPendingPhotos() {
    const { data, error } = await this.supabaseService.client
      .from('people')
      .select(
        'id, name, role, photo_pending_url, photo_pending_at, photo_pending_by_user_id',
      )
      .not('photo_pending_url', 'is', null)
      .order('photo_pending_at', { ascending: true });

    if (error) throw new Error(`Failed to list pending photos: ${error.message}`);

    const submitterIds = Array.from(
      new Set((data || []).map((p) => p.photo_pending_by_user_id).filter(Boolean)),
    );

    let submitters: Record<string, { id: string; name: string; email: string }> = {};
    if (submitterIds.length > 0) {
      const { data: users } = await this.supabaseService.client
        .from('users')
        .select('id, name, email')
        .in('id', submitterIds);
      for (const u of users || []) submitters[u.id] = u;
    }

    return (data || []).map((p) => ({
      ...p,
      submitted_by: p.photo_pending_by_user_id
        ? submitters[p.photo_pending_by_user_id] || null
        : null,
    }));
  }

  // Igor (07/05): metodos approvePendingPhoto, rejectPendingPhoto e
  // approvePendingPhotosBatch foram removidos. O fluxo de aprovacao de
  // foto agora roda pelo content-edit-requests service (request_type=
  // 'photo_replace'). Ver N14 nos AJUSTES.
}
