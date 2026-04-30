import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'require_permission';

export type EmployeePermissionFlag =
  | 'can_add_movies'
  | 'can_add_series'
  | 'can_edit_own_content'
  | 'can_edit_any_content'
  | 'can_view_users'
  | 'can_view_purchases'
  | 'can_view_top10'
  | 'can_view_online_users'
  | 'can_manage_discounts';

export const RequirePermission = (flag: EmployeePermissionFlag) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, flag);
