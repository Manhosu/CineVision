import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.service';
import { CreateEmployeeDto, UpdateEmployeePermissionsDto } from './dto/employee.dto';
import * as bcrypt from 'bcrypt';
import axios from 'axios';

const DEFAULT_PERMISSIONS = {
  can_add_movies: false,
  can_add_series: false,
  can_edit_own_content: true,
  can_edit_any_content: false,
  can_view_users: false,
  can_view_purchases: false,
  can_view_top10: false,
  can_view_online_users: false,
  can_manage_discounts: false,
  // F2.5/F2.6 — toggles independentes para Igor segregar funcionários
  // que só fazem fotos de atores (can_add_people_photos), separar quem
  // pode ver "Usuários Ativos" no dashboard.
  can_view_active_users: false,
  can_add_people_photos: false,
  edit_window_hours: 5,
  daily_content_limit: 50,
};

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------
  async createEmployee(dto: CreateEmployeeDto) {
    const { data: existing } = await this.supabase.client
      .from('users')
      .select('id')
      .eq('email', dto.email)
      .maybeSingle();

    if (existing) {
      throw new BadRequestException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const { data: user, error: userErr } = await this.supabase.client
      .from('users')
      .insert({
        name: dto.name,
        email: dto.email,
        password_hash: passwordHash,
        role: 'employee',
        status: 'active',
      })
      .select()
      .single();

    if (userErr || !user) {
      throw new BadRequestException(`Failed to create employee user: ${userErr?.message}`);
    }

    const permissions = {
      user_id: user.id,
      can_add_movies: dto.can_add_movies ?? DEFAULT_PERMISSIONS.can_add_movies,
      can_add_series: dto.can_add_series ?? DEFAULT_PERMISSIONS.can_add_series,
      can_edit_own_content: dto.can_edit_own_content ?? DEFAULT_PERMISSIONS.can_edit_own_content,
      can_edit_any_content: dto.can_edit_any_content ?? DEFAULT_PERMISSIONS.can_edit_any_content,
      can_view_users: dto.can_view_users ?? DEFAULT_PERMISSIONS.can_view_users,
      can_view_purchases: dto.can_view_purchases ?? DEFAULT_PERMISSIONS.can_view_purchases,
      can_view_top10: dto.can_view_top10 ?? DEFAULT_PERMISSIONS.can_view_top10,
      can_view_online_users: dto.can_view_online_users ?? DEFAULT_PERMISSIONS.can_view_online_users,
      can_manage_discounts: dto.can_manage_discounts ?? DEFAULT_PERMISSIONS.can_manage_discounts,
      can_view_active_users: dto.can_view_active_users ?? DEFAULT_PERMISSIONS.can_view_active_users,
      can_add_people_photos: dto.can_add_people_photos ?? DEFAULT_PERMISSIONS.can_add_people_photos,
      edit_window_hours: dto.edit_window_hours ?? DEFAULT_PERMISSIONS.edit_window_hours,
      daily_content_limit: dto.daily_content_limit ?? DEFAULT_PERMISSIONS.daily_content_limit,
    };

    await this.supabase.client.from('employee_permissions').insert(permissions);

    return { user, permissions };
  }

  async listEmployees() {
    const { data: employees, error } = await this.supabase.client
      .from('users')
      .select('id, name, email, role, status, last_login_at, created_at')
      .eq('role', 'employee')
      .order('created_at', { ascending: false });

    if (error) {
      // Igor reported "funcionário criado não aparece na lista". The
      // earlier migration left the enum in a fragile state — surface
      // any select error so we don't return [] silently.
      this.logger.error(`listEmployees failed: ${error.message}`);
      throw new BadRequestException(`Falha ao listar funcionários: ${error.message}`);
    }

    if (!employees?.length) return [];

    const ids = employees.map((e: any) => e.id);
    const { data: perms } = await this.supabase.client
      .from('employee_permissions')
      .select('*')
      .in('user_id', ids);

    const permMap = new Map<string, any>();
    (perms || []).forEach((p: any) => permMap.set(p.user_id, p));

    return employees.map((e: any) => ({
      ...e,
      permissions: permMap.get(e.id) || null,
    }));
  }

  async getEmployee(id: string) {
    const { data: user } = await this.supabase.client
      .from('users')
      .select('id, name, email, role, status, last_login_at, created_at')
      .eq('id', id)
      .single();

    if (!user) throw new NotFoundException('Employee not found');
    if (user.role !== 'employee') throw new BadRequestException('User is not an employee');

    const { data: perms } = await this.supabase.client
      .from('employee_permissions')
      .select('*')
      .eq('user_id', id)
      .single();

    return { ...user, permissions: perms || null };
  }

  async updatePermissions(id: string, dto: UpdateEmployeePermissionsDto) {
    const { data: existing } = await this.supabase.client
      .from('employee_permissions')
      .select('id')
      .eq('user_id', id)
      .maybeSingle();

    const payload: any = {
      ...dto,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await this.supabase.client
        .from('employee_permissions')
        .update(payload)
        .eq('user_id', id);
    } else {
      await this.supabase.client
        .from('employee_permissions')
        .insert({ ...DEFAULT_PERMISSIONS, ...payload, user_id: id });
    }

    return this.getEmployee(id);
  }

  async deleteEmployee(id: string) {
    await this.supabase.client.from('employee_permissions').delete().eq('user_id', id);
    await this.supabase.client.from('users').delete().eq('id', id);
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Permission checks (used by guards)
  // ---------------------------------------------------------------------------
  async getPermissions(userId: string) {
    const { data } = await this.supabase.client
      .from('employee_permissions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    return data;
  }

  async canEditContent(userId: string, contentId: string): Promise<boolean> {
    const cap = await this.getEditCapability(userId, contentId);
    return cap === 'direct';
  }

  /**
   * Returns:
   * - 'direct'           → employee can edit and changes apply immediately
   * - 'needs_approval'   → employee can submit edit but it goes to admin queue
   * - 'blocked'          → not allowed at all (e.g. someone else's content with no override)
   */
  async getEditCapability(
    userId: string,
    contentId: string,
  ): Promise<'direct' | 'needs_approval' | 'blocked'> {
    const perms = await this.getPermissions(userId);
    if (!perms) return 'blocked';

    // Admin override: can edit anything directly
    if (perms.can_edit_any_content) return 'direct';
    if (!perms.can_edit_own_content) return 'blocked';

    const { data: content } = await this.supabase.client
      .from('content')
      .select('createdById, created_at')
      .eq('id', contentId)
      .single();

    if (!content) return 'blocked';
    if (content.createdById !== userId) return 'blocked';

    // Use ?? so that 0 (always-pending-approval) is honored
    const windowHours = perms.edit_window_hours ?? 5;
    const ageMs = Date.now() - new Date(content.created_at).getTime();
    const maxMs = windowHours * 60 * 60 * 1000;

    // Within window: edit applies immediately
    if (ageMs <= maxMs) return 'direct';

    // After window: edit is allowed but needs admin approval
    return 'needs_approval';
  }

  async checkDailyLimitAndIncrement(userId: string): Promise<void> {
    const perms = await this.getPermissions(userId);
    if (!perms) return; // not an employee — no limit

    // Use ?? so that 0 is honored (would otherwise fall through to 50).
    const limit = perms.daily_content_limit ?? 50;
    const today = new Date().toISOString().slice(0, 10);

    const { data: existing } = await this.supabase.client
      .from('employee_daily_stats')
      .select('*')
      .eq('user_id', userId)
      .eq('stat_date', today)
      .maybeSingle();

    const current = existing?.content_added_count || 0;
    if (current >= limit) {
      throw new ForbiddenException(
        `Limite diário atingido (${limit} conteúdos). Tente novamente amanhã.`,
      );
    }

    if (existing) {
      await this.supabase.client
        .from('employee_daily_stats')
        .update({
          content_added_count: current + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await this.supabase.client.from('employee_daily_stats').insert({
        user_id: userId,
        stat_date: today,
        content_added_count: 1,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Productivity stats
  // ---------------------------------------------------------------------------
  async getStats(userId: string) {
    // F2.7 (vídeo IMG_8810): Igor reportou que stats do dashboard
    // não atualizam. Causa: implementação anterior dependia da tabela
    // cache `employee_daily_stats`, alimentada só dentro de
    // `checkDailyLimitAndIncrement`. Se o funcionário criou conteúdo
    // por outra rota (Supabase Studio, scripts) ou se o INSERT no
    // cache falhou silenciosamente, os stats ficavam congelados.
    //
    // Agora consultamos `content` direto — fonte da verdade — usando
    // count agregado por janela de tempo. Sem cache. Custo: 3 COUNT
    // queries por chamada; aceitável pelo volume.
    const now = Date.now();
    const day7 = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const day15 = new Date(now - 15 * 24 * 60 * 60 * 1000).toISOString();
    const day30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    const countSince = async (since: string) => {
      const { count } = await this.supabase.client
        .from('content')
        .select('id', { count: 'exact', head: true })
        .eq('createdById', userId)
        .gte('created_at', since);
      return count || 0;
    };

    return {
      last_7_days: await countSince(day7),
      last_15_days: await countSince(day15),
      last_30_days: await countSince(day30),
    };
  }

  async listContent(userId: string) {
    const { data } = await this.supabase.client
      .from('content')
      .select('id, title, created_at, content_type, status, telegram_group_link')
      .eq('createdById', userId)
      .order('created_at', { ascending: false })
      .limit(200);
    return data || [];
  }

  // ---------------------------------------------------------------------------
  // Telegram link preview (best-effort OG scraper)
  // ---------------------------------------------------------------------------
  async previewTelegramLink(url: string) {
    if (!url || !url.startsWith('https://t.me/')) {
      return { title: url, image: null, description: null, url };
    }

    try {
      const response = await axios.get(url, {
        timeout: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CineVision-Preview/1.0)',
        },
        maxRedirects: 3,
      });

      const html: string = response.data;
      const pickMeta = (prop: string): string | null => {
        const re = new RegExp(
          `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
          'i',
        );
        const m = html.match(re);
        return m ? m[1] : null;
      };

      return {
        url,
        title: pickMeta('og:title') || pickMeta('twitter:title') || url,
        image: pickMeta('og:image') || pickMeta('twitter:image'),
        description: pickMeta('og:description') || pickMeta('description'),
      };
    } catch (err: any) {
      this.logger.warn(`Preview failed for ${url}: ${err.message}`);
      return { url, title: url, image: null, description: null, error: err.message };
    }
  }
}
