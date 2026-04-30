'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

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

interface State {
  loading: boolean;
  allowed: boolean;
}

const getToken = () =>
  typeof window === 'undefined'
    ? null
    : localStorage.getItem('access_token') || localStorage.getItem('auth_token');

const getRoleFromStorage = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const u = localStorage.getItem('user');
    if (u) return JSON.parse(u)?.role ?? null;
  } catch {
    /* ignore */
  }
  const t = getToken();
  if (!t) return null;
  try {
    return JSON.parse(atob(t.split('.')[1]))?.role ?? null;
  } catch {
    return null;
  }
};

export function useRequirePermission(flag: EmployeePermissionFlag): State {
  const router = useRouter();
  const [state, setState] = useState<State>({ loading: true, allowed: false });

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const token = getToken();
      if (!token) {
        router.push('/admin/login');
        return;
      }

      const role = getRoleFromStorage();
      if (role === 'admin' || role === 'moderator') {
        if (!cancelled) setState({ loading: false, allowed: true });
        return;
      }

      if (role !== 'employee') {
        router.push('/admin/login');
        return;
      }

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
        const res = await fetch(`${apiUrl}/api/v1/admin/employees/me/permissions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('failed');
        const perms = await res.json();
        if (cancelled) return;

        if (perms?.[flag]) {
          setState({ loading: false, allowed: true });
        } else {
          toast.error('Você não tem permissão para acessar esta área.');
          router.push('/admin');
        }
      } catch {
        if (!cancelled) {
          toast.error('Não foi possível validar suas permissões.');
          router.push('/admin');
        }
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, [flag, router]);

  return state;
}
