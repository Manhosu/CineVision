'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { api } from '@/services/api';
import AdminBackButton from '@/components/Admin/AdminBackButton';

// IMG_8846 — Igor pediu controle total de produtividade do funcionário
// pra basear o pagamento dele. Componente carrega o breakdown daily +
// monthly + lista de itens via /admin/employees/:id/productivity.
// Renderiza um gráfico de barras simples (CSS puro, sem dependência
// de Recharts/Chart.js) + tabela com filtro de range. Aparece
// DENTRO do <details> de cada funcionário quando o admin troca pra
// aba "Produtividade".
interface ProductivityResponse {
  range: { from: string; to: string };
  daily: Array<{ date: string; movies: number; series: number; total: number }>;
  monthly: Array<{ month: string; movies: number; series: number; total: number }>;
  items: Array<{ id: string; title: string; content_type: string; status: string; created_at: string }>;
  totals: { movies: number; series: number; total: number };
}

function EmployeeProductivity({ employeeId }: { employeeId: string }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<ProductivityResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const to = new Date().toISOString();
        const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const r = await api.get<ProductivityResponse>(
          `/api/v1/admin/employees/${employeeId}/productivity?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        );
        if (!cancelled) setData(r);
      } catch (err: any) {
        if (!cancelled) toast.error(err.message || 'Falha ao carregar produtividade');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [employeeId, days]);

  if (loading) return <p className="text-sm text-zinc-500">Carregando...</p>;
  if (!data) return null;

  // Bar chart: maior valor define a escala (largura proporcional).
  const maxDaily = Math.max(1, ...data.daily.map((d) => d.total));
  const fmtDate = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}`;
  };
  const fmtMonth = (m: string) => {
    const [y, mm] = m.split('-');
    return `${mm}/${y}`;
  };
  const fmtFullDate = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <div className="space-y-4 text-sm">
      {/* Range selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-500">Período:</span>
        {[7, 15, 30, 60, 90].map((n) => (
          <button
            key={n}
            onClick={() => setDays(n)}
            className={`rounded-lg border px-3 py-1 text-xs transition ${
              days === n
                ? 'border-red-500 bg-red-600/20 text-white'
                : 'border-white/10 text-zinc-400 hover:bg-white/5'
            }`}
          >
            {n}d
          </button>
        ))}
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-white/10 bg-zinc-900 p-3">
          <div className="text-xs text-zinc-500">Filmes</div>
          <div className="text-2xl font-bold text-blue-300">{data.totals.movies}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-zinc-900 p-3">
          <div className="text-xs text-zinc-500">Séries</div>
          <div className="text-2xl font-bold text-purple-300">{data.totals.series}</div>
        </div>
        <div className="rounded-lg border border-red-500/30 bg-red-600/10 p-3">
          <div className="text-xs text-zinc-400">Total</div>
          <div className="text-2xl font-bold text-white">{data.totals.total}</div>
        </div>
      </div>

      {/* Daily chart */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Por dia
        </h4>
        {data.daily.length === 0 ? (
          <p className="text-xs text-zinc-500">Nenhum conteúdo adicionado no período.</p>
        ) : (
          <div className="space-y-1">
            {data.daily.slice().reverse().map((d) => (
              <div key={d.date} className="flex items-center gap-2">
                <span className="w-12 text-right font-mono text-xs text-zinc-500">{fmtDate(d.date)}</span>
                <div className="flex h-6 flex-1 overflow-hidden rounded bg-zinc-900">
                  <div
                    className="bg-blue-500"
                    style={{ width: `${(d.movies / maxDaily) * 100}%` }}
                    title={`${d.movies} filme(s)`}
                  />
                  <div
                    className="bg-purple-500"
                    style={{ width: `${(d.series / maxDaily) * 100}%` }}
                    title={`${d.series} série(s)`}
                  />
                </div>
                <span className="w-10 text-right text-xs font-semibold text-white">
                  {d.total}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Monthly breakdown (compact, only if range > 30d) */}
      {data.monthly.length > 1 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Por mês
          </h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {data.monthly.map((m) => (
              <div key={m.month} className="rounded-lg border border-white/10 bg-zinc-950 p-2 text-xs">
                <div className="text-zinc-500">{fmtMonth(m.month)}</div>
                <div className="font-semibold text-white">
                  {m.total} <span className="text-zinc-500">total</span>
                </div>
                <div className="text-[10px] text-zinc-500">
                  {m.movies}f / {m.series}s
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Items list (used pra Igor saber QUAIS itens, conforme vídeo) */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Conteúdos adicionados ({data.items.length})
        </h4>
        {data.items.length === 0 ? (
          <p className="text-xs text-zinc-500">Nenhum.</p>
        ) : (
          <div className="max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-zinc-950">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-zinc-900 text-zinc-500">
                <tr>
                  <th className="px-2 py-1 text-left">Título</th>
                  <th className="px-2 py-1 text-left">Tipo</th>
                  <th className="px-2 py-1 text-left">Status</th>
                  <th className="px-2 py-1 text-right">Data</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((it) => (
                  <tr key={it.id} className="border-t border-white/5">
                    <td className="px-2 py-1 text-white">{it.title}</td>
                    <td className="px-2 py-1 text-zinc-400">
                      {it.content_type === 'series' ? '📺 série' : '🎬 filme'}
                    </td>
                    <td className="px-2 py-1 text-zinc-400">{it.status}</td>
                    <td className="px-2 py-1 text-right font-mono text-zinc-500">
                      {fmtFullDate(it.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

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
  can_view_active_users: boolean;
  can_manage_discounts: boolean;
  can_add_people_photos: boolean;
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
              <EmployeeRow
                key={e.id}
                employee={e}
                onUpdatePerm={updatePerm}
                onRemove={remove}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const PERMISSION_FIELDS: Array<{ key: keyof Permissions; label: string }> = [
  { key: 'can_add_movies', label: 'Adicionar filmes' },
  { key: 'can_add_series', label: 'Adicionar séries' },
  { key: 'can_edit_own_content', label: 'Editar próprio conteúdo' },
  { key: 'can_edit_any_content', label: 'Editar qualquer conteúdo' },
  { key: 'can_view_users', label: 'Ver usuários' },
  { key: 'can_view_purchases', label: 'Ver compras' },
  { key: 'can_view_top10', label: 'Ver Top 10' },
  { key: 'can_view_online_users', label: 'Ver usuários online' },
  { key: 'can_view_active_users', label: 'Ver usuários ativos' },
  { key: 'can_manage_discounts', label: 'Gerenciar descontos' },
  { key: 'can_add_people_photos', label: 'Autores — adicionar fotos aos sem foto' },
];

function EmployeeRow({
  employee,
  onUpdatePerm,
  onRemove,
}: {
  employee: Employee;
  onUpdatePerm: (id: string, field: keyof Permissions, value: any) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [tab, setTab] = useState<'perms' | 'prod'>('perms');
  const perms = employee.permissions;

  return (
    <details className="group rounded-lg border border-white/10 bg-zinc-950">
      <summary className="flex cursor-pointer items-center justify-between p-3 hover:bg-white/5">
        <div>
          <div className="font-semibold text-white">{employee.name}</div>
          <div className="text-xs text-zinc-500">
            {employee.email} • {employee.role}
          </div>
        </div>
        <span className="text-xs text-zinc-500 group-open:hidden">▶ expandir</span>
        <span className="hidden text-xs text-zinc-500 group-open:inline">▼ recolher</span>
      </summary>

      <div className="border-t border-white/10 p-4">
        {/* Tabs */}
        <div className="mb-4 flex gap-2 border-b border-white/10">
          <button
            onClick={() => setTab('perms')}
            className={`px-3 py-2 text-sm transition ${
              tab === 'perms'
                ? 'border-b-2 border-red-500 text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Permissões
          </button>
          <button
            onClick={() => setTab('prod')}
            className={`px-3 py-2 text-sm transition ${
              tab === 'prod'
                ? 'border-b-2 border-red-500 text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Produtividade
          </button>
        </div>

        {tab === 'perms' && (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {PERMISSION_FIELDS.map((f) => (
                <label key={f.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!perms?.[f.key]}
                    onChange={(e) => onUpdatePerm(employee.id, f.key, e.target.checked)}
                  />
                  {f.label}
                </label>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-4 border-t border-white/5 pt-3 text-sm">
              <label className="flex items-center gap-2">
                Janela edição (h):
                <input
                  type="number"
                  defaultValue={perms?.edit_window_hours ?? 1}
                  onBlur={(e) =>
                    onUpdatePerm(employee.id, 'edit_window_hours', Number(e.target.value))
                  }
                  className="w-20 rounded-lg border border-white/10 bg-zinc-950 px-2 py-1"
                />
              </label>
              <label className="flex items-center gap-2">
                Limite diário:
                <input
                  type="number"
                  defaultValue={perms?.daily_content_limit ?? 50}
                  onBlur={(e) =>
                    onUpdatePerm(employee.id, 'daily_content_limit', Number(e.target.value))
                  }
                  className="w-20 rounded-lg border border-white/10 bg-zinc-950 px-2 py-1"
                />
              </label>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => onRemove(employee.id)}
                className="rounded-lg border border-red-500/40 px-3 py-1 text-xs text-red-300 transition hover:bg-red-600/10"
              >
                Excluir funcionário
              </button>
            </div>
          </div>
        )}

        {tab === 'prod' && <EmployeeProductivity employeeId={employee.id} />}
      </div>
    </details>
  );
}
