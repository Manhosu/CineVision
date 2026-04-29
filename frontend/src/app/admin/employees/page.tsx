'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { api } from '@/services/api';
import AdminBackButton from '@/components/Admin/AdminBackButton';

interface Permissions {
  user_id: string;
  can_add_movies: boolean;
  can_add_series: boolean;
  can_edit_own_content: boolean;
  can_edit_any_content: boolean;
  can_view_users: boolean;
  can_view_purchases: boolean;
  can_view_top10: boolean;
  can_view_online_users: boolean;
  can_manage_discounts: boolean;
  edit_window_hours: number;
  daily_content_limit: number;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
  permissions?: Permissions;
}

const DEFAULT_NEW = {
  email: '',
  name: '',
  password: '',
  can_add_movies: true,
  can_add_series: false,
  edit_window_hours: 5,
  daily_content_limit: 50,
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmp, setNewEmp] = useState<any>(DEFAULT_NEW);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await api.get<Employee[]>('/api/v1/admin/employees');
      setEmployees(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!newEmp.email || !newEmp.name || !newEmp.password) {
      toast.error('Email, nome e senha são obrigatórios');
      return;
    }
    try {
      setCreating(true);
      await api.post('/api/v1/admin/employees', newEmp);
      toast.success('Funcionário criado!');
      setNewEmp(DEFAULT_NEW);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const updatePerm = async (id: string, field: keyof Permissions, value: any) => {
    try {
      await api.put(`/api/v1/admin/employees/${id}/permissions`, { [field]: value });
      toast.success('Permissão atualizada');
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir funcionário?')) return;
    try {
      await api.delete(`/api/v1/admin/employees/${id}`);
      toast.success('Funcionário removido');
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-6 text-white">
      <AdminBackButton />
      <h1 className="mb-6 text-3xl font-bold">Funcionários</h1>

      <section className="mb-6 rounded-xl border border-white/10 bg-zinc-900 p-5">
        <h2 className="mb-3 text-lg font-semibold">Novo funcionário</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <input
            placeholder="Nome"
            value={newEmp.name}
            onChange={(e) => setNewEmp({ ...newEmp, name: e.target.value })}
            className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2"
          />
          <input
            placeholder="Email"
            value={newEmp.email}
            onChange={(e) => setNewEmp({ ...newEmp, email: e.target.value })}
            className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2"
          />
          <input
            placeholder="Senha"
            type="password"
            value={newEmp.password}
            onChange={(e) => setNewEmp({ ...newEmp, password: e.target.value })}
            className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2"
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!newEmp.can_add_movies} onChange={(e) => setNewEmp({ ...newEmp, can_add_movies: e.target.checked })} />
            Pode adicionar filmes
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!newEmp.can_add_series} onChange={(e) => setNewEmp({ ...newEmp, can_add_series: e.target.checked })} />
            Pode adicionar séries
          </label>
          <div className="flex items-center gap-2 text-sm">
            Janela edição (h):
            <input
              type="number"
              value={newEmp.edit_window_hours}
              onChange={(e) => setNewEmp({ ...newEmp, edit_window_hours: Number(e.target.value) })}
              className="w-20 rounded-lg border border-white/10 bg-zinc-950 px-2 py-1"
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            Limite diário:
            <input
              type="number"
              value={newEmp.daily_content_limit}
              onChange={(e) => setNewEmp({ ...newEmp, daily_content_limit: Number(e.target.value) })}
              className="w-20 rounded-lg border border-white/10 bg-zinc-950 px-2 py-1"
            />
          </div>
        </div>
        <button
          onClick={create}
          disabled={creating}
          className="mt-4 rounded-lg bg-red-600 px-5 py-2 font-semibold disabled:opacity-60"
        >
          {creating ? 'Criando...' : 'Criar funcionário'}
        </button>
      </section>

      <section className="rounded-xl border border-white/10 bg-zinc-900 p-5">
        <h2 className="mb-3 text-lg font-semibold">Lista</h2>
        {loading ? (
          <p>Carregando...</p>
        ) : employees.length === 0 ? (
          <p className="text-zinc-500">Nenhum funcionário cadastrado</p>
        ) : (
          <div className="space-y-3">
            {employees.map((e) => (
              <details key={e.id} className="rounded-lg border border-white/10 bg-zinc-950 p-3">
                <summary className="cursor-pointer">
                  <span className="font-semibold">{e.name}</span>{' '}
                  <span className="text-zinc-500">· {e.email}</span>
                </summary>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {e.permissions &&
                    PERMISSION_FIELDS.map((p) => (
                      <label key={p.key} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean((e.permissions as any)[p.key])}
                          onChange={(ev) => updatePerm(e.id, p.key as any, ev.target.checked)}
                        />
                        {p.label}
                      </label>
                    ))}
                  <div className="flex items-center gap-2 text-sm">
                    Janela edição (h):
                    <input
                      type="number"
                      defaultValue={e.permissions?.edit_window_hours || 5}
                      onBlur={(ev) => updatePerm(e.id, 'edit_window_hours' as any, Number(ev.target.value))}
                      className="w-20 rounded-lg border border-white/10 bg-black px-2 py-1"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    Limite diário:
                    <input
                      type="number"
                      defaultValue={e.permissions?.daily_content_limit || 50}
                      onBlur={(ev) => updatePerm(e.id, 'daily_content_limit' as any, Number(ev.target.value))}
                      className="w-20 rounded-lg border border-white/10 bg-black px-2 py-1"
                    />
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <a
                    href={`/api/v1/admin/employees/${e.id}/stats`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-white/10 px-3 py-1 text-xs hover:bg-white/5"
                  >
                    Ver métricas (JSON)
                  </a>
                  <button
                    onClick={() => remove(e.id)}
                    className="rounded-lg border border-red-500/30 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10"
                  >
                    Excluir
                  </button>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const PERMISSION_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'can_add_movies', label: 'Adicionar filmes' },
  { key: 'can_add_series', label: 'Adicionar séries' },
  { key: 'can_edit_own_content', label: 'Editar próprio conteúdo' },
  { key: 'can_edit_any_content', label: 'Editar qualquer conteúdo' },
  { key: 'can_view_users', label: 'Ver usuários' },
  { key: 'can_view_purchases', label: 'Ver compras' },
  { key: 'can_view_top10', label: 'Ver Top 10' },
  { key: 'can_view_online_users', label: 'Ver usuários online' },
  { key: 'can_manage_discounts', label: 'Gerenciar descontos' },
];
