import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../../../config/supabase.service';
import {
  EmployeePermissionFlag,
  REQUIRE_PERMISSION_KEY,
} from '../decorators/require-permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Authentication required');

    const role = user.role;

    if (role === 'admin' || role === 'moderator') return true;

    const flag = this.reflector.getAllAndOverride<EmployeePermissionFlag>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!flag || role !== 'employee') {
      throw new ForbiddenException('Sem permissão para esta ação');
    }

    const userId = user.sub || user.id;
    const { data } = await this.supabase.client
      .from('employee_permissions')
      .select(flag)
      .eq('user_id', userId)
      .maybeSingle();

    if (!data || !(data as any)[flag]) {
      throw new ForbiddenException(`Sem permissão: ${flag}`);
    }

    return true;
  }
}
