'use client';

// Igor (07/05): página própria do funcionário pra ver suas stats de
// produtividade (quantos conteúdos postou, breakdown diário, lista
// detalhada). Reusa o mesmo backend que o admin usa, mas via endpoint
// /me que pega user_id do JWT — funcionário não vê stats de outro.

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { api } from '@/services/api';
import AdminBackButton from '@/components/Admin/AdminBackButton';

interface Stats {
  last_7_days: number;
  last_15_days: number;
  last_30_days: number;
}

interface ProductivityItem {
  id: string;
  title: string;
  content_type: string;
  status: string;
  created_at: string;
}

interface ProductivityResponse {
  range: { from: string; to: string };
  daily: Array<{ date: string; movies: number; series: number; total: number }>;
  monthly: Array<{ month: string; movies: number; series: number; total: number }>;
  items: ProductivityItem[];
  totals: { movies: number; series: number; total: number };
}

export default function EmployeeProductivityPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [productivity, setProductivity] = useState<ProductivityResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const [s, p] = await Promise.all([
        api.get<Stats>('/api/v1/admin/employees/me/stats'),
        api.get<ProductivityResponse>('/api/v1/admin/employees/me/productivity'),
      ]);
      setStats(s);
      setProductivity(p);
    } catch (err: any) {
      toast.error(err.message || 'Falha ao carregar produtividade');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto max-w-6xl p-6 text-white">
      <AdminBackButton />
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold">Minha Produtividade</h1>
        <p className="text-sm text-zinc-400">
          Conteúdos que você adicionou ao catálogo. Itens arquivados/excluídos
          não contam. Atualiza em tempo real.
        </p>
      </div>

      {loading ? (
        <p className="text-zinc-500">Carregando…</p>
      ) : (
        <>
          {/* Stats cards */}
          {stats && (
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="Últimos 7 dias" value={stats.last_7_days} />
              <StatCard label="Últimos 15 dias" value={stats.last_15_days} />
              <StatCard label="Últimos 30 dias" value={stats.last_30_days} />
            </div>
          )}

          {productivity && (
            <>
              {/* Totais agregados */}
              <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard
                  label={`Filmes (${formatRange(productivity.range)})`}
                  value={productivity.totals.movies}
                  color="blue"
                />
                <StatCard
                  label="Séries"
                  value={productivity.totals.series}
                  color="purple"
                />
                <StatCard
                  label="Total"
                  value={productivity.totals.total}
                  color="emerald"
                />
              </div>

              {/* Breakdown diário */}
              {productivity.daily.length > 0 && (
                <section className="mb-8">
                  <h2 className="mb-3 text-lg font-bold">Por dia</h2>
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-800/50 text-xs uppercase text-zinc-400">
                        <tr>
                          <th className="px-4 py-2 text-left">Dia</th>
                          <th className="px-4 py-2 text-right">Filmes</th>
                          <th className="px-4 py-2 text-right">Séries</th>
                          <th className="px-4 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {productivity.daily.map((d) => (
                          <tr key={d.date} className="hover:bg-white/5">
                            <td className="px-4 py-2">
                              {new Date(d.date).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                weekday: 'short',
                              })}
                            </td>
                            <td className="px-4 py-2 text-right text-blue-300">{d.movies}</td>
                            <td className="px-4 py-2 text-right text-purple-300">{d.series}</td>
                            <td className="px-4 py-2 text-right font-semibold">{d.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Lista detalhada */}
              {productivity.items.length > 0 && (
                <section>
                  <h2 className="mb-3 text-lg font-bold">
                    Conteúdos adicionados ({productivity.items.length})
                  </h2>
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-800/50 text-xs uppercase text-zinc-400">
                        <tr>
                          <th className="px-4 py-2 text-left">Título</th>
                          <th className="px-4 py-2 text-left">Tipo</th>
                          <th className="px-4 py-2 text-left">Status</th>
                          <th className="px-4 py-2 text-left">Data</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {productivity.items.map((item) => (
                          <tr key={item.id} className="hover:bg-white/5">
                            <td className="px-4 py-2 font-medium">{item.title}</td>
                            <td className="px-4 py-2 text-xs">
                              <span
                                className={`rounded px-2 py-0.5 ${
                                  item.content_type === 'movie' || item.content_type === 'Filme'
                                    ? 'bg-blue-500/20 text-blue-300'
                                    : 'bg-purple-500/20 text-purple-300'
                                }`}
                              >
                                {item.content_type === 'series' || item.content_type === 'Série'
                                  ? 'Série'
                                  : 'Filme'}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-xs">
                              <span
                                className={`rounded px-2 py-0.5 ${
                                  item.status === 'PUBLISHED'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-zinc-500/20 text-zinc-400'
                                }`}
                              >
                                {item.status}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-xs text-zinc-400">
                              {new Date(item.created_at).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {productivity.items.length === 0 && (
                <p className="text-zinc-500">
                  Você ainda não adicionou nenhum conteúdo no período selecionado.
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color = 'amber',
}: {
  label: string;
  value: number;
  color?: 'amber' | 'blue' | 'purple' | 'emerald';
}) {
  const colorClass = {
    amber: 'text-amber-300',
    blue: 'text-blue-300',
    purple: 'text-purple-300',
    emerald: 'text-emerald-300',
  }[color];

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900 p-5">
      <div className={`text-3xl font-bold ${colorClass}`}>{value}</div>
      <div className="mt-1 text-xs text-zinc-400">{label}</div>
    </div>
  );
}

function formatRange(range: { from: string; to: string }): string {
  const f = new Date(range.from).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const t = new Date(range.to).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `${f} → ${t}`;
}
