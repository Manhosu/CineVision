import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../../../config/supabase.service';
import { EmployeesService } from '../../employees/employees.service';

export type PhotoStatus = 'missing' | 'pending' | 'approved' | 'all';

@Injectable()
export class AdminPeopleService {
  private readonly logger = new Logger(AdminPeopleService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly employeesService: EmployeesService,
  ) {}

  async findAll(search?: string, role?: string, photoStatus: PhotoStatus = 'all') {
    let query = this.supabaseService.client
      .from('people')
      .select('*')
      .order('name', { ascending: true });

    if (search) query = query.ilike('name', `%${search}%`);
    if (role) query = query.eq('role', role);

    // IMG_8846 — funcionário com `can_add_people_photos` precisa filtrar
    // só pessoas sem foto. Admin pode listar pendentes pra revisar.
    if (photoStatus === 'missing') {
      query = query.is('photo_url', null).is('photo_pending_url', null);
    } else if (photoStatus === 'pending') {
      query = query.not('photo_pending_url', 'is', null);
    } else if (photoStatus === 'approved') {
      query = query.not('photo_url', 'is', null);
    }

    const [{ data, error }, { data: counts }] = await Promise.all([
      query,
      this.supabaseService.client
        .from('content_people')
        .select('person_id'),
    ]);

    if (error) throw new Error(`Failed to fetch people: ${error.message}`);

    const countMap = new Map<string, number>();
    if (counts) {
      for (const row of counts) {
        countMap.set(row.person_id, (countMap.get(row.person_id) || 0) + 1);
      }
    }

    return (data || []).map((person) => ({
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
   * Admin envia foto direto, persiste em `photo_url` com ownership.
   * Employee envia foto pendente, persiste em `photo_pending_url` (precisa
   * `can_add_people_photos=true` E pessoa estar sem foto). Roles abaixo
   * de admin/employee são bloqueadas.
   */
  async submitPhoto(personId: string, photoUrl: string, actorUserId: string, isAdmin: boolean) {
    if (!photoUrl?.trim()) {
      throw new BadRequestException('photo_url é obrigatório');
    }

    const person = await this.findById(personId);
    const now = new Date().toISOString();

    if (isAdmin) {
      const { data: updated, error } = await this.supabaseService.client
        .from('people')
        .update({
          photo_url: photoUrl.trim(),
          photo_added_by_user_id: actorUserId,
          photo_added_at: now,
          // Limpa qualquer pendência prévia (admin sobrepõe).
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
    }

    // Path do funcionário.
    const perms = await this.employeesService.getPermissions(actorUserId);
    if (!perms?.can_add_people_photos) {
      throw new ForbiddenException('Sem permissão para adicionar fotos');
    }
    if (person.photo_url) {
      throw new ForbiddenException(
        'Esta pessoa já tem foto. Solicite ao admin para substituir.',
      );
    }
    if (person.photo_pending_url) {
      throw new BadRequestException(
        'Já existe uma foto pendente de aprovação para esta pessoa.',
      );
    }

    const { data: updated, error } = await this.supabaseService.client
      .from('people')
      .update({
        photo_pending_url: photoUrl.trim(),
        photo_pending_by_user_id: actorUserId,
        photo_pending_at: now,
        photo_rejected_at: null,
        photo_rejection_reason: null,
        updated_at: now,
      })
      .eq('id', personId)
      .select()
      .single();

    if (error) throw new Error(`Failed to submit photo: ${error.message}`);
    return { status: 'pending' as const, person: updated };
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

  /** Admin aprova: promove `photo_pending_url` → `photo_url`. */
  async approvePendingPhoto(personId: string, adminUserId: string) {
    const person = await this.findById(personId);
    if (!person.photo_pending_url) {
      throw new BadRequestException('Esta pessoa não tem foto pendente.');
    }

    const now = new Date().toISOString();
    const { data: updated, error } = await this.supabaseService.client
      .from('people')
      .update({
        photo_url: person.photo_pending_url,
        // Crédito vai para quem submeteu, não para o admin que aprovou.
        photo_added_by_user_id: person.photo_pending_by_user_id,
        photo_added_at: now,
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

    if (error) throw new Error(`Failed to approve photo: ${error.message}`);
    this.logger.log(
      `Photo approved for person ${personId} by admin ${adminUserId} (submitter: ${person.photo_pending_by_user_id})`,
    );
    return updated;
  }

  /** Admin rejeita: limpa `photo_pending_*`, opcionalmente registra motivo. */
  async rejectPendingPhoto(personId: string, adminUserId: string, reason?: string) {
    const person = await this.findById(personId);
    if (!person.photo_pending_url) {
      throw new BadRequestException('Esta pessoa não tem foto pendente.');
    }

    const now = new Date().toISOString();
    const { data: updated, error } = await this.supabaseService.client
      .from('people')
      .update({
        photo_pending_url: null,
        photo_pending_by_user_id: null,
        photo_pending_at: null,
        photo_rejected_at: now,
        photo_rejection_reason: reason || null,
        updated_at: now,
      })
      .eq('id', personId)
      .select()
      .single();

    if (error) throw new Error(`Failed to reject photo: ${error.message}`);
    this.logger.log(
      `Photo rejected for person ${personId} by admin ${adminUserId} (reason: ${reason || '—'})`,
    );
    return updated;
  }
}
